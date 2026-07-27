//! Protobuf wire types and the field key (tag) that precedes every field.
//!
//! Wire types (proto3):
//!   0  Varint          — int32/64, uint32/64, sint*, bool, enum
//!   1  Fixed64         — fixed64, sfixed64, double
//!   2  LengthDelimited — string, bytes, embedded messages, packed repeated
//!   5  Fixed32         — fixed32, sfixed32, float
//!
//! Types 3 and 4 (start/end group) are deprecated and explicitly unsupported.

use crate::error::DecodeError;

/// A protobuf wire type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WireType {
    Varint,
    Fixed64,
    LengthDelimited,
    Fixed32,
}

impl WireType {
    /// Map the low 3 bits of a field key to a wire type.
    pub fn from_bits(bits: u8, position: usize) -> Result<WireType, DecodeError> {
        match bits {
            0 => Ok(WireType::Varint),
            1 => Ok(WireType::Fixed64),
            2 => Ok(WireType::LengthDelimited),
            5 => Ok(WireType::Fixed32),
            3 | 4 => Err(DecodeError::GroupsUnsupported { position }),
            other => Err(DecodeError::InvalidWireType {
                wire_type: other,
                position,
            }),
        }
    }

    /// The 3-bit tag used when encoding this wire type.
    pub fn to_bits(self) -> u8 {
        match self {
            WireType::Varint => 0,
            WireType::Fixed64 => 1,
            WireType::LengthDelimited => 2,
            WireType::Fixed32 => 5,
        }
    }
}

/// A decoded field key: its field number and wire type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldKey {
    pub field_number: u32,
    pub wire_type: WireType,
}

impl FieldKey {
    /// Decode a field key from its varint form.
    pub fn from_varint(key: u64, position: usize) -> Result<FieldKey, DecodeError> {
        let wire_type = WireType::from_bits((key & 0x07) as u8, position)?;
        let field_number = (key >> 3) as u32;
        if field_number == 0 {
            return Err(DecodeError::InvalidFieldNumber { position });
        }
        Ok(FieldKey {
            field_number,
            wire_type,
        })
    }

    /// Encode this field key back to its varint form.
    pub fn to_varint(self) -> u64 {
        (u64::from(self.field_number) << 3) | u64::from(self.wire_type.to_bits())
    }
}
