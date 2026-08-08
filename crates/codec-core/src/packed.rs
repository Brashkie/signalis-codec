//! Packed-repeated encoding (`[packed=true]` fields).
//!
//! A packed repeated field is a single length-delimited field whose payload is
//! the concatenation of the element values, with no per-element tags. This
//! module handles the *physical* packing of the three packable wire forms:
//!
//! - varint elements (int32/64, uint32/64, sint32/64, bool, enum)
//! - fixed32 elements (fixed32, sfixed32, float)
//! - fixed64 elements (fixed64, sfixed64, double)
//!
//! It is schema-agnostic: callers supply already-encoded raw values (e.g. a
//! ZigZag-transformed varint) and get raw values back. Logical-type mapping is
//! the caller's job (done in the TypeScript layer).

use crate::encoder::Encoder;
use crate::error::DecodeError;
use crate::reader::Reader;

/// Pack a slice of raw varint values into a contiguous payload.
pub fn pack_varints(values: &[u64]) -> Vec<u8> {
    // Reserve a rough estimate: most varints are 1-2 bytes.
    let mut enc = Encoder::with_capacity(values.len() * 2);
    for &v in values {
        enc.write_varint(v);
    }
    enc.finish()
}

/// Unpack a varint payload into its raw values.
pub fn unpack_varints(buf: &[u8]) -> Result<Vec<u64>, DecodeError> {
    let mut reader = Reader::new(buf);
    let mut out = Vec::new();
    while !reader.is_empty() {
        out.push(reader.read_varint()?);
    }
    Ok(out)
}

/// Pack a slice of raw fixed32 values (little-endian, 4 bytes each).
pub fn pack_fixed32(values: &[u32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 4);
    for &v in values {
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

/// Unpack a fixed32 payload. The payload length must be a multiple of 4.
pub fn unpack_fixed32(buf: &[u8]) -> Result<Vec<u32>, DecodeError> {
    if buf.len() % 4 != 0 {
        return Err(DecodeError::UnexpectedEof {
            needed: 4 - (buf.len() % 4),
            position: buf.len(),
        });
    }
    let mut reader = Reader::new(buf);
    let mut out = Vec::with_capacity(buf.len() / 4);
    while !reader.is_empty() {
        out.push(reader.read_fixed32()?);
    }
    Ok(out)
}

/// Pack a slice of raw fixed64 values (little-endian, 8 bytes each).
pub fn pack_fixed64(values: &[u64]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 8);
    for &v in values {
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

/// Unpack a fixed64 payload. The payload length must be a multiple of 8.
pub fn unpack_fixed64(buf: &[u8]) -> Result<Vec<u64>, DecodeError> {
    if buf.len() % 8 != 0 {
        return Err(DecodeError::UnexpectedEof {
            needed: 8 - (buf.len() % 8),
            position: buf.len(),
        });
    }
    let mut reader = Reader::new(buf);
    let mut out = Vec::with_capacity(buf.len() / 8);
    while !reader.is_empty() {
        out.push(reader.read_fixed64()?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn varints_roundtrip_spec_example() {
        // Canonical Google spec example: [3, 270, 86942] → 03 8E02 9EA705
        let packed = pack_varints(&[3, 270, 86942]);
        assert_eq!(packed, vec![0x03, 0x8e, 0x02, 0x9e, 0xa7, 0x05]);
        assert_eq!(unpack_varints(&packed).unwrap(), vec![3, 270, 86942]);
    }

    #[test]
    fn varints_empty() {
        assert_eq!(pack_varints(&[]), Vec::<u8>::new());
        assert_eq!(unpack_varints(&[]).unwrap(), Vec::<u64>::new());
    }

    #[test]
    fn fixed32_roundtrip() {
        let packed = pack_fixed32(&[1, 2, 0xDEAD_BEEF]);
        assert_eq!(unpack_fixed32(&packed).unwrap(), vec![1, 2, 0xDEAD_BEEF]);
    }

    #[test]
    fn fixed64_roundtrip() {
        let packed = pack_fixed64(&[1, 0x0102_0304_0506_0708]);
        assert_eq!(
            unpack_fixed64(&packed).unwrap(),
            vec![1, 0x0102_0304_0506_0708]
        );
    }

    #[test]
    fn fixed32_misaligned_rejected() {
        assert!(unpack_fixed32(&[0x01, 0x02, 0x03]).is_err());
    }

    #[test]
    fn fixed64_misaligned_rejected() {
        assert!(unpack_fixed64(&[0x01, 0x02, 0x03]).is_err());
    }

    #[test]
    fn truncated_varint_in_payload_rejected() {
        // A payload ending mid-varint (continuation bit set, no more bytes).
        assert!(unpack_varints(&[0x80]).is_err());
    }
}
