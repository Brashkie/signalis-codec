<div align="center">

# @brashkie/signalis-codec

**A safe, Rust-powered protobuf wire codec.**

[![CI](https://github.com/Brashkie/signalis-codec/actions/workflows/ci.yml/badge.svg)](https://github.com/Brashkie/signalis-codec/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@brashkie/signalis-codec.svg)](https://www.npmjs.com/package/@brashkie/signalis-codec)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![types](https://img.shields.io/badge/types-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)
[![core](https://img.shields.io/badge/core-Rust-orange.svg)](https://www.rust-lang.org/)

</div>

---

A **Level-1 protobuf wire codec**: it reads and writes Protocol Buffers' four
wire types (varint, fixed64, length-delimited, fixed32) with a Rust core that is
strictly bounds-checked and **depth-limited by design**. It is schema-agnostic —
you work with field numbers and wire types, not named messages.

This is the serialization foundation for [`@brashkie/waproto`](https://github.com/Brashkie/waproto)
(WhatsApp's protobuf schema), but it's a useful standalone protobuf primitive for
any binary protocol.

## Why another protobuf library?

Most JS protobuf libraries are pure JavaScript and were not written with hostile
input as a first-class concern. WhatsApp's schema is deeply recursive, and a
crafted payload nesting tens of thousands of levels can exhaust the stack — a
real, disclosed class of denial-of-service (the "Proto6" bugs).

`signalis-codec` addresses this at the core:

- **Rust engine** — native speed for varint-heavy parsing, memory-safe by
  construction (`#![forbid(unsafe_code)]`).
- **Depth limiting** — recursive decoding is bounded by an explicit `maxDepth`;
  exceeding it throws instead of overflowing the stack.
- **Strict bounds-checking** — every read validates the buffer first, so
  truncated or malicious input yields a clean error with a byte position.
- **No panics on bad input** — malformed payloads always surface as catchable
  errors.

## Install

```bash
npm install @brashkie/signalis-codec
```

Prebuilt native binaries ship for common platforms; no toolchain needed to use it.

### Supported platforms

Prebuilt binaries are bundled for:

| OS | Architecture |
|----|--------------|
| Linux | x64 (glibc) |
| macOS | x64 (Intel) · arm64 (Apple Silicon) |
| Windows | x64 |

On any other platform, install fails to find a binary. If you need one that
isn't listed, open an issue — adding a target is a one-line change to the build
matrix. (To build from source you need a Rust toolchain and Node 18+.)

## Quick start

```ts
import { encodeFields, decodeFields, WireType } from '@brashkie/signalis-codec';

// Encode a few typed fields
const buf = encodeFields([
  { fieldNumber: 1, wireType: WireType.Varint, varint: 150n },
  { fieldNumber: 2, wireType: WireType.Bytes, bytes: Buffer.from('hello') },
]);
// buf → <Buffer 08 96 01 12 05 68 65 6c 6c 6f>

// Decode back
const fields = decodeFields(buf);
// [
//   { fieldNumber: 1, wireType: 0, varint: 150n },
//   { fieldNumber: 2, wireType: 2, bytes: <Buffer 68 65 6c 6c 6f> },
// ]
```

64-bit values (varint, fixed64) are returned as `BigInt` so all 64 bits survive
the trip through JavaScript.

## Recursive decoding with a depth limit

For nested messages, `decodeTree` descends into submessages while enforcing a
maximum depth — the anti-DoS guarantee:

```ts
import { decodeTree } from '@brashkie/signalis-codec';

const tree = decodeTree(buf, 100); // maxDepth = 100 (default)
// tree nodes have kind: 'varint' | 'fixed64' | 'fixed32' | 'bytes' | 'message'

// A malicious 10,000-deep payload throws instead of crashing:
decodeTree(evilBuf, 100); // → Error: nesting depth exceeded limit of 100
```

## API

| Export | Description |
|--------|-------------|
| `encodeFields(fields)` | Encode a list of typed fields to a `Buffer` |
| `decodeFields(buf)` | Decode a flat list of fields (no recursion) |
| `decodeTree(buf, maxDepth?)` | Recursively decode into a bounded tree |
| `zigzagEncode` / `zigzagDecode` | ZigZag transform for `sint32` / `sint64` |
| `fieldKey(n, wireType)` | Compute a field key (tag) |
| `WireType` | Enum: `Varint`, `Fixed64`, `Bytes`, `Fixed32` |
| `DEFAULT_MAX_DEPTH` | `100` |

Wire types map to protobuf as: `Varint` → int/uint/sint/bool/enum;
`Fixed64` → double/fixed64/sfixed64; `Fixed32` → float/fixed32/sfixed32;
`Bytes` → string/bytes/embedded messages/packed repeated.

## What this is (and isn't)

- ✅ A **wire codec** — the byte-level layer of protobuf.
- ❌ Not a **schema compiler** — it doesn't read `.proto` files or generate typed
  message classes. That's a higher layer (e.g. `@brashkie/waproto` maps field
  numbers to WhatsApp's schema on top of this codec).

Keeping the codec schema-agnostic makes it small, auditable, and reusable for any
protobuf-based protocol.

## Architecture

```
crates/codec-core   Pure Rust wire codec (no dependencies, no unsafe)
crates/codec-node   NAPI-RS bindings → the native addon
src/                TypeScript wrapper with the typed public API
```

The Rust core is exercised by its own `cargo test` suite; the TypeScript layer by
Vitest against the real native addon.

## Security

See [SECURITY.md](./SECURITY.md). In short: terminate on decode errors, and pick
a `maxDepth` appropriate to your protocol (WhatsApp messages nest only a handful
of levels; the default of 100 is generous).

## Ecosystem

| Package | Role |
|---------|------|
| [`@brashkie/signalis-core`](https://github.com/Brashkie/signalis-core) | Cryptographic primitives (Rust) |
| [`@brashkie/signalis`](https://github.com/Brashkie/signalis) | The Signal Protocol |
| [`@brashkie/signalis-noise`](https://github.com/Brashkie/signalis-noise) | The Noise Protocol Framework |
| **`@brashkie/signalis-codec`** | **This package — protobuf wire codec** |

## License

Apache-2.0 © Brashkie (Hepein Oficial)
