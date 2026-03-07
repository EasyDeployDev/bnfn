import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const [key, value] = arg.slice(2).split('=');
      return [key, value];
    })
);

const syncIterations = toPositiveInteger(args.get('sync'), 60000);
const asyncIterations = toPositiveInteger(args.get('async'), 4000);
const rounds = toPositiveInteger(args.get('rounds'), 4);
const warmupSync = toPositiveInteger(args.get('warmup-sync'), 4000);
const warmupAsync = toPositiveInteger(args.get('warmup-async'), 200);
const axiosRootArg =
  args.get('axios-root') ??
  process.env.BNFN_AXIOS_ROOT ??
  process.env.BNF_AXIOS_ROOT ??
  process.env.BFN_AXIOS_ROOT ??
  process.env.BUNXIOS_AXIOS_ROOT ??
  null;
const rateFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const meanMsFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
});
const runtimeLabel = globalThis.Bun
  ? `Bun ${Bun.version}`
  : `Node ${process.versions.node}`;

let blackhole = 0;

const mergeBase = Object.freeze({
  baseURL: 'https://api.example.com/v1',
  timeout: 1200,
  headers: {
    common: {
      Accept: 'application/json',
      'X-Trace-Id': 'trace-0001',
    },
    post: {
      'Content-Type': 'application/json',
    },
  },
  auth: {
    username: 'bench',
    password: 'secret',
  },
  params: {
    page: 1,
    q: 'bun zig benchmark',
  },
});

const mergeOverride = Object.freeze({
  timeout: 2500,
  headers: {
    common: {
      'X-Trace-Id': 'trace-0002',
    },
    post: {
      'X-Request-Id': 'req-1000',
    },
  },
  params: {
    page: 2,
  },
});

const headerFixture = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Trace-Id': 'trace-12345',
  'X-Request-Id': 'req-54321',
  'User-Agent': 'bench-client',
});

