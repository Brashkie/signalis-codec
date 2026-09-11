/**
 * Benchmark: @brashkie/signalis-codec (Rust/NAPI) vs protobuf.js (pure JS).
 *
 * Measures encode + decode of the same small message with both libraries, plus
 * a varint-heavy payload where the native engine should shine.
 *
 * Run (after `npm run build`):  node benchmarks/vs-protobufjs.mjs
 */

import { Bench } from 'tinybench';
import protobuf from 'protobufjs';

import {
  encodeFields,
  decodeFields,
  WireType,
  fromUint32,
  fromString,
  fromBool,
  asUint32,
  asString,
  asBool,
} from '../dist/index.mjs';

// ─── Shared schema / data ────────────────────────────────────────────────────
// message Device { uint32 id = 1; string name = 2; bool active = 3; uint32 score = 4; }
const root = protobuf.Root.fromJSON({
  nested: {
    Device: {
      fields: {
        id: { type: 'uint32', id: 1 },
        name: { type: 'string', id: 2 },
        active: { type: 'bool', id: 3 },
        score: { type: 'uint32', id: 4 },
      },
    },
  },
});
const Device = root.lookupType('Device');
const deviceData = { id: 150, name: 'phone-model-x', active: true, score: 9001 };

// Pre-encode buffers for the decode benchmarks (identical bytes from both sides).
const pbjsBuf = Device.encode(Device.create(deviceData)).finish();
const scFields = [
  { fieldNumber: 1, wireType: WireType.Varint, varint: fromUint32(deviceData.id) },
  { fieldNumber: 2, wireType: WireType.Bytes, bytes: fromString(deviceData.name) },
  { fieldNumber: 3, wireType: WireType.Varint, varint: fromBool(deviceData.active) },
  { fieldNumber: 4, wireType: WireType.Varint, varint: fromUint32(deviceData.score) },
];
const scBuf = encodeFields(scFields);

// Varint-heavy payload: 500 uint32 fields.
const manyData = {};
const pbjsManyFields = {};
for (let i = 1; i <= 500; i++) {
  manyData[`f${i}`] = i * 65535;
  pbjsManyFields[`f${i}`] = { type: 'uint32', id: i };
}
const ManyRoot = protobuf.Root.fromJSON({ nested: { Many: { fields: pbjsManyFields } } });
const Many = ManyRoot.lookupType('Many');
const scManyFields = [];
for (let i = 1; i <= 500; i++) {
  scManyFields.push({ fieldNumber: i, wireType: WireType.Varint, varint: fromUint32(i * 65535) });
}
// Pre-encoded buffers for the decode benchmarks (encode cost excluded).
const scManyBuf = encodeFields(scManyFields);
const pbjsManyBuf = Many.encode(Many.create(manyData)).finish();

// ─── Sanity: both libraries agree on the bytes ───────────────────────────────
if (Buffer.compare(Buffer.from(pbjsBuf), scBuf) !== 0) {
  console.warn('⚠️  Byte mismatch between protobuf.js and signalis-codec — check field order.');
} else {
  console.log('✅ Both libraries produce identical bytes for the sample message.\n');
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────
const bench = new Bench({ time: 1000 });

bench
  .add('encode small · signalis-codec', () => {
    encodeFields(scFields);
  })
  .add('encode small · protobuf.js', () => {
    Device.encode(Device.create(deviceData)).finish();
  })
  .add('decode small · signalis-codec', () => {
    const f = decodeFields(scBuf);
    void { id: asUint32(f[0].varint), name: asString(f[1].bytes), active: asBool(f[2].varint), score: asUint32(f[3].varint) };
  })
  .add('decode small · protobuf.js', () => {
    Device.decode(pbjsBuf);
  })
  .add('encode 500 varints · signalis-codec', () => {
    encodeFields(scManyFields);
  })
  .add('encode 500 varints · protobuf.js', () => {
    Many.encode(Many.create(manyData)).finish();
  })
  .add('decode 500 varints · signalis-codec', () => {
    decodeFields(scManyBuf);
  })
  .add('decode 500 varints · protobuf.js', () => {
    Many.decode(pbjsManyBuf);
  });

await bench.run();

console.table(
  bench.tasks.map(({ name, result }) => {
    // tinybench v3: result.throughput.mean (ops/sec), result.latency.mean (ms).
    // tinybench v2: result.hz (ops/sec), result.mean (ms). Support both.
    const hz = result?.throughput?.mean ?? result?.hz;
    const meanMs = result?.latency?.mean ?? result?.mean;
    return {
      Benchmark: name,
      'ops/sec': hz != null ? Math.round(hz).toLocaleString() : 'n/a',
      'avg (µs)': meanMs != null ? (meanMs * 1000).toFixed(3) : 'n/a',
    };
  }),
);
