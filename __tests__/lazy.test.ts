import { describe, it, expect } from 'vitest';

import {
  lazyIndex,
  encodeFields,
  WireType,
  fromUint32,
  fromString,
  fromBool,
} from '../src';

describe('lazyIndex / LazyMessage', () => {
  const buf = encodeFields([
    { fieldNumber: 1, wireType: WireType.Varint, varint: fromUint32(1789098857) },
    { fieldNumber: 2, wireType: WireType.Varint, varint: fromBool(true) },
    { fieldNumber: 3, wireType: WireType.Bytes, bytes: fromString('5493511234567@s.whatsapp.net') },
    { fieldNumber: 4, wireType: WireType.Bytes, bytes: fromString('Brashkie') },
    { fieldNumber: 5, wireType: WireType.Fixed32, fixed32: 0xdeadbeef },
  ]);

  it('reports the field count and presence', () => {
    const m = lazyIndex(buf);
    expect(m.fieldCount).toBe(5);
    expect(m.has(3)).toBe(true);
    expect(m.has(99)).toBe(false);
  });

  it('reads varint fields (uint32, bool) on demand', () => {
    const m = lazyIndex(buf);
    expect(m.getUint32(1)).toBe(1789098857);
    expect(m.getBool(2)).toBe(true);
  });

  it('reads string fields on demand', () => {
    const m = lazyIndex(buf);
    expect(m.getString(3)).toBe('5493511234567@s.whatsapp.net');
    expect(m.getString(4)).toBe('Brashkie');
  });

  it('reads fixed32 fields', () => {
    const m = lazyIndex(buf);
    expect(m.getFixed32(5)).toBe(0xdeadbeef);
  });

  it('returns null for absent fields', () => {
    const m = lazyIndex(buf);
    expect(m.getString(99)).toBeNull();
    expect(m.getUint32(99)).toBeNull();
    expect(m.getBool(99)).toBeNull();
  });

  it('returns null on wire-type mismatch', () => {
    const m = lazyIndex(buf);
    // Field 3 is bytes, not a varint.
    expect(m.getUint32(3)).toBeNull();
    // Field 1 is a varint, not bytes.
    expect(m.getString(1)).toBeNull();
  });

  it('lists field numbers in order', () => {
    const m = lazyIndex(buf);
    expect(m.fieldNumbers()).toEqual([1, 2, 3, 4, 5]);
  });

  it('indexes submessages in place', () => {
    const inner = encodeFields([
      { fieldNumber: 1, wireType: WireType.Bytes, bytes: fromString('inner') },
    ]);
    const outer = encodeFields([
      { fieldNumber: 7, wireType: WireType.Bytes, bytes: inner },
    ]);
    const m = lazyIndex(outer);
    const sub = m.getMessage(7);
    expect(sub).not.toBeNull();
    expect(sub!.getString(1)).toBe('inner');
  });

  it('handles an empty buffer', () => {
    const m = lazyIndex(Buffer.alloc(0));
    expect(m.fieldCount).toBe(0);
    expect(m.has(1)).toBe(false);
  });

  it('agrees with a full decode on values', () => {
    const m = lazyIndex(buf);
    // Reading lazily must match what the fields encode to.
    expect(m.getUint32(1)).toBe(1789098857);
    expect(m.getString(3)).toBe('5493511234567@s.whatsapp.net');
  });
});
