# 🗺️ Roadmap — @brashkie/signalis-codec

Mission: a **safe, fast, auditable** protobuf wire codec — the serialization
foundation for the Signalis ecosystem and `@brashkie/waproto`.

**Legend:** ✅ done · 🟡 in progress · 🔴 planned · 💭 considering

## ✅ Phase 1 — Wire codec (v0.1.0)

- [x] All four wire types (varint, fixed64, length-delimited, fixed32)
- [x] Bounds-checked reader, no unsafe, no panics on bad input
- [x] Depth-limited recursive decode (anti-Proto6)
- [x] ZigZag for sint32/sint64
- [x] NAPI bindings + TypeScript wrapper (BigInt for 64-bit)

## ✅ Phase 2a — Logical-type helpers (v0.2.0)

- [x] `as*` readers and `from*` writers for every protobuf logical type
- [x] Range-checked `from*` (throws instead of truncating)
- [x] Correct negative-int32, ZigZag, and IEEE-754 handling, verified vs protobuf

## ✅ Phase 2b — Packed repeated (v0.3.0)

- [x] Rust engine: pack/unpack for varints, fixed32, fixed64
- [x] Typed `encodePacked*` / `decodePacked*` for all 14 packable types
- [x] Misaligned/truncated payloads rejected; verified vs the spec example

## 🟡 Phase 2c — Remaining ergonomics

- [ ] Streaming decode (decode fields lazily without materializing a Vec)
- [ ] Zero-copy string/bytes views where safe
- [x] Benchmarks vs protobufjs (throughput + memory) *(v0.3.1 — Criterion micro-benches for the Rust core + a `benchmarks/vs-protobufjs.mjs` head-to-head; run with `npm run bench` / `npm run bench:rust`)*

## 🔴 Phase 3 — Schema awareness (Level 2, optional)

- [ ] A thin descriptor layer: given field→type maps, decode into named objects
- [ ] Codegen path so `@brashkie/waproto` can generate typed accessors
- [ ] `.proto` parsing is explicitly **out of scope** for the core codec

## 💭 Considering

- WASM build (browser protobuf) once `signalis-wasm` patterns are established
- `no_std` mode for embedded targets

## Non-goals

- ❌ Being a full `.proto` compiler — that's a separate concern.
- ❌ Schema validation beyond wire-format correctness.

---

🔐 + ❤️ Hepein Oficial
