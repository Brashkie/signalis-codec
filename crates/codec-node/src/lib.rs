//! NAPI-RS bindings exposing `codec-core` to Node.js.
//!
//! The JS-facing surface is intentionally small and data-oriented: encode from
//! a list of typed fields, decode into a list of typed fields, with an explicit
//! `maxDepth` for the recursive tree decoder.

#![deny(clippy::all)]

use codec_core::{
    decode_fields, decode_tree, index_fields, zigzag_decode as zz_decode,
    zigzag_encode as zz_encode, Encoder, FieldValue, Node,
};
use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Wire type discriminant as seen by JS.
///
/// 0 = Varint, 1 = Fixed64, 2 = Bytes (length-delimited), 5 = Fixed32.
#[napi]
pub const WIRE_VARINT: u32 = 0;
#[napi]
pub const WIRE_FIXED64: u32 = 1;
#[napi]
pub const WIRE_BYTES: u32 = 2;
#[napi]
pub const WIRE_FIXED32: u32 = 5;

/// A single decoded field handed back to JS.
///
/// Exactly one of the value fields is populated, selected by `wireType`.
/// Varint/Fixed64 values are returned as `BigInt` to preserve all 64 bits.
#[napi(object)]
pub struct DecodedField {
    pub field_number: u32,
    pub wire_type: u32,
    /// Present when wireType is Varint (0) or Fixed64 (1).
    pub varint: Option<BigInt>,
    /// Present when wireType is Fixed32 (5).
    pub fixed32: Option<u32>,
    /// Present when wireType is Bytes (2).
    pub bytes: Option<Buffer>,
}

/// A field to encode, supplied by JS. Populate the value matching `wireType`.
#[napi(object)]
pub struct FieldInput {
    pub field_number: u32,
    pub wire_type: u32,
    pub varint: Option<BigInt>,
    pub fixed32: Option<u32>,
    pub bytes: Option<Buffer>,
}

fn bigint_from_u64(v: u64) -> BigInt {
    BigInt::from(v)
}

/// Decode a protobuf buffer into a flat list of fields (no recursion).
///
/// Length-delimited fields are returned as raw bytes; re-call `decodeFields`
/// on them if you know they are submessages.
#[napi]
pub fn decode_fields_js(buf: Buffer) -> Result<Vec<DecodedField>> {
    let data: &[u8] = &buf;
    let fields = decode_fields(data).map_err(to_napi_err)?;
    Ok(fields
        .into_iter()
        .map(|f| match f.value {
            FieldValue::Varint(v) => DecodedField {
                field_number: f.field_number,
                wire_type: WIRE_VARINT,
                varint: Some(bigint_from_u64(v)),
                fixed32: None,
                bytes: None,
            },
            FieldValue::Fixed64(v) => DecodedField {
                field_number: f.field_number,
                wire_type: WIRE_FIXED64,
                varint: Some(bigint_from_u64(v)),
                fixed32: None,
                bytes: None,
            },
            FieldValue::Fixed32(v) => DecodedField {
                field_number: f.field_number,
                wire_type: WIRE_FIXED32,
                varint: None,
                fixed32: Some(v),
                bytes: None,
            },
            FieldValue::Bytes(b) => DecodedField {
                field_number: f.field_number,
                wire_type: WIRE_BYTES,
                varint: None,
                fixed32: None,
                bytes: Some(Buffer::from(b.to_vec())),
            },
        })
        .collect())
}

/// Index a protobuf buffer in a single pass, returning a flat table.
///
/// The returned `Uint32Array` holds 4 values per field —
/// `[fieldNumber, wireType, offset, length]` repeated — so the whole index
/// crosses the FFI boundary **once**, as a single typed array, with no
/// per-field JS object allocation. The caller reads only the field values it
/// needs directly from the original buffer (see the `LazyMessage` wrapper).
#[napi]
pub fn index_fields_js(buf: Buffer) -> Result<Uint32Array> {
    let entries =
        index_fields(&buf).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;

    let mut flat: Vec<u32> = Vec::with_capacity(entries.len() * 4);
    for e in entries {
        flat.push(e.field_number);
        flat.push(u32::from(e.wire_type));
        flat.push(e.offset);
        flat.push(e.length);
    }
    Ok(Uint32Array::new(flat))
}

/// Encode a list of fields into a protobuf buffer.
#[napi]
pub fn encode_fields_js(fields: Vec<FieldInput>) -> Result<Buffer> {
    let mut enc = Encoder::new();
    for f in fields {
        match f.wire_type {
            WIRE_VARINT => {
                let v = f
                    .varint
                    .ok_or_else(|| Error::from_reason("varint field missing 'varint' value"))?;
                enc.write_varint_field(f.field_number, bigint_to_u64(v)?);
            }
            WIRE_FIXED64 => {
                let v = f
                    .varint
                    .ok_or_else(|| Error::from_reason("fixed64 field missing 'varint' value"))?;
                enc.write_fixed64_field(f.field_number, bigint_to_u64(v)?);
            }
            WIRE_FIXED32 => {
                let v = f
                    .fixed32
                    .ok_or_else(|| Error::from_reason("fixed32 field missing 'fixed32' value"))?;
                enc.write_fixed32_field(f.field_number, v);
            }
            WIRE_BYTES => {
                let b = f
                    .bytes
                    .ok_or_else(|| Error::from_reason("bytes field missing 'bytes' value"))?;
                enc.write_bytes_field(f.field_number, &b);
            }
            other => return Err(Error::from_reason(format!("unsupported wire type {other}"))),
        }
    }
    Ok(Buffer::from(enc.finish()))
}

