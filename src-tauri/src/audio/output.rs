use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use ringbuf::{
    traits::{Consumer, Observer, Producer, Split},
    HeapProd, HeapRb,
};

pub struct AudioOutput {
    _stream: Stream,
    producer: HeapProd<f32>,
    flush: Arc<AtomicBool>,
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

        // ~1 second of audio buffer
        let capacity = (sample_rate as usize) * (channels as usize);
        let rb = HeapRb::<f32>::new(capacity);
        let (producer, mut consumer) = rb.split();

        let flush = Arc::new(AtomicBool::new(false));
        let flush_cb = Arc::clone(&flush);

        let stream = device
            .build_output_stream(
                &config,
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    if flush_cb.load(Ordering::Relaxed) {
                        // Discard all buffered data
                        let n = consumer.occupied_len();
                        consumer.skip(n);
                        flush_cb.store(false, Ordering::Relaxed);
                        data.fill(0.0);
                        return;
                    }
                    let read = consumer.pop_slice(data);
                    data[read..].fill(0.0);
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
            producer,
            flush,
            sample_rate,
            channels,
        })
    }

    pub fn matches(&self, sample_rate: u32, channels: u16) -> bool {
        self.sample_rate == sample_rate && self.channels == channels
    }

    pub fn clear(&self) {
        self.flush.store(true, Ordering::Relaxed);
    }

    pub fn buffered_samples(&self) -> usize {
        self.producer.occupied_len()
    }

    pub fn write(&mut self, samples: &[f32]) -> usize {
        self.producer.push_slice(samples)
    }
}
