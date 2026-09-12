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

## Logical-type helpers

The wire codec is schema-agnostic: a varint is just a varint. The *logical* type
(int32 vs sint32 vs bool vs enum…) lives in the schema, so decoding returns raw
values and a set of helpers interprets them. The `as*` (read) and `from*` (write)
helpers are perfectly symmetric, and every `from*` is range-checked — passing an
out-of-range value throws `RangeError` rather than silently truncating.

```ts
import {
  encodeFields, decodeFields, WireType,
  asUint32, asString, fromUint32, fromString,
} from '@brashkie/signalis-codec';

// Given a schema like:  message Device { uint32 id = 1; string name = 2; }

// Encode
const buf = encodeFields([
  { fieldNumber: 1, wireType: WireType.Varint, varint: fromUint32(150) },
  { fieldNumber: 2, wireType: WireType.Bytes,  bytes:  fromString('phone') },
]);

// Decode
const f = decodeFields(buf);
const device = {
  id:   asUint32(f[0].varint),
  name: asString(f[1].bytes),
};
// → { id: 150, name: 'phone' }
```

Available helpers, grouped by the wire type they read from / write to:

| Wire type | Read (`as*`) | Write (`from*`) |
|-----------|--------------|-----------------|
| Varint | `asInt32` `asInt64` `asUint32` `asUint64` `asSint32` `asSint64` `asBool` `asEnum` | mirror `from*` |
| Fixed32 | `asFloat` `asFixed32` `asSfixed32` | mirror `from*` |
| Fixed64 | `asDouble` `asFixed64` `asSfixed64` | mirror `from*` |
| Bytes | `asString` `asBytes` | mirror `from*` |

Negative `int32` (encoded as a full-width varint), ZigZag `sint*`, and IEEE-754
`float`/`double` are all handled correctly and verified against the reference
protobuf implementation.

## Packed repeated fields

A `repeated` field marked `[packed=true]` is encoded as a single
length-delimited field whose payload is the concatenated element values (no
per-element tags). The physical packing runs in the Rust engine; a typed helper
per protobuf type layers the logical conversion on top.

```ts
import {
  encodeFields, decodeFields, WireType,
  encodePackedSint32, decodePackedSint32,
} from '@brashkie/signalis-codec';

// message Path { repeated sint32 deltas = 4 [packed=true]; }

// Encode: build the packed payload, then wrap it in a length-delimited field.
const payload = encodePackedSint32([-10, 20, -30]);
const buf = encodeFields([{ fieldNumber: 4, wireType: WireType.Bytes, bytes: payload }]);

// Decode: read the field, then unpack its bytes.
const field = decodeFields(buf)[0];
const deltas = decodePackedSint32(field.bytes!); // [-10, 20, -30]
```

There's an `encodePacked*` / `decodePacked*` pair for every packable type:
`int32`, `int64`, `uint32`, `uint64`, `sint32`, `sint64`, `bool`, `enum`,
`float`, `double`, `fixed32`, `sfixed32`, `fixed64`, `sfixed64`. For raw packing
without type interpretation, the low-level `packVarints` / `unpackVarints`,
`packFixed32` / `unpackFixed32`, and `packFixed64` / `unpackFixed64` are exported
too.

## Lazy decoding for large / sparse messages

`lazyIndex` scans a buffer **once** into an offset table (crossing the native
boundary a single time, as one typed array — no per-field object allocation) and
lets you read only the fields you need, on demand, in O(1):

```ts
import { lazyIndex } from '@brashkie/signalis-codec';

const msg = lazyIndex(buf);          // one pass, nothing decoded yet
if (msg.getUint32(2) !== 3) return;  // route by a single field, payload untouched
const jid = msg.getString(1);        // decode one field, no extra boundary crossing
const media = msg.getMessage(7);     // index a submessage in place
```

`LazyMessage` offers `has`, `fieldCount`, `fieldNumbers`, and typed getters
(`getVarint`, `getUint32`, `getBool`, `getString`, `getBytes`, `getFixed32`,
`getFixed64`, `getMessage`). `getBytes` returns a **view** over the buffer — copy
it if you keep it beyond the buffer's lifetime.

**When it helps (measured, honest):** the lazy path is an *adaptive* strategy,
not a universal speedup.

| Message | Winner |
|---|---|
| Small (1–4 fields, ~88 B — typical chat/signalling) | eager decode / protobuf.js is faster |
| Large & sparse (>1 KB, read a few of many fields) | **lazy: 1.3×–2.7× faster, zero GC churn** |

Use `lazyIndex` for large payloads (history sync, media metadata, heavy
documents) and routing/filtering; use eager `decodeFields` for small messages.
Both keep 100% protobuf wire-format compatibility.

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

## Benchmarks

Two benchmark suites live in the repo (both dev-only, not shipped):

```
npm run bench:rust    # Criterion micro-benchmarks of the Rust core
npm run bench         # head-to-head vs protobuf.js (run after `npm run build`)
```

The `bench` script encodes and decodes the same messages with both
`signalis-codec` and `protobuf.js`, first asserting they produce **byte-identical**
output, then reporting ops/sec. The native engine's advantage is largest on
varint-heavy and larger payloads (the parsing this codec is built for); for very
small messages the NAPI boundary crossing means a tuned pure-JS decoder can be
competitive. Run them on your own hardware — numbers vary by CPU.

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
