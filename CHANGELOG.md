# Changelog

All notable changes to `@brashkie/signalis-codec` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] — 2026-08-03

### Fixed

- **Packaging: the NAPI loader was missing from the published package.**
  `index.js` (the platform-selecting loader that `napi build` generates) was
  listed in `.gitignore` and therefore never committed or published, so
  `require('@brashkie/signalis-codec')` failed with `Cannot find module
  '../index.js'`. The loader and its `index.d.ts` are now committed and shipped.
  No API or behavior changes.

## [0.1.0] — 2026-07-24

Initial release. A safe, Rust-powered protobuf **wire codec** (Level 1).

### Added

- **Rust core** (`codec-core`): dependency-free, `#![forbid(unsafe_code)]` wire
  codec for all four protobuf wire types (varint, fixed64, length-delimited,
  fixed32).
- **Bounds-checked reader**: every read validates the buffer; malformed input
  yields a `DecodeError` with a byte position, never a panic.
- **Depth-limited recursive decode** (`decodeTree`): descends into submessages
  bounded by `maxDepth`, defusing the Proto6 recursion DoS class.
- **Encoder**: symmetric writing of all four wire types.
- **ZigZag** encode/decode for `sint32` / `sint64`.
- **NAPI-RS bindings** (`codec-node`) exposing the core to Node.js.
- **TypeScript wrapper** with a typed, ergonomic API; 64-bit values as `BigInt`.
- Dual **CommonJS + ESM** build with full type declarations.

### Verified

- Wire format checked against the Protocol Buffers specification and against the
  reference `protobuf` library's output (byte-for-byte).
- Rust unit tests for varint/zigzag round-trips, malformed input, group
  rejection, field-zero rejection, varint overflow, and depth limiting.
- TypeScript tests against the real native addon.

[0.1.0]: https://github.com/Brashkie/signalis-codec/releases/tag/v0.1.0
