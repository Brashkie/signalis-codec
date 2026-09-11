//! Encoding benchmarks for the wire codec.
//!
//! Run with: `cargo bench -p codec-bench --bench encode`

use codec_core::Encoder;
use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};

/// Build a realistic small message: a few varints, a fixed, and a string.
fn build_small() -> Vec<u8> {
    let mut e = Encoder::new();
    e.write_varint_field(1, 150);
    e.write_varint_field(2, 42);
    e.write_fixed32_field(3, 0xDEAD_BEEF);
    e.write_bytes_field(4, b"hello world");
    e.finish()
}

fn bench_encode_small(c: &mut Criterion) {
    let mut group = c.benchmark_group("encode_small_message");
    group.throughput(Throughput::Elements(1));
    group.bench_function("4_fields", |b| {
        b.iter(|| black_box(build_small()));
    });
    group.finish();
}

fn bench_encode_varint_heavy(c: &mut Criterion) {
    // 1000 varint fields — stresses varint writing.
    let mut group = c.benchmark_group("encode_varint_heavy");
    group.throughput(Throughput::Elements(1000));
    group.bench_function("1000_varints", |b| {
        b.iter(|| {
            let mut e = Encoder::with_capacity(4096);
            for i in 0..1000u64 {
                e.write_varint_field(1, black_box(i * 12345));
            }
            black_box(e.finish())
        });
    });
    group.finish();
}

criterion_group!(benches, bench_encode_small, bench_encode_varint_heavy);
criterion_main!(benches);
