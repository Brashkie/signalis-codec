# Security Policy

## Scope

`@brashkie/signalis-codec` parses untrusted binary input. Robustness against
hostile payloads is a primary design goal, not an afterthought.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ |
| < 0.1   | ❌ |

## Reporting a vulnerability

**Do not open a public issue for security problems.** Report privately via
GitHub Security Advisories on the
[repository](https://github.com/Brashkie/signalis-codec/security/advisories/new),
or contact [@Brashkie](https://github.com/Brashkie).

## Threat model & guarantees

This codec is designed to decode adversarial input safely:

- **No `unsafe`** in the core (`#![forbid(unsafe_code)]`) — no memory-safety
  bugs by construction.
- **Bounds-checked reads** — a truncated or oversized length yields a
  `DecodeError`, never an out-of-bounds read or panic.
- **Varint termination** — varints are capped at 10 bytes, so a stream of
  continuation bytes cannot loop forever.
- **Depth limiting** — `decodeTree` enforces a caller-supplied `maxDepth`.
  Recursive schemas (like WhatsApp's) cannot exhaust the stack; exceeding the
  limit throws. This is the direct mitigation for the Proto6 recursion DoS class.

## Guidance for integrators

- **Choose a `maxDepth` for your protocol.** The default (100) is generous;
  WhatsApp messages nest only a few levels. Lower it if you know your bound.
- **Terminate on `DecodeError`.** A decode failure on network input means the
  peer sent something malformed or hostile — drop the message/connection.
- **Treat 64-bit values as `BigInt`.** Don't coerce to `Number` blindly; you can
  lose precision above 2^53.
- **This codec does not validate schemas** — only wire-format correctness. Field
  semantics (required fields, enum ranges) are the higher layer's job.
