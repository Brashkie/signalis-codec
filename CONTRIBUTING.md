# Contributing to @brashkie/signalis-codec

Thanks for your interest! This codec parses untrusted input, so **safety and
correctness come first**.

## Ground rules

- **No `unsafe` in the core.** `codec-core` is `#![forbid(unsafe_code)]` — keep
  it that way.
- **Never panic on input.** Malformed bytes must always produce a `DecodeError`,
  not a panic or hang. Add a test for every new failure mode.
- **Wire format is law.** Any change must keep the round-trip and spec-vector
  tests green. When in doubt, check against the reference `protobuf` library.

## Development setup

```bash
git clone https://github.com/Brashkie/signalis-codec.git
cd signalis-codec
npm install
npm run build:native   # compiles the Rust core + NAPI addon
npm run build:ts
```

Requires a Rust toolchain (stable) and Node 18+.

## Workflow

```bash
npm run test:rust      # cargo test (the core logic)
npm test               # vitest against the native addon
npm run lint           # biome
npm run typecheck      # tsc --noEmit
npm run build          # native + TS
```

Before a PR, all must pass:

- [ ] `cargo fmt --all -- --check` and `cargo clippy -- -D warnings`
- [ ] `npm run test:rust`
- [ ] `npm test`
- [ ] `npm run lint` and `npm run typecheck`

## Adding wire-format features

The core lives in `crates/codec-core/src/`:

- `reader.rs` — the bounds-checked cursor
- `wire.rs` — wire types + field key
- `decoder.rs` — flat + recursive decode
- `encoder.rs` — writing

Expose new functionality through `codec-node` (NAPI) and then the TS wrapper.

## Commit style

```
feat(decoder): add streaming field iterator
fix(reader): reject varints longer than 10 bytes
test(vectors): add packed-repeated round-trip
```

## License

By contributing, you agree your contributions are licensed under Apache-2.0.
