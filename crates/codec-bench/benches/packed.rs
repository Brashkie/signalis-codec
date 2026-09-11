//! Packed repeated pack/unpack benchmarks.
//!
//! Run with: `cargo bench -p codec-bench --bench packed`

use codec_core::{pack_fixed64, pack_varints, unpack_fixed64, unpack_varints};
use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};

fn bench_pack_varints(c: &mut Criterion) {
    let values: Vec<u64> = (0..1000).map(|i| i * 7919).collect();
    let mut group = c.benchmark_group("pack_varints");
    group.throughput(Throughput::Elements(values.len() as u64));
    group.bench_function("1000", |b| {
        b.iter(|| black_box(pack_varints(black_box(&values))));
    });
    group.finish();
}

fn bench_unpack_varints(c: &mut Criterion) {
    let values: Vec<u64> = (0..1000).map(|i| i * 7919).collect();
    let packed = pack_varints(&values);
    let mut group = c.benchmark_group("unpack_varints");
    group.throughput(Throughput::Bytes(packed.len() as u64));
    group.bench_function("1000", |b| {
        b.iter(|| unpack_varints(black_box(&packed)).unwrap());
    });
    group.finish();
}

fn bench_pack_fixed64(c: &mut Criterion) {
    let values: Vec<u64> = (0..1000).collect();
    let mut group = c.benchmark_group("pack_fixed64");
    group.throughput(Throughput::Elements(values.len() as u64));
    group.bench_function("1000", |b| {
        b.iter(|| black_box(pack_fixed64(black_box(&values))));
    });
    group.finish();
}

fn bench_unpack_fixed64(c: &mut Criterion) {
    let values: Vec<u64> = (0..1000).collect();
    let packed = pack_fixed64(&values);
    let mut group = c.benchmark_group("unpack_fixed64");
    group.throughput(Throughput::Bytes(packed.len() as u64));
    group.bench_function("1000", |b| {
        b.iter(|| unpack_fixed64(black_box(&packed)).unwrap());
    });
    group.finish();
}

criterion_group!(
    benches,
    bench_pack_varints,
    bench_unpack_varints,
    bench_pack_fixed64,
    bench_unpack_fixed64
);
criterion_main!(benches);
