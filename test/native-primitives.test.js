import { describe, test } from 'bun:test';
import { percentEncodeComponent, serializeParams } from '../src/native/primitives.js';

const encoder = new TextEncoder();
const hex = '0123456789ABCDEF';
const profileDefaults = {
  local: {
    seedStart: 0,
    seedCount: 4,
    percentCases: 500,
    serializeCases: 250,
    urlSearchParamsCases: 20,
  },
  ci: {
    seedStart: 0,
    seedCount: 16,
    percentCases: 1000,
    serializeCases: 500,
    urlSearchParamsCases: 64,
  },
  soak: {
    seedStart: 0,
    seedCount: 128,
    percentCases: 4000,
    serializeCases: 2000,
    urlSearchParamsCases: 256,
  },
};
const interestingFragments = [
  '',
  'a',
  'A',
  '0',
  '-',
  '_',
  '.',
  '~',
  ' ',
  '+',
  '&',
  '=',
  '%',
  '?',
  '#',
  '[',
  ']',
  '/',
  '\\',
  '\n',
  '\r',
  '\t',
  '\u0000',
  'π',
  '漢',
  '🙂',
  '€',
  'ß',
  'e\u0301',
  '🧪',
  'Ω',
  '中',
];

function parsePositiveInt(name, fallback, ...legacyNames) {
  const raw = envValue(name, ...legacyNames);

  if (raw == null || raw === '') {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer. Received "${raw}".`);
  }

  return value;
}

function parseNonNegativeInt(name, fallback, ...legacyNames) {
  const raw = envValue(name, ...legacyNames);

  if (raw == null || raw === '') {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer. Received "${raw}".`);
  }

  return value;
}

function envValue(...names) {
  for (const name of names) {
    if (name && process.env[name] != null) {
      return process.env[name];
    }
  }

  return undefined;
}

function resolveStressConfig() {
  const profileName =
    envValue(
      'BNFN_NATIVE_STRESS_PROFILE',
      'BNF_NATIVE_STRESS_PROFILE',
      'BFN_NATIVE_STRESS_PROFILE',
      'BUNXIOS_NATIVE_STRESS_PROFILE'
    ) ??
    (process.env.CI ? 'ci' : 'local');
  const defaults = profileDefaults[profileName];

  if (!defaults) {
    throw new Error(
      `Unsupported BNFN_NATIVE_STRESS_PROFILE "${profileName}". Expected one of ${Object.keys(
        profileDefaults
      ).join(', ')}.`
    );
  }

  return {
    profileName,
    seedStart: parseNonNegativeInt(
      'BNFN_NATIVE_STRESS_SEED_START',
      defaults.seedStart,
      'BNF_NATIVE_STRESS_SEED_START',
      'BFN_NATIVE_STRESS_SEED_START',
      'BUNXIOS_NATIVE_STRESS_SEED_START'
    ),
    seedCount: parsePositiveInt(
      'BNFN_NATIVE_STRESS_SEED_COUNT',
      defaults.seedCount,
      'BNF_NATIVE_STRESS_SEED_COUNT',
      'BFN_NATIVE_STRESS_SEED_COUNT',
      'BUNXIOS_NATIVE_STRESS_SEED_COUNT'
    ),
    percentCases: parsePositiveInt(
      'BNFN_NATIVE_STRESS_PERCENT_CASES',
      defaults.percentCases,
      'BNF_NATIVE_STRESS_PERCENT_CASES',
      'BFN_NATIVE_STRESS_PERCENT_CASES',
      'BUNXIOS_NATIVE_STRESS_PERCENT_CASES'
    ),
    serializeCases: parsePositiveInt(
      'BNFN_NATIVE_STRESS_SERIALIZE_CASES',
      defaults.serializeCases,
      'BNF_NATIVE_STRESS_SERIALIZE_CASES',
      'BFN_NATIVE_STRESS_SERIALIZE_CASES',
      'BUNXIOS_NATIVE_STRESS_SERIALIZE_CASES'
    ),
    urlSearchParamsCases: parsePositiveInt(
      'BNFN_NATIVE_STRESS_URLSEARCHPARAMS_CASES',
      defaults.urlSearchParamsCases,
      'BNF_NATIVE_STRESS_URLSEARCHPARAMS_CASES',
      'BFN_NATIVE_STRESS_URLSEARCHPARAMS_CASES',
      'BUNXIOS_NATIVE_STRESS_URLSEARCHPARAMS_CASES'
    ),
  };
}

