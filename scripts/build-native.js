import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const suffixByPlatform = {
  darwin: 'dylib',
  linux: 'so',
  win32: 'dll',
};

const suffix = suffixByPlatform[process.platform] ?? 'so';
const output = resolve(root, 'native', `libbnfn_primitives.${suffix}`);
const cacheRoot = resolve(root, '.zig-cache');
const zigCpu =
  process.env.BNFN_ZIG_CPU ??
  process.env.BNF_ZIG_CPU ??
  process.env.BFN_ZIG_CPU ??
  process.env.BUNXIOS_ZIG_CPU ??
  'native';
const buildEnv = {
  ...process.env,
  ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR ?? resolve(cacheRoot, 'global'),
  ZIG_LOCAL_CACHE_DIR: process.env.ZIG_LOCAL_CACHE_DIR ?? resolve(cacheRoot, 'local'),
};

let result;

try {
  result = spawnSync(
    'zig',
    [
      'build-lib',
      'native/primitives.zig',
      '-dynamic',
      '-O',
      'ReleaseFast',
      `-mcpu=${zigCpu}`,
      `-femit-bin=${output}`,
    ],
    {
      cwd: root,
      env: buildEnv,
      stdio: 'inherit',
    }
  );
} catch (error) {
  if (error?.code === 'ERR_INVALID_ARG_TYPE' && error?.message?.includes('"zig"')) {
    console.error('zig was not found in PATH. bnfn requires Zig to build its native library.');
    process.exit(1);
  }

  throw error;
}

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.error('zig was not found in PATH. bnfn requires Zig to build its native library.');
    process.exit(1);
  }

  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
