/**
 * Tests for @brashkie/signalis-codec.
 *
 * These run against the REAL native addon (built by `npm run build:native`),
 * so they require the Rust core to be compiled first. They verify the wire
 * format byte-for-byte against values from the protobuf specification.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_DEPTH,
  WireType,
  decodeFields,
  decodeTree,
  encodeFields,
  fieldKey,
  zigzagDecode,
  zigzagEncode,
} from '../src';

describe('encodeFields / decodeFields round-trip', () => {
  it('encodes a varint field to the canonical bytes (150 → 08 96 01)', () => {
    const buf = encodeFields([
      { fieldNumber: 1, wireType: WireType.Varint, varint: 150n },
    ]);
    expect(buf.toString('hex')).toBe('089601');
  });

  it('round-trips all four wire types', () => {
    const buf = encodeFields([
      { fieldNumber: 1, wireType: WireType.Varint, varint: 150n },
      { fieldNumber: 2, wireType: WireType.Bytes, bytes: Buffer.from('hello') },
      { fieldNumber: 3, wireType: WireType.Fixed32, fixed32: 0xdeadbeef },
      { fieldNumber: 4, wireType: WireType.Fixed64, varint: 0x0102030405060708n },
    ]);

    const fields = decodeFields(buf);
    expect(fields).toHaveLength(4);

    expect(fields[0]).toMatchObject({
      fieldNumber: 1,
      wireType: WireType.Varint,
      varint: 150n,
    });
    expect(fields[1].fieldNumber).toBe(2);
    expect(fields[1].bytes?.toString()).toBe('hello');
    expect(fields[2]).toMatchObject({ fieldNumber: 3, fixed32: 0xdeadbeef });
    expect(fields[3].varint).toBe(0x0102030405060708n);
  });

  it('preserves full 64-bit varints via BigInt', () => {
    const big = 18446744073709551615n; // u64::MAX
    const buf = encodeFields([
      { fieldNumber: 7, wireType: WireType.Varint, varint: big },
    ]);
    const [field] = decodeFields(buf);
    expect(field.varint).toBe(big);
  });

  it('accepts Uint8Array input for bytes fields', () => {
    const buf = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: new Uint8Array([1, 2, 3]) },
    ]);
    const [field] = decodeFields(buf);
    expect([...(field.bytes ?? [])]).toEqual([1, 2, 3]);
  });
});

describe('malformed input handling', () => {
  it('throws on a truncated varint field', () => {
    expect(() => decodeFields(Buffer.from([0x08]))).toThrow();
  });

  it('throws on field number zero', () => {
    expect(() => decodeFields(Buffer.from([0x00, 0x00]))).toThrow();
  });

  it('throws on group wire types (3/4)', () => {
    // field 1, wire type 3 (start group) = 0x0b
    expect(() => decodeFields(Buffer.from([0x0b]))).toThrow();
  });
});

describe('decodeTree with depth limiting', () => {
  function nest(levels: number): Buffer {
    let payload = encodeFields([
      { fieldNumber: 1, wireType: WireType.Varint, varint: 42n },
    ]);
    for (let i = 0; i < levels; i++) {
      payload = encodeFields([
        { fieldNumber: 1, wireType: WireType.Bytes, bytes: payload },
      ]);
    }
    return payload;
  }

  it('descends into submessages', () => {
    const buf = nest(3);
    const tree = decodeTree(buf, 100);
    expect(tree[0].kind).toBe('message');
  });

  it('throws when nesting exceeds maxDepth', () => {
    const buf = nest(50);
    expect(() => decodeTree(buf, 5)).toThrow(/depth/i);
  });

  it('does NOT silently fall back to bytes when depth is exceeded', () => {
    // Regression guard: a depth violation must propagate as an error, never be
    // swallowed and returned as an opaque `bytes` node.
    const buf = nest(50);
    let threw = false;
    try {
      decodeTree(buf, 5);
    } catch (e) {
      threw = true;
      expect(String(e)).toMatch(/depth/i);
    }
    expect(threw).toBe(true);
  });

  it('accepts deep nesting under a generous limit', () => {
    const buf = nest(50);
    expect(() => decodeTree(buf, 100)).not.toThrow();
  });

  it('uses DEFAULT_MAX_DEPTH when none is given', () => {
    expect(DEFAULT_MAX_DEPTH).toBe(100);
    const buf = nest(3);
    expect(() => decodeTree(buf)).not.toThrow();
  });
});

describe('zigzag', () => {
  it('matches the protobuf spec values', () => {
    expect(zigzagEncode(0n)).toBe(0n);
    expect(zigzagEncode(-1n)).toBe(1n);
    expect(zigzagEncode(1n)).toBe(2n);
    expect(zigzagEncode(-2n)).toBe(3n);
    expect(zigzagEncode(2147483647n)).toBe(4294967294n);
  });

  it('round-trips signed values', () => {
    for (const v of [
      0n,
      -1n,
      1n,
      -2n,
      2n,
      -2147483648n,
      9223372036854775807n,
      -9223372036854775808n,
    ]) {
      expect(zigzagDecode(zigzagEncode(v))).toBe(v);
    }
  });
});

describe('fieldKey', () => {
  it('computes canonical tags', () => {
    expect(fieldKey(1, WireType.Varint)).toBe(0x08);
    expect(fieldKey(2, WireType.Bytes)).toBe(0x12);
    expect(fieldKey(3, WireType.Fixed32)).toBe(0x1d);
  });
});
