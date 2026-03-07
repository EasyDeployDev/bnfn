# Compatibility And Performance

## Solution

The package now treats `Bun + built Zig native library` as its only supported operating mode.

The implementation does that by:

- requiring Bun FFI at module load time
- requiring the compiled native library at module load time
- switching the FFI contract from alloc/free string returns to caller-owned output buffers
- using Zig for the bulk query serialization work that benefits from a native boundary
- replacing the JSON-based query-entry bridge with a compact binary entry format
- keeping header-name normalization on Bun's built-in lowercase path because per-header FFI was slower on real workloads
- replacing the Promise-chain interceptor execution model with a sequential state-machine fast path
- flattening request headers without an intermediate bucket-stripped copy object
- compiling the native library with `-mcpu=native` by default during install/build
- running `postinstall` as a hard native build step during package install

The tradeoff is explicit: unsupported runtimes and missing native builds now fail fast instead of degrading to a JavaScript fallback.

## Current Runtime Behavior

- Bun + built Zig library: supported
- Bun + no built library: throws during import
- Node: throws during import

The runtime gate lives in [src/native/ffi.js](../src/native/ffi.js).

## Benchmark Matrix

Date: March 7, 2026

Commands:

```bash
bun run bench:axios
mkdir -p /tmp/bnfn-axios-bench
cd /tmp/bnfn-axios-bench
printf '{"name":"bnfn-axios-bench","private":true}\n' > package.json
env npm_config_cache=/tmp/bnfn-npm-cache npm install axios
cd -
bun run bench:axios -- --axios-root=/tmp/bnfn-axios-bench/node_modules/axios
```

Environment:

- OS/arch: Darwin arm64
- Bun: 1.1.17
- Axios reference: resolved axios package (`axios 1.13.6`)
- Zig: 0.15.2

Mode:

- Bun + Zig: `bun run bench:axios`

Results:

- `mergeConfig`: `bnfn` 645,560.1 ops/s vs axios 454,674.1 ops/s (`+42.0%`)
- `AxiosHeaders.from()/set()/toJSON()`: `bnfn` 1,239,113.9 ops/s vs axios 541,456.1 ops/s (`+128.8%`)
- `getUri(baseURL + params)`: `bnfn` 216,128.4 ops/s vs axios 130,011.5 ops/s (`+66.2%`)
- `client request pipeline`: `bnfn` 225,326.3 ops/s vs axios 72,355.0 ops/s (`+211.4%`)

These are microbenchmark numbers from a single run, so small and medium deltas can move around between runs.

What changed in this rerun:

- the query-entry bridge now uses a binary length-prefixed format instead of JSON stringify/parse
- params serialization now mirrors axios more closely for nested keys and space encoding
- the benchmark now stays on the public `bnfn` surface and resolves axios from the current project by default
- the build still defaults to `-mcpu=native`
- `AxiosHeaders` moved from `Map` storage to a null-prototype object with lower-allocation loops and fast cloning
- header normalization now stays on Bun's built-in lowercase path instead of crossing FFI per header name
- request and response interceptors now run through a sequential async state machine instead of Promise chaining every hop
- request header flattening no longer builds a temporary bucket-stripped object before materializing `AxiosHeaders`
- the repo now includes deterministic axios compatibility tests for `getUri`, JSON request shaping, and header normalization

The client pipeline remains materially faster than npm axios, which is the main goal for the Zig-backed path. The big lesson from this rerun is that the next gains came from architecture, not just native code: bulk query work benefited from Zig, short per-header normalization got faster when it stayed in Bun, and the request path sped up again when the interceptor chain stopped allocating Promise hops for the common case.

## Verification

- `bun test`
- `bun run test:axios`
- `bun run bench:axios`
- `npm pack` produced `easydev-bnfn-0.1.1.tgz`
- tarball install via `npm install ./easydev-bnfn-0.1.1.tgz` built `node_modules/@easydev/bnfn/native/libbnfn_primitives.*` when Zig was present
- importing the installed package under Bun reported `native.available: true`
- importing the installed package under Node failed with `bnfn requires the Bun runtime with Bun.FFI available.`

The tests passed in this environment, the tarball install produced a Bun-loadable native library, and unsupported Node usage failed fast.

## How To Re-run With Zig

Once Zig is installed:

```bash
bun run build:native
mkdir -p /tmp/bnfn-axios-bench
cd /tmp/bnfn-axios-bench
printf '{"name":"bnfn-axios-bench","private":true}\n' > package.json
env npm_config_cache=/tmp/bnfn-npm-cache npm install axios
cd -
bun run bench:axios -- --axios-root=/tmp/bnfn-axios-bench/node_modules/axios
```

That builds the native library, installs the published axios package into a throwaway directory, and benchmarks the supported Zig-backed path against the npm artifact directly.
