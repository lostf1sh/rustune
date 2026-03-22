use std::fs::File;

use symphonia::core::audio::{AudioBufferRef, Signal};
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

pub struct Decoder {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn symphonia::core::codecs::Decoder>,
    track_id: u32,
    sample_rate: u32,
    channels: usize,
    duration_secs: f64,
    position_samples: u64,
}

impl Decoder {
    pub fn new(path: &str) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = std::path::Path::new(path).extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
            .map_err(|e| format!("Unsupported format: {}", e))?;

        let format = probed.format;

        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("No supported audio track found")?;

        let track_id = track.id;
        let codec_params = &track.codec_params;

        let sample_rate = codec_params.sample_rate.unwrap_or(44100);
        let channels = codec_params
            .channels
            .map(|c| c.count())
            .unwrap_or(2);

        let duration_secs = codec_params
            .n_frames
            .map(|n| n as f64 / sample_rate as f64)
            .unwrap_or(0.0);

        let decoder = symphonia::default::get_codecs()
            .make(codec_params, &DecoderOptions::default())
            .map_err(|e| format!("Unsupported codec: {}", e))?;

        Ok(Self {
            format,
            decoder,
            track_id,
            sample_rate,
            channels,
            duration_secs,
            position_samples: 0,
        })
    }

    pub fn duration_secs(&self) -> f64 {
        self.duration_secs
    }

    pub fn position_secs(&self) -> f64 {
        self.position_samples as f64 / self.sample_rate as f64
    }

    pub fn signal_spec(&self) -> symphonia::core::audio::SignalSpec {
        symphonia::core::audio::SignalSpec::new(self.sample_rate, symphonia::core::audio::Channels::FRONT_LEFT | symphonia::core::audio::Channels::FRONT_RIGHT)
    }

    pub fn seek(&mut self, position_secs: f64) {
        let result = self.format.seek(
            SeekMode::Accurate,
            SeekTo::Time {
                time: Time::new(position_secs as u64, position_secs.fract()),
                track_id: Some(self.track_id),
            },
        );
        if let Ok(seeked) = result {
            self.position_samples = seeked.actual_ts;
            self.decoder.reset();
        }
    }

    pub fn next_samples(&mut self) -> Option<Vec<f32>> {
        loop {
            let packet = match self.format.next_packet() {
                Ok(p) => p,
                Err(_) => return None,
            };

            if packet.track_id() != self.track_id {
                continue;
            }

            match self.decoder.decode(&packet) {
                Ok(decoded) => {
                    let num_frames = decoded.frames();
                    let samples = audio_buf_to_f32(&decoded, self.channels);
                    self.position_samples += num_frames as u64;
                    return Some(samples);
                }
                Err(symphonia::core::errors::Error::DecodeError(_)) => {
                    // Skip corrupted packets
                    continue;
                }
                Err(_) => return None,
            }
        }
    }

}

fn audio_buf_to_f32(buf: &AudioBufferRef, channels: usize) -> Vec<f32> {
    match buf {
        AudioBufferRef::F32(b) => {
            let mut samples = Vec::with_capacity(b.frames() * channels);
            for frame in 0..b.frames() {
                for ch in 0..channels {
                    samples.push(*b.chan(ch).get(frame).unwrap_or(&0.0));
                }
            }
            samples
        }
        AudioBufferRef::S16(b) => {
            let mut samples = Vec::with_capacity(b.frames() * channels);
            for frame in 0..b.frames() {
                for ch in 0..channels {
                    let s = *b.chan(ch).get(frame).unwrap_or(&0);
                    samples.push(s as f32 / i16::MAX as f32);
                }
            }
            samples
        }
        AudioBufferRef::S32(b) => {
            let mut samples = Vec::with_capacity(b.frames() * channels);
            for frame in 0..b.frames() {
                for ch in 0..channels {
                    let s = *b.chan(ch).get(frame).unwrap_or(&0);
                    samples.push(s as f32 / i32::MAX as f32);
                }
            }
            samples
        }
        AudioBufferRef::U8(b) => {
            let mut samples = Vec::with_capacity(b.frames() * channels);
            for frame in 0..b.frames() {
                for ch in 0..channels {
                    let s = *b.chan(ch).get(frame).unwrap_or(&128);
                    samples.push((s as f32 - 128.0) / 128.0);
                }
            }
            samples
        }
        _ => Vec::new(),
    }
}
