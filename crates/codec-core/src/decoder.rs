//! The wire decoder: turns a byte buffer into a flat list of typed fields.
//!
//! This is a *Level-1 wire codec* — it understands protobuf's four wire types
//! but knows nothing about any particular schema. A higher layer (e.g. waproto)
//! maps field numbers to names.
//!
//! ## Depth limiting (anti-DoS)
//!
//! Protobuf messages can nest arbitrarily, and WhatsApp's schema is recursive
//! (a Message contains a quoted Message contains…). A crafted payload with tens
//! of thousands of nesting levels can exhaust the stack — the real-world Proto6
//! class of vulnerability. When callers opt into recursive parsing they pass a
//! `max_depth`; exceeding it yields `DepthLimitExceeded` instead of a crash.

use crate::error::DecodeError;
use crate::reader::Reader;
use crate::wire::{FieldKey, WireType};

/// The raw value of a single decoded field, borrowing from the input buffer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FieldValue<'a> {
    /// Wire type 0. Interpretation (int/uint/sint/bool/enum) is the caller's.
    Varint(u64),
    /// Wire type 1. Raw little-endian 64-bit value (double/fixed64/sfixed64).
    Fixed64(u64),
    /// Wire type 5. Raw little-endian 32-bit value (float/fixed32/sfixed32).
    Fixed32(u32),
    /// Wire type 2. Raw bytes (string/bytes/embedded message/packed repeated).
    Bytes(&'a [u8]),
}

/// A decoded field: its number plus its raw value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Field<'a> {
    pub field_number: u32,
    pub value: FieldValue<'a>,
}

/// Decode a single flat level of fields (no recursion into length-delimited
/// values). This is the primitive most callers want: fast, allocation-free,
/// and safe. Length-delimited fields come back as `Bytes`, which the caller can
/// re-decode with `decode_fields` if they know it's a nested message.
pub fn decode_fields(buf: &[u8]) -> Result<Vec<Field<'_>>, DecodeError> {
    let mut reader = Reader::new(buf);
    let mut fields = Vec::new();

    while !reader.is_empty() {
        let key_pos = reader.position();
        let key = reader.read_varint()?;
        let key = FieldKey::from_varint(key, key_pos)?;

        let value = match key.wire_type {
            WireType::Varint => FieldValue::Varint(reader.read_varint()?),
            WireType::Fixed64 => FieldValue::Fixed64(reader.read_fixed64()?),
            WireType::Fixed32 => FieldValue::Fixed32(reader.read_fixed32()?),
            WireType::LengthDelimited => {
                let len_pos = reader.position();
                let len = reader.read_varint()?;
                let len = usize::try_from(len)
                    .map_err(|_| DecodeError::LengthOverflow { position: len_pos })?;
                FieldValue::Bytes(reader.read_bytes(len)?)
            }
        };

        fields.push(Field {
            field_number: key.field_number,
            value,
        });
    }

    Ok(fields)
}

/// A fully-recursive view of a decoded message, used when the caller wants the
/// whole tree validated up front (with depth limiting).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Node {
    Varint(u64),
    Fixed64(u64),
    Fixed32(u32),
    /// A length-delimited value kept as raw bytes (leaf: string/bytes/packed).
    Bytes(Vec<u8>),
    /// A length-delimited value that was successfully parsed as a submessage.
    Message(Vec<(u32, Node)>),
}

/// Recursively decode `buf`, descending into length-delimited fields that parse
/// cleanly as submessages, and enforcing `max_depth`.
///
/// A length-delimited field is treated as a nested message when its bytes parse
/// without error; otherwise it's kept as `Bytes`. This heuristic mirrors how
/// protobuf debuggers work, and the depth limit guarantees termination.
pub fn decode_tree(buf: &[u8], max_depth: u32) -> Result<Vec<(u32, Node)>, DecodeError> {
    decode_tree_inner(buf, max_depth, 0)
}

fn decode_tree_inner(
    buf: &[u8],
    max_depth: u32,
    depth: u32,
) -> Result<Vec<(u32, Node)>, DecodeError> {
    if depth > max_depth {
        return Err(DecodeError::DepthLimitExceeded {
            limit: max_depth,
            position: 0,
        });
    }

    let mut reader = Reader::new(buf);
    let mut out = Vec::new();

    while !reader.is_empty() {
        let key_pos = reader.position();
        let key = reader.read_varint()?;
        let key = FieldKey::from_varint(key, key_pos)?;

        let node = match key.wire_type {
            WireType::Varint => Node::Varint(reader.read_varint()?),
            WireType::Fixed64 => Node::Fixed64(reader.read_fixed64()?),
            WireType::Fixed32 => Node::Fixed32(reader.read_fixed32()?),
            WireType::LengthDelimited => {
                let len_pos = reader.position();
                let len = reader.read_varint()?;
                let len = usize::try_from(len)
                    .map_err(|_| DecodeError::LengthOverflow { position: len_pos })?;
                let sub = reader.read_bytes(len)?;
                // Try to parse as a submessage; on failure keep as raw bytes —
                // EXCEPT a depth-limit violation, which is a hard security error
                // and must propagate instead of being swallowed as opaque bytes.
                match decode_tree_inner(sub, max_depth, depth + 1) {
                    Ok(children) if !sub.is_empty() => Node::Message(children),
                    Err(e @ DecodeError::DepthLimitExceeded { .. }) => return Err(e),
                    _ => Node::Bytes(sub.to_vec()),
                }
            }
        };

        out.push((key.field_number, node));
    }

    Ok(out)
}
