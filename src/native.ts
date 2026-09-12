/**
 * The native NAPI addon boundary.
 *
 * The addon (produced by `napi build` at the package root) is loaded here once
 * and shared by the rest of the package. Types are declared locally so the
 * type-declaration build never depends on the generated `index.d.ts`.
 */

import { createRequire } from 'node:module';

import type { DecodedField, FieldInput, TreeNode } from './index';

/** The shape of the native NAPI addon. */
export interface NativeBinding {
  decodeFieldsJs(buf: Buffer): DecodedField[];
  encodeFieldsJs(fields: FieldInput[]): Buffer;
  decodeTreeJs(buf: Buffer, maxDepth: number): TreeNode[];
  indexFieldsJs(buf: Buffer): Uint32Array;
  zigzagEncode(value: bigint): bigint;
  zigzagDecode(value: bigint): bigint;
  packVarintsJs(values: bigint[]): Buffer;
  unpackVarintsJs(buf: Buffer): bigint[];
  packFixed32Js(values: number[]): Buffer;
  unpackFixed32Js(buf: Buffer): number[];
  packFixed64Js(values: bigint[]): Buffer;
  unpackFixed64Js(buf: Buffer): bigint[];
}

// `createRequire(import.meta.url)` resolves the addon relative to the built file
// (dist/index.* → ../index.js at the package root) and works in both the CJS and
// ESM outputs (tsup's shims polyfill `import.meta.url` in the CJS build).
export const native = createRequire(import.meta.url)('../index.js') as NativeBinding;