const stressConfig = resolveStressConfig();
const seeds = Array.from({ length: stressConfig.seedCount }, (_, index) => {
  return (stressConfig.seedStart + index) >>> 0;
});

function createRng(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function randomInt(rng, min, maxExclusive) {
  return min + Math.floor(rng() * (maxExclusive - min));
}

function randomBool(rng) {
  return randomInt(rng, 0, 2) === 1;
}

function randomString(rng, maxSegments = 8) {
  const count = randomInt(rng, 0, maxSegments + 1);
  let out = '';

  for (let index = 0; index < count; index += 1) {
    out += interestingFragments[randomInt(rng, 0, interestingFragments.length)];
  }

  return out;
}

function randomDate(rng) {
  return new Date(randomInt(rng, 0, Date.UTC(2100, 0, 1)));
}

function randomJsonValue(rng, depth = 0) {
  const choice = depth >= 2 ? randomInt(rng, 0, 5) : randomInt(rng, 0, 7);

  switch (choice) {
    case 0:
      return randomString(rng, 6);
    case 1:
      return randomInt(rng, -10_000, 10_001);
    case 2:
      return randomBool(rng);
    case 3:
      return null;
    case 4:
      return randomDate(rng);
    case 5: {
      const length = randomInt(rng, 0, 4);
      const array = [];

      for (let index = 0; index < length; index += 1) {
        array.push(randomJsonValue(rng, depth + 1));
      }

      return array;
    }
    default: {
      const count = randomInt(rng, 0, 4);
      const object = {};

      for (let index = 0; index < count; index += 1) {
        const key = randomString(rng, 4) || `json_${depth}_${index}`;
        object[`${key}_${index}`] = randomJsonValue(rng, depth + 1);
      }

      return object;
    }
  }
}

function randomParamValue(rng, depth = 0) {
  const choice = depth >= 2 ? randomInt(rng, 0, 7) : randomInt(rng, 0, 9);

  switch (choice) {
    case 0:
      return randomString(rng, 6);
    case 1:
      return randomInt(rng, -1_000_000, 1_000_001);
    case 2:
      return randomBool(rng);
    case 3:
      return BigInt(randomInt(rng, -50_000, 50_001));
    case 4:
      return randomDate(rng);
    case 5:
      return null;
    case 6:
      return undefined;
    case 7: {
      const length = randomInt(rng, 0, 5);
      const array = [];

      for (let index = 0; index < length; index += 1) {
        array.push(randomParamValue(rng, depth + 1));
      }

      return array;
    }
    default:
      return randomJsonValue(rng, depth + 1);
  }
}

function randomParamsObject(rng) {
  const count = randomInt(rng, 0, 8);
  const params = {};

  for (let index = 0; index < count; index += 1) {
    const key = randomString(rng, 4) || `param_${index}`;
    params[`${key}_${index}`] = randomParamValue(rng);
  }

  return params;
}

function isUnreserved(byte) {
  return (
    (byte >= 0x61 && byte <= 0x7a) ||
    (byte >= 0x41 && byte <= 0x5a) ||
    (byte >= 0x30 && byte <= 0x39) ||
    byte === 0x2d ||
    byte === 0x2e ||
    byte === 0x5f ||
    byte === 0x7e
  );
}

function referencePercentEncode(value) {
  const bytes = encoder.encode(value);
  let out = '';

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];

    if (isUnreserved(byte)) {
      out += String.fromCharCode(byte);
      continue;
    }

    out += `%${hex[(byte >> 4) & 0x0f]}${hex[byte & 0x0f]}`;
  }

  return out;
}