/// A node in the recursive decode tree, as JSON-friendly data for JS.
///
/// `kind` is one of: "varint" | "fixed64" | "fixed32" | "bytes" | "message".
#[napi(object)]
pub struct TreeNode {
    pub field_number: u32,
    pub kind: String,
    pub varint: Option<BigInt>,
    pub fixed32: Option<u32>,
    pub bytes: Option<Buffer>,
    pub message: Option<Vec<TreeNode>>,
}

fn node_to_tree(field_number: u32, node: Node) -> TreeNode {
    match node {
        Node::Varint(v) => TreeNode {
            field_number,
            kind: "varint".into(),
            varint: Some(bigint_from_u64(v)),
            fixed32: None,
            bytes: None,
            message: None,
        },
        Node::Fixed64(v) => TreeNode {
            field_number,
            kind: "fixed64".into(),
            varint: Some(bigint_from_u64(v)),
            fixed32: None,
            bytes: None,
            message: None,
        },
        Node::Fixed32(v) => TreeNode {
            field_number,
            kind: "fixed32".into(),
            varint: None,
            fixed32: Some(v),
            bytes: None,
            message: None,
        },
        Node::Bytes(b) => TreeNode {
            field_number,
            kind: "bytes".into(),
            varint: None,
            fixed32: None,
            bytes: Some(Buffer::from(b)),
            message: None,
        },
        Node::Message(children) => TreeNode {
            field_number,
            kind: "message".into(),
            varint: None,
            fixed32: None,
            bytes: None,
            message: Some(
                children
                    .into_iter()
                    .map(|(fnum, child)| node_to_tree(fnum, child))
                    .collect(),
            ),
        },
    }
}

/// Recursively decode `buf` into a tree, descending into submessages, bounded
/// by `maxDepth`. Exceeding the depth throws instead of overflowing the stack.
#[napi]
pub fn decode_tree_js(buf: Buffer, max_depth: u32) -> Result<Vec<TreeNode>> {
    let data: &[u8] = &buf;
    let tree = decode_tree(data, max_depth).map_err(to_napi_err)?;
    Ok(tree
        .into_iter()
        .map(|(fnum, node)| node_to_tree(fnum, node))
        .collect())
}

/// ZigZag-encode a signed 64-bit integer (for sint32/sint64).
#[napi]
pub fn zigzag_encode(value: BigInt) -> Result<BigInt> {
    let v = bigint_to_i64(value)?;
    Ok(bigint_from_u64(zz_encode(v)))
}

/// ZigZag-decode back to a signed 64-bit integer.
#[napi]
pub fn zigzag_decode(value: BigInt) -> Result<BigInt> {
    let v = bigint_to_u64(value)?;
    Ok(BigInt::from(zz_decode(v)))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn to_napi_err(e: codec_core::DecodeError) -> Error {
    Error::from_reason(e.to_string())
}

fn bigint_to_u64(b: BigInt) -> Result<u64> {
    let (signed, value, lossless) = b.get_u64();
    if signed || !lossless {
        return Err(Error::from_reason(
            "value out of range for u64 (must be 0..=2^64-1)",
        ));
    }
    Ok(value)
}

fn bigint_to_i64(b: BigInt) -> Result<i64> {
    let (value, lossless) = b.get_i64();
    if !lossless {
        return Err(Error::from_reason(
            "value out of range for i64 (must be -2^63..=2^63-1)",
        ));
    }
    Ok(value)
}

// ─── Packed repeated ─────────────────────────────────────────────────────────

/// Pack raw varint values into a contiguous payload (no field tags).
#[napi]
pub fn pack_varints_js(values: Vec<BigInt>) -> Result<Buffer> {
    let raw: Vec<u64> = values
        .into_iter()
        .map(bigint_to_u64)
        .collect::<Result<_>>()?;
    Ok(Buffer::from(codec_core::pack_varints(&raw)))
}

/// Unpack a varint payload into its raw values.
#[napi]
pub fn unpack_varints_js(buf: Buffer) -> Result<Vec<BigInt>> {
    let data: &[u8] = &buf;
    let values = codec_core::unpack_varints(data).map_err(to_napi_err)?;
    Ok(values.into_iter().map(bigint_from_u64).collect())
}

/// Pack raw fixed32 values (little-endian, 4 bytes each).
#[napi]
pub fn pack_fixed32_js(values: Vec<u32>) -> Buffer {
    Buffer::from(codec_core::pack_fixed32(&values))
}

/// Unpack a fixed32 payload (length must be a multiple of 4).
#[napi]
pub fn unpack_fixed32_js(buf: Buffer) -> Result<Vec<u32>> {
    let data: &[u8] = &buf;
    codec_core::unpack_fixed32(data).map_err(to_napi_err)
}

/// Pack raw fixed64 values (little-endian, 8 bytes each).
#[napi]
pub fn pack_fixed64_js(values: Vec<BigInt>) -> Result<Buffer> {
    let raw: Vec<u64> = values
        .into_iter()
        .map(bigint_to_u64)
        .collect::<Result<_>>()?;
    Ok(Buffer::from(codec_core::pack_fixed64(&raw)))
}

/// Unpack a fixed64 payload (length must be a multiple of 8).
#[napi]
pub fn unpack_fixed64_js(buf: Buffer) -> Result<Vec<BigInt>> {
    let data: &[u8] = &buf;
    let values = codec_core::unpack_fixed64(data).map_err(to_napi_err)?;
    Ok(values.into_iter().map(bigint_from_u64).collect())
}
