import { describe, expect, it } from 'vitest';

import { WireType, encodeFields, fromString, fromUint32, lazyIndex } from '../src';

describe('LazyMessage — repeated fields', () => {
  it('getAllStrings reads every occurrence of a repeated string', () => {
    // field 1 repeated 3 times (like ContextInfo.mentionedJid)
    const buf = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('a@s.whatsapp.net') },
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('b@s.whatsapp.net') },
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('c@s.whatsapp.net') },
    ]);
    const m = lazyIndex(buf);
    expect(m.getAllStrings(1)).toEqual([
      'a@s.whatsapp.net',
      'b@s.whatsapp.net',
      'c@s.whatsapp.net',
    ]);
    expect(m.count(1)).toBe(3);
    // The single-value getter still returns the first, unchanged:
    expect(m.getString(1)).toBe('a@s.whatsapp.net');
  });

  it('getAllVarints / getAllUint32 read repeated numerics (unpacked)', () => {
    const buf = encodeFields([
      { fieldNumber: 2, wireType: WireType.Varint, varint: fromUint32(10) },
      { fieldNumber: 2, wireType: WireType.Varint, varint: fromUint32(20) },
      { fieldNumber: 2, wireType: WireType.Varint, varint: fromUint32(30) },
    ]);
    const m = lazyIndex(buf);
    expect(m.getAllVarints(2)).toEqual([10n, 20n, 30n]);
    expect(m.getAllUint32(2)).toEqual([10, 20, 30]);
    expect(m.count(2)).toBe(3);
  });

  it('getAllMessages reads repeated submessages, each lazily', () => {
    const sub1 = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('uno') },
    ]);
    const sub2 = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('dos') },
    ]);
    const buf = encodeFields([
      { fieldNumber: 5, wireType: WireType.Bytes, bytes: sub1 },
      { fieldNumber: 5, wireType: WireType.Bytes, bytes: sub2 },
    ]);
    const m = lazyIndex(buf);
    const subs = m.getAllMessages(5);
    expect(subs).toHaveLength(2);
    expect(subs[0]!.getString(1)).toBe('uno');
    expect(subs[1]!.getString(1)).toBe('dos');
  });

  it('getAllBytes returns views over the buffer', () => {
    const buf = encodeFields([
      { fieldNumber: 3, wireType: WireType.Bytes, bytes: Buffer.from([1, 2]) },
      { fieldNumber: 3, wireType: WireType.Bytes, bytes: Buffer.from([3, 4]) },
    ]);
    const all = lazyIndex(buf).getAllBytes(3);
    expect(all).toHaveLength(2);
    expect(all[0]!.equals(Buffer.from([1, 2]))).toBe(true);
    expect(all[1]!.equals(Buffer.from([3, 4]))).toBe(true);
  });

  it('returns empty arrays / zero count for absent fields', () => {
    const buf = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('x') },
    ]);
    const m = lazyIndex(buf);
    expect(m.getAllStrings(99)).toEqual([]);
    expect(m.getAllVarints(99)).toEqual([]);
    expect(m.getAllMessages(99)).toEqual([]);
    expect(m.count(99)).toBe(0);
  });

  it('a single occurrence yields a one-element array', () => {
    const buf = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('solo') },
    ]);
    const m = lazyIndex(buf);
    expect(m.getAllStrings(1)).toEqual(['solo']);
    expect(m.count(1)).toBe(1);
  });
});

describe('LazyMessage — fixed32 / fixed64 (coverage for existing getters)', () => {
  it('getFixed32 reads a fixed32 field', () => {
    const buf = encodeFields([
      { fieldNumber: 3, wireType: WireType.Fixed32, fixed32: 0xdeadbeef },
    ]);
    const m = lazyIndex(buf);
    expect(m.getFixed32(3)).toBe(0xdeadbeef);
    expect(m.getFixed32(99)).toBeNull();
    // wire-type mismatch → null
    const s = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('x') },
    ]);
    expect(lazyIndex(s).getFixed32(1)).toBeNull();
  });

  it('getFixed64 reads a fixed64 field', () => {
    const buf = encodeFields([
      { fieldNumber: 4, wireType: WireType.Fixed64, varint: 1234567890123n },
    ]);
    const m = lazyIndex(buf);
    expect(m.getFixed64(4)).toBe(1234567890123n);
    expect(m.getFixed64(99)).toBeNull();
    // wire-type mismatch → null
    const s = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('x') },
    ]);
    expect(lazyIndex(s).getFixed64(1)).toBeNull();
  });
});
