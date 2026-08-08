/**
 * Tests for packed-repeated encoding.
 *
 * Run against the REAL native addon (requires `npm run build:native`). Verify
 * the low-level packing against the protobuf spec's canonical example and the
 * typed helpers via round-trips.
 */

import { describe, expect, it } from 'vitest';

import {
  WireType,
  decodeFields,
  decodePackedBool,
  decodePackedDouble,
  decodePackedEnum,
  decodePackedFixed32,
  decodePackedFixed64,
  decodePackedFloat,
  decodePackedInt32,
  decodePackedInt64,
  decodePackedSfixed32,
  decodePackedSfixed64,
  decodePackedSint32,
  decodePackedSint64,
  decodePackedUint32,
  decodePackedUint64,
  decodeTree,
  encodeFields,
  encodePackedBool,
  encodePackedDouble,
  encodePackedEnum,
  encodePackedFixed32,
  encodePackedFixed64,
  encodePackedFloat,
  encodePackedInt32,
  encodePackedInt64,
  encodePackedSfixed32,
  encodePackedSfixed64,
  encodePackedSint32,
  encodePackedSint64,
  encodePackedUint32,
  encodePackedUint64,
  packFixed32,
  packFixed64,
  packVarints,
  unpackFixed32,
  unpackFixed64,
  unpackVarints,
} from '../src';

describe('low-level packing', () => {
  it('matches the protobuf spec example (varints [3, 270, 86942])', () => {
    const packed = packVarints([3n, 270n, 86942n]);
    expect(packed.toString('hex')).toBe('038e029ea705');
    expect(unpackVarints(packed)).toEqual([3n, 270n, 86942n]);
  });

  it('round-trips empty', () => {
    expect(packVarints([]).length).toBe(0);
    expect(unpackVarints(Buffer.alloc(0))).toEqual([]);
  });

  it('round-trips fixed32', () => {
    const packed = packFixed32([1, 2, 0xdeadbeef]);
    expect(unpackFixed32(packed)).toEqual([1, 2, 0xdeadbeef]);
  });

  it('round-trips fixed64', () => {
    const packed = packFixed64([1n, 0x0102030405060708n]);
    expect(unpackFixed64(packed)).toEqual([1n, 0x0102030405060708n]);
  });

  it('rejects a misaligned fixed32 payload', () => {
    expect(() => unpackFixed32(Buffer.from([1, 2, 3]))).toThrow();
  });

  it('rejects a misaligned fixed64 payload', () => {
    expect(() => unpackFixed64(Buffer.from([1, 2, 3]))).toThrow();
  });
});

describe('typed packed round-trips', () => {
  it('int32 (including negatives)', () => {
    const vals = [0, 1, -1, 2147483647, -2147483648];
    expect(decodePackedInt32(encodePackedInt32(vals))).toEqual(vals);
  });

  it('int64', () => {
    const vals = [0n, 1n, -1n, 9223372036854775807n];
    expect(decodePackedInt64(encodePackedInt64(vals))).toEqual(vals);
  });

  it('uint32', () => {
    const vals = [0, 1, 4294967295];
    expect(decodePackedUint32(encodePackedUint32(vals))).toEqual(vals);
  });

  it('uint64', () => {
    const vals = [0n, 18446744073709551615n];
    expect(decodePackedUint64(encodePackedUint64(vals))).toEqual(vals);
  });

  it('sint32 (ZigZag)', () => {
    const vals = [0, -1, 1, -100, 100];
    expect(decodePackedSint32(encodePackedSint32(vals))).toEqual(vals);
  });

  it('sint64 (ZigZag)', () => {
    const vals = [0n, -1n, 9223372036854775807n, -9223372036854775808n];
    expect(decodePackedSint64(encodePackedSint64(vals))).toEqual(vals);
  });

  it('bool', () => {
    const vals = [true, false, true, true];
    expect(decodePackedBool(encodePackedBool(vals))).toEqual(vals);
  });

  it('enum', () => {
    const vals = [0, 1, 2, -1];
    expect(decodePackedEnum(encodePackedEnum(vals))).toEqual(vals);
  });

  it('float', () => {
    const vals = [0, 1.5, -2.25, 100];
    expect(decodePackedFloat(encodePackedFloat(vals))).toEqual(vals);
  });

  it('fixed32', () => {
    const vals = [0, 1, 4294967295];
    expect(decodePackedFixed32(encodePackedFixed32(vals))).toEqual(vals);
  });

  it('sfixed32', () => {
    const vals = [0, -1, 2147483647, -2147483648];
    expect(decodePackedSfixed32(encodePackedSfixed32(vals))).toEqual(vals);
  });

  it('double', () => {
    const vals = [0, 1.5, -2.5, 1e300];
    expect(decodePackedDouble(encodePackedDouble(vals))).toEqual(vals);
  });

  it('fixed64', () => {
    const vals = [0n, 1n, 18446744073709551615n];
    expect(decodePackedFixed64(encodePackedFixed64(vals))).toEqual(vals);
  });

  it('sfixed64', () => {
    const vals = [0n, -1n, 9223372036854775807n, -9223372036854775808n];
    expect(decodePackedSfixed64(encodePackedSfixed64(vals))).toEqual(vals);
  });
});

describe('packed field in a message', () => {
  it('wraps a packed payload in a length-delimited field', () => {
    // field 4, packed repeated int32 = [3, 270, 86942]
    const payload = encodePackedInt32([3, 270, 86942]);
    const buf = encodeFields([
      { fieldNumber: 4, wireType: WireType.Bytes, bytes: payload },
    ]);
    // 22 (tag 4|LEN) 06 (len) 03 8e02 9ea705
    expect(buf.toString('hex')).toBe('2206038e029ea705');
  });
});

describe('Uint8Array input is accepted everywhere', () => {
  it('decodeFields / decodeTree accept a Uint8Array', () => {
    // field 1, varint = 1  →  bytes [0x08, 0x01]
    const u8 = new Uint8Array([0x08, 0x01]);
    expect(decodeFields(u8)[0].varint).toBe(1n);
    expect(decodeTree(u8)[0].fieldNumber).toBe(1);
  });

  it('unpackVarints / unpackFixed32 / unpackFixed64 accept a Uint8Array', () => {
    expect(unpackVarints(new Uint8Array(packVarints([5n])))).toEqual([5n]);
    expect(unpackFixed32(new Uint8Array(packFixed32([7])))).toEqual([7]);
    expect(unpackFixed64(new Uint8Array(packFixed64([9n])))).toEqual([9n]);
  });
});
