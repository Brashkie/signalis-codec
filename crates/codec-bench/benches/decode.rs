//! Decoding benchmarks: flat decode and recursive tree decode.
//!
//! Run with: `cargo bench -p codec-bench --bench decode`

use codec_core::{decode_fields, decode_tree, Encoder};
use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};

fn small_message() -> Vec<u8> {
    let mut e = Encoder::new();
    e.write_varint_field(1, 150);
    e.write_varint_field(2, 42);
    e.write_fixed32_field(3, 0xDEAD_BEEF);
    e.write_bytes_field(4, b"hello world");
    e.finish()
}

fn varint_heavy() -> Vec<u8> {
    let mut e = Encoder::with_capacity(4096);
    for i in 0..1000u64 {
        e.write_varint_field(1, i * 12345);
    }
    e.finish()
}

/// A message nested `depth` levels deep (field 1 wraps a submessage each level).
fn nested(depth: usize) -> Vec<u8> {
    let mut inner = Encoder::new();
    inner.write_varint_field(1, 42);
    let mut payload = inner.finish();
    for _ in 0..depth {
        let mut e = Encoder::new();
        e.write_bytes_field(1, &payload);
        payload = e.finish();
    }
    payload
}

fn bench_decode_fields_small(c: &mut Criterion) {
    let data = small_message();
    let mut group = c.benchmark_group("decode_fields_small");
    group.throughput(Throughput::Bytes(data.len() as u64));
    group.bench_function("4_fields", |b| {
        b.iter(|| decode_fields(black_box(&data)).unwrap());
    });
    group.finish();
}

fn bench_decode_fields_varint_heavy(c: &mut Criterion) {
    let data = varint_heavy();
    let mut group = c.benchmark_group("decode_fields_varint_heavy");
    group.throughput(Throughput::Bytes(data.len() as u64));
    group.bench_function("1000_varints", |b| {
        b.iter(|| decode_fields(black_box(&data)).unwrap());
    });
    group.finish();
}

fn bench_decode_tree(c: &mut Criterion) {
    let data = nested(20);
    let mut group = c.benchmark_group("decode_tree_nested");
    group.throughput(Throughput::Bytes(data.len() as u64));
    group.bench_function("depth_20", |b| {
        b.iter(|| decode_tree(black_box(&data), 100).unwrap());
    });
    group.finish();
}

criterion_group!(
    benches,
    bench_decode_fields_small,
    bench_decode_fields_varint_heavy,
    bench_decode_tree
);
criterion_main!(benches);
