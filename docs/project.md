# Project Guide

`bnfn` is a Bun-only HTTP client with an Axios-shaped API. The JavaScript runtime stays intentionally small, and the hot string/query primitives are required to come from the bundled Zig library.

## Runtime contract

Supported mode:

- Bun runtime
- compiled native library from `native/primitives.zig`

Unsupported mode:

- Node
- browsers
- Bun without the compiled native library

The package enforces that contract at import time. `src/native/ffi.js` requires both `Bun.FFI` and the built native library, then `src/native/primitives.js` exposes the required native helpers to the rest of the codebase.

## TypeScript position

The runtime source remains JavaScript in `src/`. The package ships a declaration entrypoint at `index.d.ts` for Bun and TypeScript consumers, and `npm pack`/`npm publish` emit a minified bundled runtime into `dist/` during `prepack`.

This keeps the current runtime stable while still providing:

- typed request config and response shapes
- typed interceptors, errors, and headers helpers
- package-level IntelliSense for the default callable export and named exports

There is no separate TypeScript build step for the runtime.

## Request pipeline

The request path is:

1. `src/axios.js` builds the callable default instance and attaches static helpers.
2. `src/core/Axios.js` merges defaults with per-request config and runs request interceptors.
3. `src/core/dispatchRequest.js` flattens headers, applies transforms, and hands off to the adapter.
4. `src/adapters/bun-fetch.js` performs the request with Bun `fetch`, timeout handling, abort bridging, and response decoding.
5. `src/core/dispatchRequest.js` applies response transforms and status validation before the promise resolves or rejects.

The interceptor path no longer builds a Promise chain for every handler. `src/core/Axios.js` now runs interceptors through a sequential async state machine, which preserves fulfillment/rejection flow while avoiding extra Promise hop overhead in the common synchronous-interceptor case.

## Native layer

The native Zig library currently handles:

- RFC 3986 percent-encoding
- bulk query-entry serialization

Header normalization stays in JavaScript now because Bun's built-in lowercase path is faster than a per-header FFI crossing for the short header names this client sees. The native ABI is built around caller-owned output buffers instead of Zig-allocated return strings. Bulk query serialization crosses the FFI boundary as a compact binary length-prefixed entry buffer rather than JSON, which removes JSON stringify/parse overhead from that hot path.

The native build uses `-mcpu=native` by default in `scripts/build-native.js`, which lets the install-time Zig build tune the shared library for the local machine.

## File map

- `src/index.js`: named exports and default export wiring
- `dist/src/index.js`: minified publish artifact generated during `prepack`
- `src/axios.js`: default instance assembly
- `src/core/`: Axios core, errors, headers, config merge, URL building, dispatch
- `src/adapters/bun-fetch.js`: Bun transport adapter
- `src/native/ffi.js`: Bun FFI loading and native library binding
- `src/native/primitives.js`: JavaScript wrapper around the native primitives
- `native/primitives.zig`: Zig implementation
- `scripts/build-native.js`: install/build entrypoint for the native library
- `scripts/inspect-native.js`: native-library inspection
- `scripts/bench-vs-axios.js`: comparison microbenchmarks against the parent Axios repo
- `test/basic.test.js`: Bun integration and regression tests
- `test/native-primitives.test.js`: deterministic property-style stress tests for the native encoder and serializer
- `test/types-smoke.ts`: declaration smoke file for the public TypeScript surface
- `tsconfig.types.json`: compiler config for declaration validation

## Install, test, benchmark

Install:

```bash
bun install
```

If you need to verify the npm publish path locally, `npm install` is also supported.

Build the native library explicitly:

```bash
bun run build:native
```

Run tests:

```bash
bun test
```

Run the native stress suite with default settings:

```bash
bun run test:native
```

Run a heavier CI profile:

```bash
bun run test:native:ci
```

Run the long soak profile:

```bash
bun run test:native:soak
```

Override the deterministic seed range or case counts:

```bash
node scripts/run-native-stress.js --profile=soak --seed-start=256 --seed-count=32 --percent-cases=8000 --serialize-cases=4000
```

Run the benchmark:

```bash
bun run bench:axios
```

Benchmark against a generic npm-installed axios package:

```bash
bun run bench:axios -- --axios-root=/path/to/node_modules/axios
```

The benchmark compares selected hot paths against the axios package resolved from the current project, or an explicit axios package root passed with `--axios-root`. The current benchmark notes and latest recorded numbers live in `docs/compatibility-performance.md`.