const uriFixture = Object.freeze({
  url: '/search',
  params: {
    q: 'bun zig benchmark',
    page: 2,
    tags: ['fast', 'native'],
    meta: {
      source: 'bench',
    },
  },
});

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function consume(value) {
  if (typeof value === 'number') {
    blackhole += value;
    return;
  }

  if (typeof value === 'string') {
    blackhole += value.length;
    return;
  }

  if (value && typeof value === 'object') {
    blackhole += Object.keys(value).length;
    return;
  }

  blackhole += 1;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatOps(opsPerSecond) {
  return `${rateFormat.format(opsPerSecond)} ops/s`;
}

function formatDelta(deltaPercent) {
  const sign = deltaPercent >= 0 ? '+' : '';
  return `${sign}${rateFormat.format(deltaPercent)}%`;
}

function formatMs(value) {
  return `${meanMsFormat.format(value)} ms`;
}

function summarize(name, elapsedMs, iterations) {
  return {
    name,
    elapsedMs,
    iterations,
    opsPerSecond: iterations / (elapsedMs / 1000),
  };
}

async function runSyncCase(name, iterations, fn) {
  for (let index = 0; index < warmupSync; index += 1) {
    consume(fn(index));
  }

  const timings = [];

  for (let round = 0; round < rounds; round += 1) {
    const start = performance.now();

    for (let index = 0; index < iterations; index += 1) {
      consume(fn(index));
    }

    timings.push(performance.now() - start);
  }

  return summarize(name, mean(timings), iterations);
}

async function runAsyncCase(name, iterations, fn) {
  for (let index = 0; index < warmupAsync; index += 1) {
    consume(await fn(index));
  }

  const timings = [];

  for (let round = 0; round < rounds; round += 1) {
    const start = performance.now();

    for (let index = 0; index < iterations; index += 1) {
      consume(await fn(index));
    }

    timings.push(performance.now() - start);
  }

  return summarize(name, mean(timings), iterations);
}

function printHeader(bnfn) {
  console.log('bnfn vs axios microbench');
  console.log(`runtime: ${runtimeLabel}`);
  console.log(
    `native primitives: ${bnfn.native().available ? 'enabled' : 'disabled'}${
      bnfn.native().reason ? ` (${bnfn.native().reason})` : ''
    }`
  );
  console.log(
    `settings: sync iterations=${syncIterations}, async iterations=${asyncIterations}, rounds=${rounds}`
  );
  console.log('');
}

function printAxiosReference(reference) {
  console.log(`axios reference: ${reference.label}`);
  console.log(`axios root: ${reference.root}`);
  console.log('');
}

function printComparison(title, bunResult, axiosResult) {
  const delta = ((bunResult.opsPerSecond - axiosResult.opsPerSecond) / axiosResult.opsPerSecond) * 100;

  console.log(title);
  console.log(
    `  bnfn:  ${formatOps(bunResult.opsPerSecond)} (${formatMs(bunResult.elapsedMs)} average)`
  );
  console.log(
    `  axios:   ${formatOps(axiosResult.opsPerSecond)} (${formatMs(axiosResult.elapsedMs)} average)`
  );
  console.log(`  delta:   ${formatDelta(delta)} vs axios`);
  console.log('');
}

function hasAxiosModules(axiosRoot) {
  return [
    resolve(axiosRoot, 'index.js'),
    resolve(axiosRoot, 'lib/core/mergeConfig.js'),
    resolve(axiosRoot, 'lib/core/AxiosHeaders.js'),
  ].every((path) => existsSync(path));
}

function readAxiosVersion(axiosRoot) {
  try {
    const packageJson = JSON.parse(readFileSync(resolve(axiosRoot, 'package.json'), 'utf8'));
    return packageJson.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function resolveAxiosCandidates() {
  const candidates = [];
  const seen = new Set();

  const push = (axiosRoot, source) => {
    if (!axiosRoot) {
      return;
    }

    const normalizedRoot = resolve(axiosRoot);

    if (seen.has(normalizedRoot)) {
      return;
    }

    seen.add(normalizedRoot);
    candidates.push({
      root: normalizedRoot,
      source,
    });
  };

  if (axiosRootArg) {
    push(resolve(process.cwd(), axiosRootArg), 'explicit axios-root');
  }

  try {
    push(dirname(require.resolve('axios/package.json')), 'resolved npm package');
  } catch {}

  return candidates;
}

async function importFile(path) {
  return import(pathToFileURL(path).href);
}

async function loadBnfn() {
  const candidates = [
    resolve(root, 'src', 'index.js'),
    resolve(root, 'dist', 'src', 'index.js'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const module = await importFile(candidate);
    return module.default;
  }

  throw new Error('unable to resolve bnfn entrypoint from src/ or dist/');
}

async function loadAxiosReference() {
  let lastReason = 'no axios reference found';

  for (const candidate of resolveAxiosCandidates()) {
    if (!hasAxiosModules(candidate.root)) {
      lastReason = `missing axios benchmark modules under ${candidate.root}`;
      continue;
    }

    try {
      const [clientModule, mergeConfigModule, headersModule] = await Promise.all([
        importFile(resolve(candidate.root, 'index.js')),
        importFile(resolve(candidate.root, 'lib/core/mergeConfig.js')),
        importFile(resolve(candidate.root, 'lib/core/AxiosHeaders.js')),
      ]);

      const version = readAxiosVersion(candidate.root);

      return {
        available: true,
        root: candidate.root,
        version,
        label: `axios ${version} (${candidate.source})`,
        client: clientModule.default,
        mergeConfig: mergeConfigModule.default,
        AxiosHeaders: headersModule.default,
      };
    } catch (error) {
      lastReason = `${candidate.root}: ${error.message}`;
    }
  }

  return {
    available: false,
    reason: lastReason,
  };
}

function buildHeaderWorkload(HeadersClass) {
  return () => {
    const headers = HeadersClass.from(headerFixture);
    headers.set('x-trace-id', 'trace-99999');
    headers.set('X-Benchmark-Round', '1');
    headers.set('content-type', 'application/json');
    return headers.toJSON();
  };
}

function buildMergeWorkload(mergeConfig) {
  return () => {
    const merged = mergeConfig(mergeBase, mergeOverride);
    return merged.headers;
  };
}

function buildUriWorkload(clientFactory) {
  const client = clientFactory.create({
    baseURL: mergeBase.baseURL,
  });

  return () => {
    return client.getUri(uriFixture);
  };
}

function setHeader(config, name, value) {
  if (config.headers && typeof config.headers.set === 'function') {
    config.headers.set(name, value);
    return;
  }

  config.headers = {
    ...(config.headers ?? {}),
    [name]: value,
  };
}

function noopAdapter(config) {
  return Promise.resolve({
    data: 'ok',
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'text/plain',
    },
    config,
    request: null,
  });
}

function buildClientWorkload(clientFactory) {
  const client = clientFactory.create({
    baseURL: 'https://service.example/api',
    responseType: 'text',
    transformResponse: [(data) => data],
  });

  client.interceptors.request.use((config) => {
    setHeader(config, 'X-Trace-Id', 'bench-request');
    return config;
  });

  client.interceptors.response.use((response) => response);

  return async () => {
    const response = await client.request({
      url: '/noop',
      method: 'post',
      data: {
        query: 'bun zig benchmark',
      },
      params: {
        page: 2,
        tags: ['fast', 'native'],
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Case': 'client-bench',
      },
      adapter: noopAdapter,
    });

    return response.status;
  };
}

async function main() {
  const bnfn = await loadBnfn();
  printHeader(bnfn);
  const axiosReference = await loadAxiosReference();

  if (!axiosReference.available) {
    console.log(`unable to load axios benchmark reference: ${axiosReference.reason}`);
    process.exitCode = 1;
    return;
  }

  printAxiosReference(axiosReference);

  const mergeBnfn = await runSyncCase('mergeConfig', syncIterations, buildMergeWorkload(bnfn.mergeConfig));
  const mergeAxios = await runSyncCase(
    'mergeConfig',
    syncIterations,
    buildMergeWorkload(axiosReference.mergeConfig)
  );
  printComparison('mergeConfig', mergeBnfn, mergeAxios);

  const headersBnfn = await runSyncCase(
    'AxiosHeaders.from/set/toJSON',
    syncIterations,
    buildHeaderWorkload(bnfn.AxiosHeaders)
  );
  const headersAxios = await runSyncCase(
    'AxiosHeaders.from/set/toJSON',
    syncIterations,
    buildHeaderWorkload(axiosReference.AxiosHeaders)
  );
  printComparison('AxiosHeaders.from/set/toJSON', headersBnfn, headersAxios);

  const uriBnfn = await runSyncCase(
    'getUri(baseURL + params)',
    syncIterations,
    buildUriWorkload(bnfn)
  );
  const uriAxios = await runSyncCase(
    'getUri(baseURL + params)',
    syncIterations,
    buildUriWorkload(axiosReference.client)
  );
  printComparison('getUri(baseURL + params)', uriBnfn, uriAxios);

  const clientBnfn = await runAsyncCase(
    'client request pipeline',
    asyncIterations,
    buildClientWorkload(bnfn)
  );
  const clientAxios = await runAsyncCase(
    'client request pipeline',
    asyncIterations,
    buildClientWorkload(axiosReference.client)
  );
  printComparison('client request pipeline', clientBnfn, clientAxios);

  console.log(`blackhole=${blackhole}`);
}

await main();
