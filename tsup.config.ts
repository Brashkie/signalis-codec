import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  // Inject cross-format shims: `import.meta.url` in the CJS output (needed by
  // createRequire) and `__dirname`/`__filename` in the ESM output.
  shims: true,
  // The native addon (index.js) is required at runtime, not bundled.
  external: ['../index.js'],
});
