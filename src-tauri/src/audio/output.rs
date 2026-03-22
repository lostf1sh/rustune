use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use std::sync::{Arc, Mutex};

pub struct AudioOutput {
    _stream: Stream,
    buffer: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
    channels: u16,
}

impl AudioOutput {
    pub fn new(sample_rate: u32, channels: u16) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or("No audio output device available")?;

        let config = StreamConfig {
            channels,
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let buffer_clone = Arc::clone(&buffer);

        let stream = device
            .build_output_stream(
                &config,
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    let mut buf = buffer_clone.lock().unwrap();
                    let len = data.len().min(buf.len());
                    if len > 0 {
                        data[..len].copy_from_slice(&buf[..len]);
                        buf.drain(..len);
                    }
                    for sample in &mut data[len..] {
                        *sample = 0.0;
                    }
                },
                |err| {
                    log::error!("Audio output error: {}", err);
                },
                None,
            )
            .map_err(|e| format!("Failed to build output stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to play stream: {}", e))?;

        Ok(Self {
            _stream: stream,
            buffer,
            sample_rate,
            channels,
        })
    }

    pub fn matches(&self, sample_rate: u32, channels: u16) -> bool {
        self.sample_rate == sample_rate && self.channels == channels
    }

    pub fn clear(&self) {
        self.buffer.lock().unwrap().clear();
    }

    pub fn buffered_samples(&self) -> usize {
        self.buffer.lock().unwrap().len()
    }

    pub fn write(&self, samples: &[f32]) {
        self.buffer.lock().unwrap().extend_from_slice(samples);
    }
}
