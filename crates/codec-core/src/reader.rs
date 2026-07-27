//! A bounds-checked cursor over a byte buffer.
//!
//! Every read validates that enough bytes remain before touching memory, so a
//! truncated or malicious payload yields a clean `DecodeError` instead of a
//! panic or out-of-bounds read.

use crate::error::DecodeError;

/// The maximum number of bytes a single varint may occupy (64-bit value).
const MAX_VARINT_BYTES: usize = 10;

/// A forward-only reader over a byte slice.
pub struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    /// Create a reader positioned at the start of `buf`.
    pub fn new(buf: &'a [u8]) -> Self {
        Reader { buf, pos: 0 }
    }

    /// Bytes consumed so far.
    #[inline]
    pub fn position(&self) -> usize {
        self.pos
    }

    /// Bytes remaining.
    #[inline]
    pub fn remaining(&self) -> usize {
        self.buf.len() - self.pos
    }

    /// Whether the reader has consumed the whole buffer.
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.pos >= self.buf.len()
    }

    /// Read a single byte, advancing the cursor.
    #[inline]
    pub fn read_byte(&mut self) -> Result<u8, DecodeError> {
        if self.pos >= self.buf.len() {
            return Err(DecodeError::UnexpectedEof {
                needed: 1,
                position: self.pos,
            });
        }
        let b = self.buf[self.pos];
        self.pos += 1;
        Ok(b)
    }

    /// Read a base-128 varint (LEB128) as a u64.
    ///
    /// Rejects varints longer than 10 bytes (which cannot fit in 64 bits) so a
    /// stream of 0x80 bytes can't spin forever.
    pub fn read_varint(&mut self) -> Result<u64, DecodeError> {
        let mut result: u64 = 0;
        let mut shift: u32 = 0;
        let mut count: usize = 0;

        loop {
            let byte = self.read_byte()?;
            count += 1;

            // On the 10th byte only the lowest bit may be set (64 = 9*7 + 1).
            if count == MAX_VARINT_BYTES && byte > 0x01 {
                return Err(DecodeError::VarintOverflow {
                    position: self.pos,
                });
            }

            result |= u64::from(byte & 0x7f) << shift;

            if byte & 0x80 == 0 {
                return Ok(result);
            }

            shift += 7;
            if count >= MAX_VARINT_BYTES {
                return Err(DecodeError::VarintOverflow {
                    position: self.pos,
                });
            }
        }
    }

    /// Read a little-endian u32 (wire type 5 — fixed32).
    pub fn read_fixed32(&mut self) -> Result<u32, DecodeError> {
        let bytes = self.read_bytes(4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    /// Read a little-endian u64 (wire type 1 — fixed64).
    pub fn read_fixed64(&mut self) -> Result<u64, DecodeError> {
        let bytes = self.read_bytes(8)?;
        Ok(u64::from_le_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }

    /// Borrow the next `len` bytes without copying, advancing the cursor.
    pub fn read_bytes(&mut self, len: usize) -> Result<&'a [u8], DecodeError> {
        let end = self
            .pos
            .checked_add(len)
            .ok_or(DecodeError::LengthOverflow { position: self.pos })?;
        if end > self.buf.len() {
            return Err(DecodeError::UnexpectedEof {
                needed: len,
                position: self.pos,
            });
        }
        let slice = &self.buf[self.pos..end];
        self.pos = end;
        Ok(slice)
    }

    /// Skip `len` bytes (used to discard unknown fields).
    pub fn skip(&mut self, len: usize) -> Result<(), DecodeError> {
        self.read_bytes(len).map(|_| ())
    }
}
