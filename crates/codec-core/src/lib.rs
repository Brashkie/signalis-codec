//! `codec-core` — a safe, dependency-free protobuf **wire codec** (Level 1).
//!
//! It reads and writes protobuf's four wire types (varint, fixed64,
//! length-delimited, fixed32) with strict bounds-checking and configurable
//! nesting-depth limits. It is schema-agnostic: field numbers in, field numbers
//! out. A higher layer maps those to names.
//!
//! Design goals: no unsafe, no panics on malformed input, and termination
//! guarantees on adversarial payloads (the Proto6 recursion class).

#![forbid(unsafe_code)]

pub mod decoder;
pub mod encoder;
pub mod error;
pub mod packed;
pub mod reader;
pub mod wire;

pub use decoder::{decode_fields, decode_tree, Field, FieldValue, Node};
pub use encoder::Encoder;
pub use error::DecodeError;
pub use packed::{
    pack_fixed32, pack_fixed64, pack_varints, unpack_fixed32, unpack_fixed64, unpack_varints,
};
pub use reader::Reader;
pub use wire::{FieldKey, WireType};

/// ZigZag-encode a signed 64-bit integer (for sint32/sint64).
#[inline]
pub fn zigzag_encode(value: i64) -> u64 {
    ((value << 1) ^ (value >> 63)) as u64
}

/// ZigZag-decode back to a signed 64-bit integer.
#[inline]
pub fn zigzag_decode(value: u64) -> i64 {
    ((value >> 1) as i64) ^ -((value & 1) as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn varint_roundtrip() {
        for v in [0u64, 1, 127, 128, 300, 16384, u32::MAX as u64, u64::MAX] {
            let mut enc = Encoder::new();
            enc.write_varint(v);
            let bytes = enc.finish();
            let mut r = Reader::new(&bytes);
            assert_eq!(r.read_varint().unwrap(), v);
            assert!(r.is_empty());
        }
    }

    #[test]
    fn zigzag_roundtrip() {
        for v in [0i64, -1, 1, -2, 2, i32::MIN as i64, i64::MIN, i64::MAX] {
            assert_eq!(zigzag_decode(zigzag_encode(v)), v);
        }
    }

    #[test]
    fn field_roundtrip_all_wire_types() {
        let mut enc = Encoder::new();
        enc.write_varint_field(1, 150);
        enc.write_fixed64_field(2, 0x0102_0304_0506_0708);
        enc.write_fixed32_field(3, 0xDEAD_BEEF);
        enc.write_bytes_field(4, b"hello");
        let bytes = enc.finish();

        let fields = decode_fields(&bytes).unwrap();
        assert_eq!(fields.len(), 4);
        assert_eq!(fields[0].value, FieldValue::Varint(150));
        assert_eq!(fields[1].value, FieldValue::Fixed64(0x0102_0304_0506_0708));
        assert_eq!(fields[2].value, FieldValue::Fixed32(0xDEAD_BEEF));
        assert_eq!(fields[3].value, FieldValue::Bytes(b"hello"));
    }

    #[test]
    fn truncated_input_is_rejected() {
        // A varint field key with no value.
        let bytes = [0x08];
        assert!(matches!(
            decode_fields(&bytes),
            Err(DecodeError::UnexpectedEof { .. })
        ));
    }

    #[test]
    fn field_number_zero_is_rejected() {
        // key = 0 → field number 0.
        let bytes = [0x00, 0x00];
        assert!(matches!(
            decode_fields(&bytes),
            Err(DecodeError::InvalidFieldNumber { .. })
        ));
    }

    #[test]
    fn group_wire_types_rejected() {
        // key with wire type 3 (start group): field 1 << 3 | 3 = 0x0b.
        let bytes = [0x0b];
        assert!(matches!(
            decode_fields(&bytes),
            Err(DecodeError::GroupsUnsupported { .. })
        ));
    }

    #[test]
    fn depth_limit_stops_deep_nesting() {
        // Build a deeply nested message: field 1, length-delimited, repeated.
        // Each level wraps the previous in a 1-field submessage.
        let mut inner = Encoder::new();
        inner.write_varint_field(1, 42);
        let mut payload = inner.finish();

        for _ in 0..50 {
            let mut e = Encoder::new();
            e.write_bytes_field(1, &payload);
            payload = e.finish();
        }

        // Shallow limit must reject; deep limit must accept.
        assert!(matches!(
            decode_tree(&payload, 5),
            Err(DecodeError::DepthLimitExceeded { .. })
        ));
        assert!(decode_tree(&payload, 100).is_ok());
    }

    #[test]
    fn depth_limit_is_not_swallowed_as_bytes() {
        // Regression: a depth violation deep in the tree must PROPAGATE, not be
        // caught by the submessage→bytes fallback and returned as an opaque node.
        let mut inner = Encoder::new();
        inner.write_varint_field(1, 7);
        let mut payload = inner.finish();
        for _ in 0..20 {
            let mut e = Encoder::new();
            e.write_bytes_field(1, &payload);
            payload = e.finish();
        }
        // With a limit well below the nesting, we must get the depth error —
        // never Ok(...) with a Bytes node standing in for the deep subtree.
        match decode_tree(&payload, 3) {
            Err(DecodeError::DepthLimitExceeded { .. }) => {}
            other => panic!("expected DepthLimitExceeded, got {other:?}"),
        }
    }

    #[test]
    fn varint_overflow_rejected() {
        // 11 bytes of 0x80 → never terminates within 64 bits.
        let bytes = [0x80u8; 11];
        let mut r = Reader::new(&bytes);
        assert!(matches!(
            r.read_varint(),
            Err(DecodeError::VarintOverflow { .. })
        ));
    }
}
