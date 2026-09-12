//! Single-pass field indexer for the "index-header, lazy-read" strategy.
//!
//! Instead of decoding every field into an owned value (which, across the NAPI
//! boundary, means allocating N JS objects and paying the FFI cost per field),
//! [`index_fields`] scans the buffer **once** and records, for each top-level
//! field, *where its value lives* — field number, wire type, byte offset, and
//! byte length. Nothing is decoded.
//!
//! The caller (TypeScript) receives this flat table plus the original buffer and
//! can then read *only the fields it needs* directly from the bytes, in O(1),
//! without crossing the FFI boundary again and without allocating a JS object
//! per field. This suits WhatsApp's sparse `Message` schema (100+ optional
//! fields, 1–3 present per message) and routing-heavy access (inspect `key` /
//! timestamp without decoding the payload).
//!
//! Depth is not descended: submessages are indexed as a single
//! length-delimited entry (offset+length of the nested bytes). Callers that want
//! to look inside can index that slice in turn — still one pass per level, still
//! bounded by the buffer size, no unbounded recursion.

use crate::error::DecodeError;
use crate::reader::Reader;
use crate::wire::{FieldKey, WireType};

/// A single indexed field: where its *value* bytes live in the original buffer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IndexEntry {
    /// Protobuf field number.
    pub field_number: u32,
    /// Wire type bits (0=varint, 1=fixed64, 2=len-delimited, 5=fixed32).
    pub wire_type: u8,
    /// Offset of the value bytes within the original buffer.
    pub offset: u32,
    /// Length of the value bytes.
    pub length: u32,
}

/// Scan `buf` once and return one [`IndexEntry`] per top-level field, in order.
///
/// For a varint the recorded span is the varint's own bytes; for fixed32/64 it
/// is 4/8 bytes; for a length-delimited field it is the payload *after* the
/// length prefix (so the caller reads the value directly). Repeated fields
/// produce one entry each, preserving order.
///
/// # Errors
/// Returns a [`DecodeError`] on any malformed input (bad key, truncated value,
/// varint overflow, unsupported group wire types) — never panics.
pub fn index_fields(buf: &[u8]) -> Result<Vec<IndexEntry>, DecodeError> {
    // Offsets are u32; protobuf messages beyond 4 GiB are not supported here.
    if buf.len() > u32::MAX as usize {
        return Err(DecodeError::LengthOverflow { position: 0 });
    }

    let mut reader = Reader::new(buf);
    let mut entries = Vec::new();

    while !reader.is_empty() {
        let key_pos = reader.position();
        let key = reader.read_varint()?;
        let field_key = FieldKey::from_varint(key, key_pos)?;

        let (offset, length) = match field_key.wire_type {
            WireType::Varint => {
                let start = reader.position();
                reader.read_varint()?; // consume to find its end
                (start, reader.position() - start)
            }
            WireType::Fixed64 => {
                let start = reader.position();
                reader.skip(8)?;
                (start, 8)
            }
            WireType::Fixed32 => {
                let start = reader.position();
                reader.skip(4)?;
                (start, 4)
            }
            WireType::LengthDelimited => {
                let len_pos = reader.position();
                let len = reader.read_varint()?;
                let len = usize::try_from(len)
                    .map_err(|_| DecodeError::LengthOverflow { position: len_pos })?;
                let start = reader.position();
                reader.skip(len)?;
                (start, len)
            }
        };

        entries.push(IndexEntry {
            field_number: field_key.field_number,
            wire_type: field_key.wire_type.to_bits(),
            // Both fit in u32: checked buf.len() <= u32::MAX above, and
            // offset/length are within the buffer.
            offset: offset as u32,
            length: length as u32,
        });
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::encoder::Encoder;

    #[test]
    fn indexes_a_flat_message() {
        let mut e = Encoder::new();
        e.write_varint_field(1, 150);
        e.write_bytes_field(2, b"hello");
        e.write_fixed32_field(3, 0xDEAD_BEEF);
        let buf = e.finish();

        let idx = index_fields(&buf).unwrap();
        assert_eq!(idx.len(), 3);

        // Field 1: varint 150 → 2 bytes (0x96 0x01).
        assert_eq!(idx[0].field_number, 1);
        assert_eq!(idx[0].wire_type, 0);
        assert_eq!(idx[0].length, 2);
        assert_eq!(&buf[idx[0].offset as usize..(idx[0].offset + idx[0].length) as usize], &[0x96, 0x01]);

        // Field 2: string "hello" → the 5 payload bytes (after the length prefix).
        assert_eq!(idx[1].field_number, 2);
        assert_eq!(idx[1].wire_type, 2);
        assert_eq!(idx[1].length, 5);
        assert_eq!(&buf[idx[1].offset as usize..(idx[1].offset + idx[1].length) as usize], b"hello");

        // Field 3: fixed32 → 4 bytes.
        assert_eq!(idx[2].field_number, 3);
        assert_eq!(idx[2].wire_type, 5);
        assert_eq!(idx[2].length, 4);
    }

    #[test]
    fn repeated_fields_each_get_an_entry() {
        let mut e = Encoder::new();
        e.write_varint_field(1, 10);
        e.write_varint_field(1, 20);
        e.write_varint_field(1, 30);
        let buf = e.finish();

        let idx = index_fields(&buf).unwrap();
        assert_eq!(idx.len(), 3);
        assert!(idx.iter().all(|x| x.field_number == 1 && x.wire_type == 0));
    }

    #[test]
    fn empty_buffer_yields_no_entries() {
        assert_eq!(index_fields(&[]).unwrap().len(), 0);
    }

    #[test]
    fn truncated_value_errors_cleanly() {
        // Field 2 (len-delimited) claims 10 bytes but only 3 follow.
        let buf = [0x12, 0x0a, 0x01, 0x02, 0x03];
        assert!(index_fields(&buf).is_err());
    }

    #[test]
    fn submessage_indexed_as_single_entry() {
        let mut inner = Encoder::new();
        inner.write_varint_field(1, 42);
        let inner_bytes = inner.finish();

        let mut outer = Encoder::new();
        outer.write_bytes_field(5, &inner_bytes);
        let buf = outer.finish();

        let idx = index_fields(&buf).unwrap();
        assert_eq!(idx.len(), 1);
        assert_eq!(idx[0].field_number, 5);
        assert_eq!(idx[0].wire_type, 2);
        // The entry spans the whole submessage; re-indexing that slice works.
        let sub = &buf[idx[0].offset as usize..(idx[0].offset + idx[0].length) as usize];
        let sub_idx = index_fields(sub).unwrap();
        assert_eq!(sub_idx.len(), 1);
        assert_eq!(sub_idx[0].field_number, 1);
    }
}