function referenceNormalizeParamValue(value) {
  if (value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function referenceIsVisitable(value) {
  return value !== null && typeof value === 'object' && !(value instanceof Date);
}

function referenceIsFlatArray(value) {
  return Array.isArray(value) && value.every((entry) => !referenceIsVisitable(entry));
}

function referenceRemoveBrackets(value) {
  return String(value).endsWith('[]') ? String(value).slice(0, -2) : String(value);
}

function referenceRenderKey(path, key) {
  if (!path || path.length === 0) {
    return String(key);
  }

  return path
    .concat(key)
    .map((token, index) => {
      const value = referenceRemoveBrackets(token);
      return index === 0 ? value : `[${value}]`;
    })
    .join('');
}

function referenceFlattenEntries(params) {
  const entries = [];

  const append = (key, value) => {
    if (value === undefined) {
      return;
    }

    entries.push([String(key), referenceNormalizeParamValue(value)]);
  };

  const visit = (value, key, path) => {
    if (
      value &&
      !path &&
      ((Array.isArray(value) && referenceIsFlatArray(value)) || String(key).endsWith('[]'))
    ) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }

        append(`${referenceRemoveBrackets(key)}[]`, entry);
      });
      return false;
    }

    if (referenceIsVisitable(value)) {
      return true;
    }

    append(referenceRenderKey(path, key), value);
    return false;
  };

  const build = (value, path) => {
    if (!value || typeof value !== 'object') {
      return;
    }

    Object.entries(value).forEach(([key, entry]) => {
      if (entry === undefined) {
        return;
      }

      const trimmedKey = typeof key === 'string' ? key.trim() : key;
      const shouldVisit = visit(entry, trimmedKey, path);

      if (shouldVisit) {
        build(entry, path ? path.concat(trimmedKey) : [trimmedKey]);
      }
    });
  };

  build(params, undefined);

  return entries;
}

function referenceSerializeToken(value) {
  return referencePercentEncode(String(value))
    .replace(/%20/g, '+')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/~/g, '%7E');
}

function referenceSerializeParams(params) {
  if (!params) {
    return '';
  }

  if (params instanceof URLSearchParams) {
    return params.toString();
  }

  const entries = referenceFlattenEntries(params);

  if (entries.length === 0) {
    return '';
  }

  let out = '';

  for (let index = 0; index < entries.length; index += 1) {
    const [key, value] = entries[index];

    if (index !== 0) {
      out += '&';
    }

    out += `${referenceSerializeToken(key)}=${referenceSerializeToken(value)}`;
  }

  return out;
}

function expectedDecodedEntries(params) {
  if (params instanceof URLSearchParams) {
    return Array.from(params.entries());
  }

  return referenceFlattenEntries(params);
}

function stablePrint(value) {
  return JSON.stringify(
    value,
    (_key, current) => {
      if (typeof current === 'bigint') {
        return `${current}n`;
      }

      if (current instanceof Date) {
        return current.toISOString();
      }

      if (current instanceof URLSearchParams) {
        return Array.from(current.entries());
      }

      return current;
    },
    2
  );
}

function fail(label, context) {
  throw new Error(`${label}\n${stablePrint(context)}`);
}

function assertEqual(actual, expected, label, context) {
  if (actual !== expected) {
    fail(label, {
      ...context,
      actual,
      expected,
    });
  }
}

function assertDeepEqual(actual, expected, label, context) {
  const left = stablePrint(actual);
  const right = stablePrint(expected);

  if (left !== right) {
    fail(label, {
      ...context,
      actual,
      expected,
    });
  }
}

