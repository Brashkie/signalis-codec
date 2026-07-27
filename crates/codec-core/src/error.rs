//! Decode/encode errors.
//!
//! All errors carry the byte position where the problem occurred, which makes
//! debugging malformed payloads far easier.

use core::fmt;

/// An error produced while decoding a protobuf wire stream.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodeError {
    /// The buffer ended before a full value could be read.
    UnexpectedEof { needed: usize, position: usize },
    /// A varint exceeded 10 bytes / 64 bits.
    VarintOverflow { position: usize },
    /// A length-delimited field declared a length that overflows `usize`.
    LengthOverflow { position: usize },
    /// An unknown or unsupported wire type (only 0,1,2,5 are valid).
    InvalidWireType { wire_type: u8, position: usize },
    /// A field number was 0, which protobuf forbids.
    InvalidFieldNumber { position: usize },
    /// Nested-message depth exceeded the configured limit (anti-DoS).
    DepthLimitExceeded { limit: u32, position: usize },
    /// Group wire types (3/4) are not supported.
    GroupsUnsupported { position: usize },
}

impl fmt::Display for DecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DecodeError::UnexpectedEof { needed, position } => write!(
                f,
                "unexpected end of buffer: needed {needed} more byte(s) at position {position}"
            ),
            DecodeError::VarintOverflow { position } => {
                write!(f, "varint overflow (exceeds 64 bits) at position {position}")
            }
            DecodeError::LengthOverflow { position } => {
                write!(f, "length-delimited size overflow at position {position}")
            }
            DecodeError::InvalidWireType {
                wire_type,
                position,
            } => write!(f, "invalid wire type {wire_type} at position {position}"),
            DecodeError::InvalidFieldNumber { position } => {
                write!(f, "invalid field number 0 at position {position}")
            }
            DecodeError::DepthLimitExceeded { limit, position } => write!(
                f,
                "nesting depth exceeded limit of {limit} at position {position}"
            ),
            DecodeError::GroupsUnsupported { position } => write!(
                f,
                "group wire types (3/4) are not supported at position {position}"
            ),
        }
    }
}

impl std::error::Error for DecodeError {}
