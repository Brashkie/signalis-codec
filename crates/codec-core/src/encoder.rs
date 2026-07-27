//! The wire encoder: appends typed fields to a growable byte buffer.
//!
//! Symmetric with `decoder`: you give it a field number + value and it emits
//! the key varint followed by the value in the correct wire format.

use crate::wire::{FieldKey, WireType};

/// A growable protobuf wire writer.
#[derive(Debug, Default)]
pub struct Encoder {
    buf: Vec<u8>,
}

impl Encoder {
    /// Create an empty encoder.
    pub fn new() -> Self {
        Encoder { buf: Vec::new() }
    }

    /// Create an encoder with pre-allocated capacity.
    pub fn with_capacity(cap: usize) -> Self {
        Encoder {
            buf: Vec::with_capacity(cap),
        }
    }

    /// Consume the encoder and return the encoded bytes.
    pub fn finish(self) -> Vec<u8> {
        self.buf
    }

    /// Current length in bytes.
    pub fn len(&self) -> usize {
        self.buf.len()
    }

    /// Whether nothing has been written yet.
    pub fn is_empty(&self) -> bool {
        self.buf.is_empty()
    }

    /// Append a base-128 varint.
    pub fn write_varint(&mut self, mut value: u64) {
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            self.buf.push(byte);
            if value == 0 {
                break;
            }
        }
    }

    /// Append the field key for `field_number` + `wire_type`.
    fn write_key(&mut self, field_number: u32, wire_type: WireType) {
        let key = FieldKey {
            field_number,
            wire_type,
        };
        self.write_varint(key.to_varint());
    }

    /// Write a varint field (wire type 0).
    pub fn write_varint_field(&mut self, field_number: u32, value: u64) {
        self.write_key(field_number, WireType::Varint);
        self.write_varint(value);
    }

    /// Write a fixed64 field (wire type 1), little-endian.
    pub fn write_fixed64_field(&mut self, field_number: u32, value: u64) {
        self.write_key(field_number, WireType::Fixed64);
        self.buf.extend_from_slice(&value.to_le_bytes());
    }

    /// Write a fixed32 field (wire type 5), little-endian.
    pub fn write_fixed32_field(&mut self, field_number: u32, value: u32) {
        self.write_key(field_number, WireType::Fixed32);
        self.buf.extend_from_slice(&value.to_le_bytes());
    }

    /// Write a length-delimited field (wire type 2): string/bytes/submessage.
    pub fn write_bytes_field(&mut self, field_number: u32, data: &[u8]) {
        self.write_key(field_number, WireType::LengthDelimited);
        self.write_varint(data.len() as u64);
        self.buf.extend_from_slice(data);
    }
}
