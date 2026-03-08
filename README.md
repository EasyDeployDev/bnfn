# bnfn

[![CI](https://github.com/EasyDeployDev/bnfn/actions/workflows/ci.yml/badge.svg)](https://github.com/EasyDeployDev/bnfn/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40easydev%2Fbnfn)](https://www.npmjs.com/package/@easydev/bnfn)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f766e.svg)](./LICENSE)

`bnfn` is a Bun-native HTTP client with an Axios-shaped API and a required Zig acceleration layer.

## EasyDeploy

`bnfn` is published under the EasyDeploy organization.

- Website: [easydeploydev.github.io](https://easydeploydev.github.io/)
- Organization: [github.com/EasyDeployDev](https://github.com/EasyDeployDev)
- Discussions: [github.com/EasyDeployDev/bnfn/discussions](https://github.com/EasyDeployDev/bnfn/discussions)

It is intentionally narrow:

- Bun runtime only
- compiled Zig native library required
- Axios-shaped request flow instead of full Axios parity

The current scope includes:

- callable default export: `bnfn(url, config?)`
- instance API: `create()`, `request()`, `get()`, `post()`, `put()`, `patch()`, `delete()`, `head()`, `options()`
- request and response interceptors
- config merging and `baseURL`/`params` support
- header normalization through `AxiosHeaders`
- Bun `fetch` transport
- required Zig acceleration for RFC 3986 percent-encoding and bulk query-entry serialization

## Why bnfn

Axios spends meaningful CPU time on object plumbing before network I/O: config merging, header normalization, and query serialization. `bnfn` keeps the higher-level API in JavaScript while pushing the bulk string/query work that benefits from native execution down into Zig, with no JavaScript fallback path for the supported Bun + Zig runtime.

## Runtime contract

Supported mode:

- Bun runtime
- built Zig native library

Unsupported mode:

- Bun without a built native library
- Node
- browsers

Importing `bnfn` without Bun FFI or without the compiled native library is treated as a setup error.

## Install

```bash
bun add @easydev/bnfn
```

`bun add` builds the Zig native library during `postinstall`. If `zig` is missing or the native build fails, installation fails.

If you are consuming the package from an npm-driven project, `npm install @easydev/bnfn` also works.

Build the native library explicitly:

```bash
bun run build:native
```

Inspect native status:

```bash
bun run inspect:native
```

## Usage

```js
import bnfn from '@easydev/bnfn';

const api = bnfn.create({
  baseURL: 'https://example.com/api',
  headers: {
    common: {
      Accept: 'application/json'
    }
  }
});

api.interceptors.request.use((config) => {
  config.headers = {
    ...(config.headers ?? {}),
    'x-runtime': 'bun'
  };
  return config;
});

const response = await api.get('/users', {
  params: {
    page: 1,
    q: 'bun zig'
  }
});

console.log(response.data);
```

## Benchmarks

Run the axios comparison benchmark:

```bash
bun run bench:axios
```

Benchmark against an explicit axios installation:

```bash
bun run bench:axios -- --axios-root=/path/to/node_modules/axios
```

The benchmark resolves axios from the current project by default, or from `--axios-root` when you want to compare against another install. It compares `bnfn` against axios on:

- `mergeConfig`
- `AxiosHeaders.from()/set()/toJSON()`
- `getUri(baseURL + params)`
- the full client request pipeline with a no-op adapter

The build emits one of:

- `native/libbnfn_primitives.dylib`
- `native/libbnfn_primitives.so`
- `native/libbnfn_primitives.dll`

The current benchmark notes and latest recorded numbers live in [docs/compatibility-performance.md](./docs/compatibility-performance.md).

## TypeScript

The runtime source stays in JavaScript, but the package ships `index.d.ts` as its public type surface. Bun and TypeScript consumers get typed access to:

- the callable default export
- request config and response shapes
- `AxiosHeaders`, `AxiosError`, and interceptor APIs
- native status inspection via `native()`

## Project docs

- [Project guide](./docs/project.md)
- [Compatibility and benchmarks](./docs/compatibility-performance.md)
- [Open-source launch checklist](./docs/open-source-launch.md)

## Community

- Website: [easydeploydev.github.io](https://easydeploydev.github.io/)
- Issues: [github.com/EasyDeployDev/bnfn/issues](https://github.com/EasyDeployDev/bnfn/issues)
- Discussions: [github.com/EasyDeployDev/bnfn/discussions](https://github.com/EasyDeployDev/bnfn/discussions)
- Discord: publish the EasyDeploy invite URL on the website and here when the community server is live; until then use GitHub Discussions

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md), and [SECURITY.md](./SECURITY.md).

## License

MIT
