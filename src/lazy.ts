/**
 * Lazy, index-header decoding.
 *
 * {@link lazyIndex} scans a protobuf buffer once (in Rust) and returns a
 * {@link LazyMessage}: the original bytes plus a flat offset table. Reading a
 * field then happens entirely in JS, directly over the buffer, in O(1) — no
 * further FFI crossing and no per-field object allocation.
 *
 * This is the fast path for **sparse, routing-heavy** access (WhatsApp's
 * `Message` has 100+ optional fields but only 1–3 are present, and servers
 * often inspect just the key/timestamp): decode only what you read.
 *
 * For reading a whole message into an object, `decodeFields` is still available.
 */

import { asBool, asString, asUint32 } from './helpers';
import { native } from './native';

/** Wire type discriminants (mirror of the native constants). */
const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

/** Number of u32 slots per index entry: [fieldNumber, wireType, offset, length]. */
const STRIDE = 4;

/**
 * A parsed index over a protobuf buffer. Construct via {@link lazyIndex}.
 *
 * The buffer is scanned once; individual field values are decoded only when a
 * getter is called, reading straight from the underlying bytes.
 */
export class LazyMessage {
  /** @internal */
  constructor(
    private readonly buf: Buffer,
    /** Flat table: [fieldNumber, wireType, offset, length] × N. */
    private readonly index: Uint32Array,
  ) {}

  /** Number of top-level fields present (counting repeated occurrences). */
  get fieldCount(): number {
    return this.index.length / STRIDE;
  }

  /** Whether at least one field with `fieldNumber` is present. */
  has(fieldNumber: number): boolean {
    return this.slotOf(fieldNumber) >= 0;
  }

  /**
   * Read a varint field as a raw bigint (first occurrence), or `null` if absent.
   * Wrap with `asUint32` / `asBool` / `asSint64` etc. for logical types — or use
   * the typed getters below.
   */
  getVarint(fieldNumber: number): bigint | null {
    const slot = this.slotOf(fieldNumber);
    if (slot < 0 || this.index[slot + 1] !== WIRE_VARINT) return null;
    return this.readVarintAt(this.index[slot + 2]!, this.index[slot + 3]!);
  }

  /** Read a varint field as a uint32, or `null` if absent. */
  getUint32(fieldNumber: number): number | null {
    const raw = this.getVarint(fieldNumber);
    return raw === null ? null : asUint32(raw);
  }

  /** Read a varint field as a boolean, or `null` if absent. */
  getBool(fieldNumber: number): boolean | null {
    const raw = this.getVarint(fieldNumber);
    return raw === null ? null : asBool(raw);
  }

  /** Read a length-delimited field as raw bytes (a view — copy if retained). */
  getBytes(fieldNumber: number): Buffer | null {
    const slot = this.slotOf(fieldNumber);
    if (slot < 0 || this.index[slot + 1] !== WIRE_BYTES) return null;
    const offset = this.index[slot + 2]!;
    const length = this.index[slot + 3]!;
    return this.buf.subarray(offset, offset + length);
  }

  /** Read a length-delimited field as a UTF-8 string, or `null` if absent. */
  getString(fieldNumber: number): string | null {
    const bytes = this.getBytes(fieldNumber);
    return bytes === null ? null : asString(bytes);
  }

  /** Read a fixed32 field as an unsigned 32-bit integer, or `null` if absent. */
  getFixed32(fieldNumber: number): number | null {
    const slot = this.slotOf(fieldNumber);
    if (slot < 0 || this.index[slot + 1] !== WIRE_FIXED32) return null;
    return this.buf.readUInt32LE(this.index[slot + 2]!);
  }

  /** Read a fixed64 field as an unsigned 64-bit bigint, or `null` if absent. */
  getFixed64(fieldNumber: number): bigint | null {
    const slot = this.slotOf(fieldNumber);
    if (slot < 0 || this.index[slot + 1] !== WIRE_FIXED64) return null;
    return this.buf.readBigUInt64LE(this.index[slot + 2]!);
  }

  /**
   * Index a submessage field in place: returns a new {@link LazyMessage} over
   * the length-delimited value of `fieldNumber`, or `null` if absent. One pass
   * per level, no unbounded recursion.
   */
  getMessage(fieldNumber: number): LazyMessage | null {
    const sub = this.getBytes(fieldNumber);
    return sub === null ? null : lazyIndex(sub);
  }

  /** Field numbers present, in first-seen order (deduplicated). */
  fieldNumbers(): number[] {
    const seen = new Set<number>();
    const out: number[] = [];
    for (let i = 0; i < this.index.length; i += STRIDE) {
      const fn = this.index[i]!;
      if (!seen.has(fn)) {
        seen.add(fn);
        out.push(fn);
      }
    }
    return out;
  }

  /** Return the base offset into the index array for `fieldNumber`, or -1. */
  private slotOf(fieldNumber: number): number {
    for (let i = 0; i < this.index.length; i += STRIDE) {
      if (this.index[i] === fieldNumber) return i;
    }
    return -1;
  }

  /** Decode a LEB128 varint from the buffer at [offset, offset+length). */
  private readVarintAt(offset: number, length: number): bigint {
    let result = 0n;
    let shift = 0n;
    for (let i = 0; i < length; i++) {
      const byte = this.buf[offset + i]!;
      result |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
    }
    return result;
  }
}

/**
 * Scan `buf` once and return a {@link LazyMessage} for O(1) field reads.
 *
 * @param buf - The protobuf-encoded message.
 * @throws If the buffer is malformed (propagates the native decode error).
 */
export function lazyIndex(buf: Buffer): LazyMessage {
  return new LazyMessage(buf, native.indexFieldsJs(buf));
}