describe('native primitives', () => {
  test('percentEncodeComponent matches the reference implementation for ASCII and unicode corpus', () => {
    const corpus = [];

    for (let code = 0; code < 128; code += 1) {
      corpus.push(String.fromCharCode(code));
    }

    corpus.push(
      '',
      'simple',
      'hello world',
      'name=value&next=true',
      'π/漢🙂',
      'e\u0301',
      '\u0000start',
      'line\nbreak',
      'tabs\tand spaces'
    );

    for (let index = 0; index < corpus.length; index += 1) {
      const input = corpus[index];
      const actual = percentEncodeComponent(input);
      const expected = referencePercentEncode(input);

      assertEqual(actual, expected, 'percent encoder mismatch on fixed corpus', {
        case: index,
        input,
      });
    }
  });

  test('percentEncodeComponent matches the reference implementation across deterministic random cases', () => {
    seeds.forEach((seed) => {
      const rng = createRng(seed);

      for (let index = 0; index < stressConfig.percentCases; index += 1) {
        const input = randomString(rng, 10);
        const actual = percentEncodeComponent(input);
        const expected = referencePercentEncode(input);

        assertEqual(actual, expected, 'percent encoder mismatch on random case', {
          seed,
          case: index,
          input,
        });
      }
    });
  });

  test('serializeParams matches the reference implementation across deterministic object cases', () => {
    const fixedCases = [
      {},
      {
        q: 'bun zig',
        page: 2,
      },
      {
        empty: '',
        space: ' ',
        plus: '+',
        nil: null,
        missing: undefined,
      },
      {
        tags: ['bun', 'zig', null, undefined, ''],
        nested: {
          page: 1,
          ok: true,
        },
        when: new Date('2026-03-07T00:00:00.000Z'),
      },
      {
        multi: [['a', 'b'], ['c']],
        count: 123n,
        punctuation: 'x=y&z',
      },
    ];

    fixedCases.forEach((params, index) => {
      const actual = serializeParams(params);
      const expected = referenceSerializeParams(params);

      assertEqual(actual, expected, 'serializer mismatch on fixed case', {
        case: index,
        params,
      });

      assertDeepEqual(
        Array.from(new URLSearchParams(actual).entries()),
        expectedDecodedEntries(params),
        'decoded entries mismatch on fixed case',
        {
          case: index,
          params,
          serialized: actual,
        }
      );
    });

    seeds.forEach((seed) => {
      const rng = createRng(seed);

      for (let index = 0; index < stressConfig.serializeCases; index += 1) {
        const params = randomParamsObject(rng);
        const actual = serializeParams(params);
        const expected = referenceSerializeParams(params);

        assertEqual(actual, expected, 'serializer mismatch on random case', {
          seed,
          case: index,
          params,
        });

        assertDeepEqual(
          Array.from(new URLSearchParams(actual).entries()),
          expectedDecodedEntries(params),
          'decoded entries mismatch on random case',
          {
            seed,
            case: index,
            params,
            serialized: actual,
          }
        );
      }
    });
  });

  test('serializeParams preserves URLSearchParams input byte-for-byte', () => {
    seeds.forEach((seed) => {
      const rng = createRng(seed);
      const params = new URLSearchParams();

      for (let index = 0; index < stressConfig.urlSearchParamsCases; index += 1) {
        params.append(randomString(rng, 4) || `key_${index}`, randomString(rng, 5));
      }

      const actual = serializeParams(params);
      const expected = params.toString();

      assertEqual(actual, expected, 'URLSearchParams passthrough mismatch', {
        seed,
        params,
      });
    });
  });

  test('stress profile configuration is valid and deterministic', () => {
    assertDeepEqual(
      {
        ...stressConfig,
        seeds,
      },
      {
        ...stressConfig,
        seeds: Array.from({ length: stressConfig.seedCount }, (_, index) => {
          return (stressConfig.seedStart + index) >>> 0;
        }),
      },
      'stress profile config drifted',
      stressConfig
    );
  });
});
