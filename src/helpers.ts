/**
 * Logical-type helpers for the protobuf wire codec.
 *
 * The wire codec only knows four physical wire types (varint, fixed32, fixed64,
 * bytes). The *logical* type of a field (int32 vs sint32 vs bool vs enum …)
 * lives in the schema, not in the bytes — so decoding returns raw values and
 * these helpers interpret them.
 *
 * - `as*` read: raw wire value → logical value.
 * - `from*` write: logical value → raw wire value, **range-checked** (throws
 *   `RangeError` rather than silently truncating).
 *
 * All conversions are verified byte-for-byte against the reference protobuf
 * implementation, including the tricky cases (negative `int32` encoding as a
 * 10-byte varint, zigzag, IEEE-754).
 *
 * @packageDocumentation
 */

const U64_MASK = (1n << 64n) - 1n;
const U32_MASK = 0xffffffffn;

const I32_MIN = -0x80000000n;
const I32_MAX = 0x7fffffffn;
const U32_MAX = 0xffffffffn;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const U64_MAX = U64_MASK;

function checkRange(value: bigint, min: bigint, max: bigint, type: string): void {
  if (value < min || value > max) {
    throw new RangeError(`value ${value} is out of ${type} range [${min}, ${max}]`);
  }
}

// ─── Reading: raw varint → logical (varint fields carry `varint: bigint`) ────

/** Interpret a varint as `int32`. Handles the 10-byte negative encoding. */
export function asInt32(raw: bigint): number {
  const low = raw & U32_MASK;
  return Number(low >= 0x80000000n ? low - 0x100000000n : low);
}

/** Interpret a varint as `int64` (returned as `bigint`). */
export function asInt64(raw: bigint): bigint {
  const v = raw & U64_MASK;
  return v >= 1n << 63n ? v - (1n << 64n) : v;
}

/** Interpret a varint as `uint32`. */
export function asUint32(raw: bigint): number {
  return Number(raw & U32_MASK);
}

/** Interpret a varint as `uint64` (returned as `bigint`). */
export function asUint64(raw: bigint): bigint {
  return raw & U64_MASK;
}

/** Interpret a varint as `sint32` (ZigZag). */
export function asSint32(raw: bigint): number {
  const v = raw & U32_MASK;
  return Number((v >> 1n) ^ -(v & 1n));
}

/** Interpret a varint as `sint64` (ZigZag, returned as `bigint`). */
export function asSint64(raw: bigint): bigint {
  const v = raw & U64_MASK;
  return (v >> 1n) ^ -(v & 1n);
}

/** Interpret a varint as `bool`. */
export function asBool(raw: bigint): boolean {
  return raw !== 0n;
}

/** Interpret a varint as an `enum` value (a plain 32-bit signed int). */
export function asEnum(raw: bigint): number {
  return asInt32(raw);
}

// ─── Reading: fixed32 → logical (fixed32 fields carry `fixed32: number`) ─────

/** Interpret a fixed32 as `float` (IEEE-754 single precision). */
export function asFloat(raw: number): number {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(raw >>> 0, 0);
  return buf.readFloatLE(0);
}

/** Interpret a fixed32 as `fixed32` (unsigned 32-bit). */
export function asFixed32(raw: number): number {
  return raw >>> 0;
}

/** Interpret a fixed32 as `sfixed32` (signed 32-bit). */
export function asSfixed32(raw: number): number {
  return raw | 0;
}

// ─── Reading: fixed64 → logical (fixed64 fields carry `varint: bigint`) ──────

/** Interpret a fixed64 as `double` (IEEE-754 double precision). */
export function asDouble(raw: bigint): number {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(raw & U64_MASK, 0);
  return buf.readDoubleLE(0);
}

/** Interpret a fixed64 as `fixed64` (unsigned, returned as `bigint`). */
export function asFixed64(raw: bigint): bigint {
  return raw & U64_MASK;
}

/** Interpret a fixed64 as `sfixed64` (signed, returned as `bigint`). */
export function asSfixed64(raw: bigint): bigint {
  const v = raw & U64_MASK;
  return v >= 1n << 63n ? v - (1n << 64n) : v;
}

