# Changelog

All notable changes to `@brashkie/signalis-codec` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-09-09

### Added

- **Benchmarks** (Phase 2c) — no API changes, dev-only tooling:
  - **Rust Criterion micro-benchmarks** (`crates/codec-bench`, not published) for
    the core engine: encoding (small message + varint-heavy), decoding
    (`decode_fields` flat + `decode_tree` nested), and packed pack/unpack. Run
    with `npm run bench:rust` (`cargo bench -p codec-bench`).
  - **Head-to-head vs protobuf.js** (`benchmarks/vs-protobufjs.mjs`) — encode +
    decode of the same messages with both libraries, including a varint-heavy
    payload. The script first asserts both libraries produce byte-identical
    output, then reports ops/sec. Run with `npm run bench` (after `npm run build`).
- `protobufjs` and `tinybench` added as devDependencies (benchmark-only).

### Notes

- Benchmarks are not shipped in the npm package (`benchmarks/` and
  `crates/codec-bench` are outside the `files` allow-list and the published
  crates). This is purely additive; the wire codec's behavior is unchanged.



### Added

- **Packed repeated support** — `[packed=true]` fields, split cleanly across the
  two layers the codec already uses:
  - **Rust engine**: low-level `packVarints` / `unpackVarints`,
    `packFixed32` / `unpackFixed32`, `packFixed64` / `unpackFixed64` — the
    physical packing, where the per-element work belongs.
  - **TypeScript**: a typed `encodePacked*` / `decodePacked*` pair for every
    packable protobuf type (`int32`, `int64`, `uint32`, `uint64`, `sint32`,
    `sint64`, `bool`, `enum`, `float`, `double`, `fixed32`, `sfixed32`,
    `fixed64`, `sfixed64`), layering the logical-type helpers over the Rust
    engine.
- Misaligned fixed32/fixed64 payloads are rejected; truncated varint payloads
  error rather than silently dropping data.
- Verified against the protobuf specification's canonical packed example
  (`[3, 270, 86942]` → `03 8E02 9EA705`).

### Notes

- This completes the Level-1 wire format: the codec can now read and write every
  protobuf wire form, including packed repeated. Schema-level concerns (`.proto`
  parsing, maps, oneof) remain out of scope by design.

## [0.2.0] — 2026-08-04

### Added

- **Logical-type helpers** — a symmetric set of pure-TypeScript functions that
  interpret raw wire values as protobuf logical types and back. The wire codec
  stays schema-agnostic (a varint is just a varint); these helpers apply the
  meaning the schema implies.
  - **Reading (`as*`)**: `asInt32`, `asInt64`, `asUint32`, `asUint64`,
    `asSint32`, `asSint64`, `asBool`, `asEnum`, `asFloat`, `asFixed32`,
    `asSfixed32`, `asDouble`, `asFixed64`, `asSfixed64`, `asString`, `asBytes`.
  - **Writing (`from*`)**: the mirror set, **range-checked** — out-of-range
    input throws `RangeError` instead of silently truncating.
- Correct handling of the tricky cases: negative `int32` (encoded as a 10-byte
  varint), ZigZag for `sint*`, and IEEE-754 for `float`/`double`. All verified
  against the reference protobuf implementation.

### Changed

- **Packaging aligned with `@brashkie/signalis-core`** (lean model). The main
  package no longer bundles every platform's `.node`; instead each platform's
  binary ships as its own optional sub-package (`@brashkie/signalis-codec-<platform>`),
  so users download only the binary for their platform. The NAPI loader
  (`index.js`) is generated fresh during the release and is no longer committed.
  This replaces the interim fat-package model used in 0.1.x.

### Notes

- The core Rust wire codec is unchanged. Type interpretation is cheap and lives
  in TypeScript, keeping the native boundary small and the engine focused on the
  binary format.
- `packed repeated` is intentionally **not** included yet; it's planned for a
  later release.

## [0.1.2] — 2026-08-03

### Fixed

- **`exports` now allows reading `package.json`.** Tools and consumers that do
  `require('@brashkie/signalis-codec/package.json')` previously hit
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Added the `"./package.json"` subpath export.

### Docs

- Documented the set of platforms with prebuilt binaries (Linux x64, macOS
  x64/arm64, Windows x64) and how to request additional targets.

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
