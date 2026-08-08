/**
 * Typed packed-repeated helpers.
 *
 * These build on two lower layers:
 * - the Rust packing engine (`packVarints`/`packFixed32`/`packFixed64` and their
 *   `unpack*` counterparts), which does the physical work; and
 * - the logical-type helpers (`fromInt32`, `asSint64`, …), which map a protobuf
 *   logical type to/from a raw wire value.
 *
 * The result is one `encodePacked*` / `decodePacked*` pair per packable protobuf
 * type. Each returns the raw payload `Buffer` (for `encode*`) or the decoded
 * values (for `decode*`); wrap the payload in a length-delimited field with
 * `encodeFields` to place it in a message.
 *
 * @packageDocumentation
 */

import {
  asBool,
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
  asUint32,
  asUint64,
  fromBool,
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
  fromUint32,
  fromUint64,
} from './helpers';
import {
  packFixed32,
  packFixed64,
  packVarints,
  unpackFixed32,
  unpackFixed64,
  unpackVarints,
} from './index';

// ─── Varint-based packed types ───────────────────────────────────────────────

/** Pack a `repeated int32 [packed=true]` payload. */
export function encodePackedInt32(values: number[]): Buffer {
  return packVarints(values.map(fromInt32));
}
/** Decode a packed `int32` payload. */
export function decodePackedInt32(buf: Buffer | Uint8Array): number[] {
  return unpackVarints(buf).map(asInt32);
}

/** Pack a `repeated int64 [packed=true]` payload. */
export function encodePackedInt64(values: bigint[]): Buffer {
  return packVarints(values.map(fromInt64));
}
/** Decode a packed `int64` payload. */
export function decodePackedInt64(buf: Buffer | Uint8Array): bigint[] {
  return unpackVarints(buf).map(asInt64);
}

/** Pack a `repeated uint32 [packed=true]` payload. */
export function encodePackedUint32(values: number[]): Buffer {
  return packVarints(values.map(fromUint32));
}
/** Decode a packed `uint32` payload. */
export function decodePackedUint32(buf: Buffer | Uint8Array): number[] {
  return unpackVarints(buf).map(asUint32);
}

/** Pack a `repeated uint64 [packed=true]` payload. */
export function encodePackedUint64(values: bigint[]): Buffer {
  return packVarints(values.map(fromUint64));
}
/** Decode a packed `uint64` payload. */
export function decodePackedUint64(buf: Buffer | Uint8Array): bigint[] {
  return unpackVarints(buf).map(asUint64);
}

/** Pack a `repeated sint32 [packed=true]` payload (ZigZag). */
export function encodePackedSint32(values: number[]): Buffer {
  return packVarints(values.map(fromSint32));
}
/** Decode a packed `sint32` payload (ZigZag). */
export function decodePackedSint32(buf: Buffer | Uint8Array): number[] {
  return unpackVarints(buf).map(asSint32);
}

/** Pack a `repeated sint64 [packed=true]` payload (ZigZag). */
export function encodePackedSint64(values: bigint[]): Buffer {
  return packVarints(values.map(fromSint64));
}
/** Decode a packed `sint64` payload (ZigZag). */
export function decodePackedSint64(buf: Buffer | Uint8Array): bigint[] {
  return unpackVarints(buf).map(asSint64);
}

/** Pack a `repeated bool [packed=true]` payload. */
export function encodePackedBool(values: boolean[]): Buffer {
  return packVarints(values.map(fromBool));
}
/** Decode a packed `bool` payload. */
export function decodePackedBool(buf: Buffer | Uint8Array): boolean[] {
  return unpackVarints(buf).map(asBool);
}

/** Pack a `repeated <enum> [packed=true]` payload. */
export function encodePackedEnum(values: number[]): Buffer {
  return packVarints(values.map(fromEnum));
}
/** Decode a packed enum payload. */
export function decodePackedEnum(buf: Buffer | Uint8Array): number[] {
  return unpackVarints(buf).map(asEnum);
}

// ─── Fixed32-based packed types ──────────────────────────────────────────────

/** Pack a `repeated float [packed=true]` payload. */
export function encodePackedFloat(values: number[]): Buffer {
  return packFixed32(values.map(fromFloat));
}
/** Decode a packed `float` payload. */
export function decodePackedFloat(buf: Buffer | Uint8Array): number[] {
  return unpackFixed32(buf).map(asFloat);
}

/** Pack a `repeated fixed32 [packed=true]` payload. */
export function encodePackedFixed32(values: number[]): Buffer {
  return packFixed32(values.map(fromFixed32));
}
/** Decode a packed `fixed32` payload. */
export function decodePackedFixed32(buf: Buffer | Uint8Array): number[] {
  return unpackFixed32(buf).map(asFixed32);
}

/** Pack a `repeated sfixed32 [packed=true]` payload. */
export function encodePackedSfixed32(values: number[]): Buffer {
  return packFixed32(values.map(fromSfixed32));
}
/** Decode a packed `sfixed32` payload. */
export function decodePackedSfixed32(buf: Buffer | Uint8Array): number[] {
  return unpackFixed32(buf).map(asSfixed32);
}

// ─── Fixed64-based packed types ──────────────────────────────────────────────

/** Pack a `repeated double [packed=true]` payload. */
export function encodePackedDouble(values: number[]): Buffer {
  return packFixed64(values.map(fromDouble));
}
/** Decode a packed `double` payload. */
export function decodePackedDouble(buf: Buffer | Uint8Array): number[] {
  return unpackFixed64(buf).map(asDouble);
}

/** Pack a `repeated fixed64 [packed=true]` payload. */
export function encodePackedFixed64(values: bigint[]): Buffer {
  return packFixed64(values.map(fromFixed64));
}
/** Decode a packed `fixed64` payload. */
export function decodePackedFixed64(buf: Buffer | Uint8Array): bigint[] {
  return unpackFixed64(buf).map(asFixed64);
}

/** Pack a `repeated sfixed64 [packed=true]` payload. */
export function encodePackedSfixed64(values: bigint[]): Buffer {
  return packFixed64(values.map(fromSfixed64));
}
/** Decode a packed `sfixed64` payload. */
export function decodePackedSfixed64(buf: Buffer | Uint8Array): bigint[] {
  return unpackFixed64(buf).map(asSfixed64);
}