// ─── Reading: bytes → logical (bytes fields carry `bytes: Buffer`) ───────────

/** Decode bytes as a UTF-8 `string`. */
export function asString(raw: Buffer | Uint8Array): string {
  return Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw).toString('utf8');
}

/** Return the raw `bytes` as a Buffer (identity, for API symmetry). */
export function asBytes(raw: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}

// ─── Writing: logical → raw varint (range-checked) ───────────────────────────

/** Encode an `int32` to its raw varint value (negatives use the 64-bit form). */
export function fromInt32(value: number): bigint {
  const v = BigInt(value);
  checkRange(v, I32_MIN, I32_MAX, 'int32');
  return v & U64_MASK;
}

/** Encode an `int64` to its raw varint value. */
export function fromInt64(value: bigint): bigint {
  checkRange(value, I64_MIN, I64_MAX, 'int64');
  return value & U64_MASK;
}

/** Encode a `uint32` to its raw varint value. */
export function fromUint32(value: number): bigint {
  const v = BigInt(value);
  checkRange(v, 0n, U32_MAX, 'uint32');
  return v;
}

/** Encode a `uint64` to its raw varint value. */
export function fromUint64(value: bigint): bigint {
  checkRange(value, 0n, U64_MAX, 'uint64');
  return value;
}

/** Encode a `sint32` to its raw varint value (ZigZag). */
export function fromSint32(value: number): bigint {
  const v = BigInt(value);
  checkRange(v, I32_MIN, I32_MAX, 'sint32');
  return ((v << 1n) ^ (v >> 31n)) & U32_MASK;
}

/** Encode a `sint64` to its raw varint value (ZigZag). */
export function fromSint64(value: bigint): bigint {
  checkRange(value, I64_MIN, I64_MAX, 'sint64');
  return ((value << 1n) ^ (value >> 63n)) & U64_MASK;
}

/** Encode a `bool` to its raw varint value. */
export function fromBool(value: boolean): bigint {
  return value ? 1n : 0n;
}

/** Encode an `enum` value to its raw varint value. */
export function fromEnum(value: number): bigint {
  return fromInt32(value);
}

// ─── Writing: logical → raw fixed32 ──────────────────────────────────────────

/** Encode a `float` to its raw fixed32 value (IEEE-754 single precision). */
export function fromFloat(value: number): number {
  const buf = Buffer.allocUnsafe(4);
  buf.writeFloatLE(value, 0);
  return buf.readUInt32LE(0);
}

/** Encode a `fixed32` (unsigned 32-bit) to its raw value. */
export function fromFixed32(value: number): number {
  const v = BigInt(value);
  checkRange(v, 0n, U32_MAX, 'fixed32');
  return Number(v);
}

/** Encode an `sfixed32` (signed 32-bit) to its raw value. */
export function fromSfixed32(value: number): number {
  const v = BigInt(value);
  checkRange(v, I32_MIN, I32_MAX, 'sfixed32');
  return Number(v & U32_MASK);
}

// ─── Writing: logical → raw fixed64 (as bigint) ──────────────────────────────

/** Encode a `double` to its raw fixed64 value (IEEE-754 double precision). */
export function fromDouble(value: number): bigint {
  const buf = Buffer.allocUnsafe(8);
  buf.writeDoubleLE(value, 0);
  return buf.readBigUInt64LE(0);
}

/** Encode a `fixed64` (unsigned) to its raw value. */
export function fromFixed64(value: bigint): bigint {
  checkRange(value, 0n, U64_MAX, 'fixed64');
  return value;
}

/** Encode an `sfixed64` (signed) to its raw value. */
export function fromSfixed64(value: bigint): bigint {
  checkRange(value, I64_MIN, I64_MAX, 'sfixed64');
  return value & U64_MASK;
}

// ─── Writing: logical → raw bytes ────────────────────────────────────────────

/** Encode a `string` to UTF-8 bytes. */
export function fromString(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

/** Return `bytes` as a Buffer (identity, for API symmetry). */
export function fromBytes(value: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}
