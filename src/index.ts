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

// The native addon is produced by NAPI at build time (index.js / index.d.ts).
import * as native from '../index.js';

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
  return native.decodeFieldsJs(input) as DecodedField[];
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
  return native.encodeFieldsJs(normalized) as Buffer;
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
  return native.decodeTreeJs(input, maxDepth) as TreeNode[];
}

/** ZigZag-encode a signed integer (for `sint32` / `sint64`). */
export function zigzagEncode(value: bigint): bigint {
  return native.zigzagEncode(value) as bigint;
}

/** ZigZag-decode back to a signed integer. */
export function zigzagDecode(value: bigint): bigint {
  return native.zigzagDecode(value) as bigint;
}

/** Build the field key (tag) varint for a field number + wire type. */
export function fieldKey(fieldNumber: number, wireType: WireType): number {
  return (fieldNumber << 3) | wireType;
}
