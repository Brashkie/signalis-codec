/**
 * Tests for the logical-type helpers (as* / from*).
 *
 * Pure TypeScript (no native addon needed). Checks conversions against protobuf
 * spec values, with attention to the tricky cases: negative int32 (10-byte
 * varint form), zigzag, IEEE-754, and strict range checks.
 */

import { describe, expect, it } from 'vitest';

import {
  asBool,
  asBytes,
  asDouble,
  asEnum,
  asFixed32,
  asFixed64,
  asFloat,
  asInt32,
  asInt64,
  asSfixed32,
  asSfixed64,
  asSint32,
  asSint64,
  asString,
  asUint32,
  asUint64,
  fromBool,
  fromBytes,
  fromDouble,
  fromEnum,
  fromFixed32,
  fromFixed64,
  fromFloat,
  fromInt32,
  fromInt64,
  fromSfixed32,
  fromSfixed64,
  fromSint32,
  fromSint64,
  fromString,
  fromUint32,
  fromUint64,
} from '../src/helpers';

const U64_MAX = 18446744073709551615n;

describe('int32 (including the negative 10-byte form)', () => {
  it('decodes a negative int32 stored as a full-width varint', () => {
    expect(asInt32(U64_MAX)).toBe(-1);
    expect(asInt32(0xffffffffn)).toBe(-1);
  });

  it('fromInt32(-1) produces the 64-bit form', () => {
    expect(fromInt32(-1)).toBe(U64_MAX);
  });

  it('round-trips across the range', () => {
    for (const v of [0, 1, -1, 2147483647, -2147483648, 42, -42]) {
      expect(asInt32(fromInt32(v))).toBe(v);
    }
  });

  it('rejects out-of-range values', () => {
    expect(() => fromInt32(2147483648)).toThrow(RangeError);
    expect(() => fromInt32(-2147483649)).toThrow(RangeError);
  });
});

describe('uint32 / uint64', () => {
  it('round-trips uint32', () => {
    for (const v of [0, 1, 4294967295]) {
      expect(asUint32(fromUint32(v))).toBe(v);
    }
  });

  it('round-trips uint64', () => {
    for (const v of [0n, 1n, U64_MAX, 18446744073709551614n]) {
      expect(asUint64(fromUint64(v))).toBe(v);
    }
  });

  it('rejects negatives and overflow', () => {
    expect(() => fromUint32(-1)).toThrow(RangeError);
    expect(() => fromUint32(4294967296)).toThrow(RangeError);
    expect(() => fromUint64(-1n)).toThrow(RangeError);
    expect(() => fromUint64(U64_MAX + 1n)).toThrow(RangeError);
  });
});

describe('int64', () => {
  it('round-trips signed 64-bit', () => {
    for (const v of [0n, 1n, -1n, 9223372036854775807n, -9223372036854775808n]) {
      expect(asInt64(fromInt64(v))).toBe(v);
    }
  });

  it('rejects out-of-range', () => {
    expect(() => fromInt64(9223372036854775808n)).toThrow(RangeError);
    expect(() => fromInt64(-9223372036854775809n)).toThrow(RangeError);
  });
});

describe('sint32 / sint64 (ZigZag)', () => {
  it('matches the protobuf spec wire values for sint32', () => {
    expect(fromSint32(0)).toBe(0n);
    expect(fromSint32(-1)).toBe(1n);
    expect(fromSint32(1)).toBe(2n);
    expect(fromSint32(-2)).toBe(3n);
    expect(fromSint32(2147483647)).toBe(4294967294n);
    expect(fromSint32(-2147483648)).toBe(4294967295n);
  });

  it('round-trips sint32', () => {
    for (const v of [0, -1, 1, -2, 2, 2147483647, -2147483648]) {
      expect(asSint32(fromSint32(v))).toBe(v);
    }
  });

  it('round-trips sint64', () => {
    for (const v of [0n, -1n, 1n, 9223372036854775807n, -9223372036854775808n]) {
      expect(asSint64(fromSint64(v))).toBe(v);
    }
  });

  it('rejects out-of-range sint32', () => {
    expect(() => fromSint32(2147483648)).toThrow(RangeError);
  });
});

