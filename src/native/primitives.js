import { loadNativePrimitives } from './ffi.js';

const native = loadNativePrimitives();

function normalizeParamValue(value) {
  if (value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function isVisitable(value) {
  return value !== null && typeof value === 'object' && !(value instanceof Date);
}

function isFlatArray(value) {
  return Array.isArray(value) && value.every((entry) => !isVisitable(entry));
}

function removeBrackets(value) {
  return String(value).endsWith('[]') ? String(value).slice(0, -2) : String(value);
}

function renderKey(path, key) {
  if (!path || path.length === 0) {
    return String(key);
  }

  return path
    .concat(key)
    .map((token, index) => {
      const value = removeBrackets(token);
      return index === 0 ? value : `[${value}]`;
    })
    .join('');
}

function flattenParamsEntries(params) {
  const entries = [];

  const append = (key, value) => {
    if (value === undefined) {
      return;
    }

    entries.push([String(key), normalizeParamValue(value)]);
  };

  const visit = (value, key, path) => {
    if (
      value &&
      !path &&
      ((Array.isArray(value) && isFlatArray(value)) || String(key).endsWith('[]'))
    ) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }

        append(`${removeBrackets(key)}[]`, entry);
      });
      return false;
    }

    if (isVisitable(value)) {
      return true;
    }

    append(renderKey(path, key), value);
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

function normalizeSerializedParams(serialised) {
  return serialised
    .replace(/%20/g, '+')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/~/g, '%7E');
}

export function percentEncodeComponent(value) {
  return native.percentEncode(String(value));
}

export function serializeParams(params) {
  if (!params) {
    return '';
  }

  if (params instanceof URLSearchParams) {
    return params.toString();
  }

  const entries = flattenParamsEntries(params);

  if (entries.length === 0) {
    return '';
  }

  return normalizeSerializedParams(native.serializeEntries(entries));
}

export function nativePrimitivesStatus() {
  return {
    available: true,
    path: native.path,
    reason: null,
  };
}
