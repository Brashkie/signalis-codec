/**
 * `@brashkie/signalis-codec`
 *
 * A safe, Rust-powered protobuf **wire codec** (Level 1). It reads and writes
 * protobuf's four wire types with strict bounds-checking and configurable
 * nesting-depth limits — the defense against the Proto6 recursion class of DoS.
 *
 * It is schema-agnostic: you work with field numbers and wire types, not named
 * messages. A higher layer (e.g. `@brashkie/waproto`) maps field numbers to
 * WhatsApp's schema.
 *
 * @packageDocumentation
 */

import { native } from './native';

/**
 * Protobuf wire types.
 *
 * - `Varint` (0): int32/64, uint32/64, sint*, bool, enum
 * - `Fixed64` (1): fixed64, sfixed64, double
 * - `Bytes` (2): string, bytes, embedded messages, packed repeated
 * - `Fixed32` (5): fixed32, sfixed32, float
 */
export enum WireType {
  Varint = 0,
  Fixed64 = 1,
  Bytes = 2,
  Fixed32 = 5,
}

/** A single field decoded from a protobuf buffer. */
export interface DecodedField {
  /** The field number (tag). */
  fieldNumber: number;
  /** The wire type of this field. */
  wireType: WireType;
  /** Present for `Varint` and `Fixed64` — a BigInt to preserve all 64 bits. */
  varint?: bigint;
  /** Present for `Fixed32`. */
  fixed32?: number;
  /** Present for `Bytes`. */
  bytes?: Buffer;
}

/** A field to encode. Populate the value matching `wireType`. */
export interface FieldInput {
  fieldNumber: number;
  wireType: WireType;
  varint?: bigint;
  fixed32?: number;
  bytes?: Buffer | Uint8Array;
}

/** The kind of a node in a recursively-decoded tree. */
export type NodeKind = 'varint' | 'fixed64' | 'fixed32' | 'bytes' | 'message';

/** A node in a recursively-decoded protobuf tree. */
export interface TreeNode {
  fieldNumber: number;
  kind: NodeKind;
  varint?: bigint;
  fixed32?: number;
  bytes?: Buffer;
  message?: TreeNode[];
}

/**
 * The default maximum nesting depth for {@link decodeTree}. WhatsApp's real
 * messages nest only a handful of levels; 100 is comfortably above any
 * legitimate payload while stopping the tens-of-thousands-deep attack payloads.
 */
export const DEFAULT_MAX_DEPTH = 100;

/**
 * Decode a protobuf buffer into a flat list of fields (no recursion).
 *
 * Length-delimited fields come back as raw `bytes`. If you know a field holds a
 * submessage, call `decodeFields` again on its bytes, or use {@link decodeTree}
 * for a bounded recursive decode.
 *
 * @throws if the buffer is malformed (truncated, bad wire type, field 0, …).
 */
export function decodeFields(buf: Buffer | Uint8Array): DecodedField[] {
  const input = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return native.decodeFieldsJs(input);
}

/**
 * Encode a list of fields into a protobuf buffer.
 *
 * @throws if a field's value doesn't match its declared wire type.
 */
export function encodeFields(fields: FieldInput[]): Buffer {
  const normalized = fields.map((f) => ({
    ...f,
    bytes: f.bytes
      ? Buffer.isBuffer(f.bytes)
        ? f.bytes
        : Buffer.from(f.bytes)
      : undefined,
  }));
  return native.encodeFieldsJs(normalized);
}

/**
 * Recursively decode a buffer into a tree, descending into length-delimited
 * fields that parse cleanly as submessages, bounded by `maxDepth`.
 *
 * Exceeding `maxDepth` throws rather than overflowing the stack — the core
 * anti-DoS guarantee of this package.
 *
 * @param buf the protobuf bytes
 * @param maxDepth maximum nesting depth (default {@link DEFAULT_MAX_DEPTH})
 * @throws if malformed or if the depth limit is exceeded
 */
export function decodeTree(
  buf: Buffer | Uint8Array,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): TreeNode[] {
  const input = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return native.decodeTreeJs(input, maxDepth);
}

/** ZigZag-encode a signed integer (for `sint32` / `sint64`). */
export function zigzagEncode(value: bigint): bigint {
  return native.zigzagEncode(value);
}

/** ZigZag-decode back to a signed integer. */
export function zigzagDecode(value: bigint): bigint {
  return native.zigzagDecode(value);
}

/** Build the field key (tag) varint for a field number + wire type. */
export function fieldKey(fieldNumber: number, wireType: WireType): number {
  return (fieldNumber << 3) | wireType;
}

// ─── Packed repeated: low-level (raw values, Rust-powered) ───────────────────

/**
 * Pack raw varint values into a contiguous payload (no field tags).
 *
 * This is the physical packing primitive; the raw `bigint` values are written
 * as-is. For typed helpers (int32, sint32, …) see the `encodePacked*` family.
 */
export function packVarints(values: bigint[]): Buffer {
  return native.packVarintsJs(values);
}

/** Unpack a varint payload into its raw values. */
export function unpackVarints(buf: Buffer | Uint8Array): bigint[] {
  return native.unpackVarintsJs(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
}

/** Pack raw fixed32 values (little-endian, 4 bytes each). */
export function packFixed32(values: number[]): Buffer {
  return native.packFixed32Js(values);
}

/** Unpack a fixed32 payload (length must be a multiple of 4). */
export function unpackFixed32(buf: Buffer | Uint8Array): number[] {
  return native.unpackFixed32Js(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
}

/** Pack raw fixed64 values (little-endian, 8 bytes each). */
export function packFixed64(values: bigint[]): Buffer {
  return native.packFixed64Js(values);
}

/** Unpack a fixed64 payload (length must be a multiple of 8). */
export function unpackFixed64(buf: Buffer | Uint8Array): bigint[] {
  return native.unpackFixed64Js(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
}

// ─── Logical-type helpers (as* read / from* write) ───────────────────────────
export {
  // Reading (raw wire value → logical value)
  asInt32,
  asInt64,
  asUint32,
  asUint64,
  asSint32,
  asSint64,
  asBool,
  asEnum,
  asFloat,
  asFixed32,
  asSfixed32,
  asDouble,
  asFixed64,
  asSfixed64,
  asString,
  asBytes,
  // Writing (logical value → raw wire value, range-checked)
  fromInt32,
  fromInt64,
  fromUint32,
  fromUint64,
  fromSint32,
  fromSint64,
  fromBool,
  fromEnum,
  fromFloat,
  fromFixed32,
  fromSfixed32,
  fromDouble,
  fromFixed64,
  fromSfixed64,
  fromString,
  fromBytes,
} from './helpers';

// ─── Packed repeated: typed (encodePacked* / decodePacked*) ──────────────────
export {
  encodePackedInt32,
  decodePackedInt32,
  encodePackedInt64,
  decodePackedInt64,
  encodePackedUint32,
  decodePackedUint32,
  encodePackedUint64,
  decodePackedUint64,
  encodePackedSint32,
  decodePackedSint32,
  encodePackedSint64,
  decodePackedSint64,
  encodePackedBool,
  decodePackedBool,
  encodePackedEnum,
  decodePackedEnum,
  encodePackedFloat,
  decodePackedFloat,
  encodePackedFixed32,
  decodePackedFixed32,
  encodePackedSfixed32,
  decodePackedSfixed32,
  encodePackedDouble,
  decodePackedDouble,
  encodePackedFixed64,
  decodePackedFixed64,
  encodePackedSfixed64,
  decodePackedSfixed64,
} from './packed';