describe('bool / enum', () => {
  it('bool round-trips', () => {
    expect(asBool(fromBool(true))).toBe(true);
    expect(asBool(fromBool(false))).toBe(false);
    expect(asBool(0n)).toBe(false);
    expect(asBool(1n)).toBe(true);
    expect(asBool(42n)).toBe(true);
  });

  it('enum round-trips (including negative)', () => {
    for (const v of [0, 1, 42, -1]) {
      expect(asEnum(fromEnum(v))).toBe(v);
    }
  });
});

describe('float / double (IEEE-754)', () => {
  it('double round-trips', () => {
    for (const v of [0, -0, 123.456, -2.5, 1e300, -1e-300]) {
      expect(asDouble(fromDouble(v))).toBe(v);
    }
  });

  it('float round-trips within single precision', () => {
    for (const v of [0, 1.5, -2.25, 100.0]) {
      expect(asFloat(fromFloat(v))).toBe(v);
    }
  });

  it('handles special double values', () => {
    expect(asDouble(fromDouble(Number.POSITIVE_INFINITY))).toBe(Number.POSITIVE_INFINITY);
    expect(asDouble(fromDouble(Number.NEGATIVE_INFINITY))).toBe(Number.NEGATIVE_INFINITY);
    expect(Number.isNaN(asDouble(fromDouble(Number.NaN)))).toBe(true);
  });
});

describe('fixed32 / fixed64 / sfixed', () => {
  it('fixed32 unsigned round-trips', () => {
    for (const v of [0, 1, 4294967295]) {
      expect(asFixed32(fromFixed32(v))).toBe(v);
    }
  });

  it('sfixed32 signed round-trips', () => {
    for (const v of [0, -1, 2147483647, -2147483648]) {
      expect(asSfixed32(fromSfixed32(v))).toBe(v);
    }
  });

  it('fixed64 unsigned round-trips', () => {
    for (const v of [0n, 1n, U64_MAX]) {
      expect(asFixed64(fromFixed64(v))).toBe(v);
    }
  });

  it('sfixed64 signed round-trips', () => {
    for (const v of [0n, -1n, 9223372036854775807n, -9223372036854775808n]) {
      expect(asSfixed64(fromSfixed64(v))).toBe(v);
    }
  });

  it('rejects out-of-range fixed values', () => {
    expect(() => fromFixed32(4294967296)).toThrow(RangeError);
    expect(() => fromFixed32(-1)).toThrow(RangeError);
    expect(() => fromFixed64(-1n)).toThrow(RangeError);
  });
});

describe('string / bytes', () => {
  it('string round-trips UTF-8', () => {
    for (const s of ['', 'hello', 'nono', 'unicode test', 'emoji check']) {
      expect(asString(fromString(s))).toBe(s);
    }
  });

  it('round-trips multibyte UTF-8', () => {
    const s = String.fromCodePoint(0x1f44b, 0x1f30d); // wave + globe
    expect(asString(fromString(s))).toBe(s);
  });

  it('bytes round-trips', () => {
    const b = Buffer.from([1, 2, 3, 255]);
    expect([...asBytes(fromBytes(b))]).toEqual([1, 2, 3, 255]);
  });

  it('accepts Uint8Array', () => {
    expect(asString(new Uint8Array([104, 105]))).toBe('hi');
  });

  it('asBytes / fromBytes convert Uint8Array to Buffer', () => {
    const u8 = new Uint8Array([9, 8, 7]);
    expect(Buffer.isBuffer(asBytes(u8))).toBe(true);
    expect([...asBytes(u8)]).toEqual([9, 8, 7]);
    expect(Buffer.isBuffer(fromBytes(u8))).toBe(true);
    expect([...fromBytes(u8)]).toEqual([9, 8, 7]);
  });
});
