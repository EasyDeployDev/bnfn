# Contributing

Thanks for contributing to `bnfn`.

## Prerequisites

- Node.js 20 or newer
- Bun 1.1.17 or newer
- Zig 0.15.2 or newer

## Local setup

```bash
bun install
```

`postinstall` builds the required Zig native library. If that build fails, fix the native toolchain before making runtime changes.

If you need an npm lockfile for publish verification, `npm install` remains supported, but the day-to-day development flow should stay Bun-first.

## Development workflow

Run the core checks before opening a pull request:

```bash
bun test
bun x tsc -p tsconfig.types.json
bun run build
```

Optional targeted commands:

```bash
bun run test:axios
bun run test:native
bun run test:native:ci
bun run bench:axios
```

## Pull request expectations

- Keep changes scoped and explain the user-facing effect.
- Add or update tests for runtime, native, or type-surface changes.
- Call out benchmark impact if you change request-path hot code.
- Do not add Node or browser fallbacks unless the project scope changes explicitly.

## Native layer notes

The Bun + Zig runtime contract is deliberate. Changes under `native/` or `src/native/` should preserve:

- deterministic percent-encoding behavior
- stable query-entry serialization
- clear import-time failures when Bun FFI or the native library is missing

If you change the FFI contract, update the docs and benchmark notes in the same pull request.
