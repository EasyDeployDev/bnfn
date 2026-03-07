import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const supportedFlags = new Set([
  'profile',
  'seed-start',
  'seed-count',
  'percent-cases',
  'serialize-cases',
  'urlsearchparams-cases',
]);
const envNameByFlag = {
  profile: 'BNFN_NATIVE_STRESS_PROFILE',
  'seed-start': 'BNFN_NATIVE_STRESS_SEED_START',
  'seed-count': 'BNFN_NATIVE_STRESS_SEED_COUNT',
  'percent-cases': 'BNFN_NATIVE_STRESS_PERCENT_CASES',
  'serialize-cases': 'BNFN_NATIVE_STRESS_SERIALIZE_CASES',
  'urlsearchparams-cases': 'BNFN_NATIVE_STRESS_URLSEARCHPARAMS_CASES',
};

function parseArgs(argv) {
  const parsed = {};

  argv.forEach((arg) => {
    if (!arg.startsWith('--') || !arg.includes('=')) {
      throw new Error(`Unsupported argument "${arg}". Use --flag=value.`);
    }

    const [flag, value] = arg.slice(2).split('=');

    if (!supportedFlags.has(flag)) {
      throw new Error(`Unsupported flag "${flag}".`);
    }

    parsed[flag] = value;
  });

  return parsed;
}

function toSummary(args) {
  return Object.entries(args)
    .filter(([, value]) => value != null)
    .map(([flag, value]) => `${flag}=${value}`)
    .join(', ');
}

let args;

try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const env = {
  ...process.env,
};

Object.entries(args).forEach(([flag, value]) => {
  env[envNameByFlag[flag]] = value;
});

console.error(
  `[native-stress] running test/native-primitives.test.js with ${toSummary(args) || 'default profile'}`
);

const result = spawnSync('bun', ['test', 'test/native-primitives.test.js'], {
  cwd: root,
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
