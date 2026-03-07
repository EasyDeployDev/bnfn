const storeKey = Symbol('headers');
const hasOwn = Object.prototype.hasOwnProperty;

function createStore() {
  return Object.create(null);
}

function needsNormalization(value, trimmed) {
  if (value.length !== trimmed.length) {
    return true;
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    const code = trimmed.charCodeAt(index);

    if (code >= 65 && code <= 90) {
      return true;
    }
  }

  return false;
}

function normalizeName(name) {
  const value = String(name);
  const trimmed = value.trim();

  if (!needsNormalization(value, trimmed)) {
    return trimmed;
  }

  return trimmed.toLowerCase();
}

function normalizeValue(value) {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  return String(value);
}

function writeHeader(store, name, value) {
  const normalizedName = normalizeName(name);

  if (value == null) {
    delete store[normalizedName];
    return;
  }

  store[normalizedName] = normalizeValue(value);
}

function cloneValue(value) {
  return Array.isArray(value) ? value.slice() : value;
}

function cloneStore(source) {
  const target = createStore();

  for (const name in source) {
    if (hasOwn.call(source, name)) {
      target[name] = cloneValue(source[name]);
    }
  }

  return target;
}

export default class AxiosHeaders {
  constructor(headers) {
    this[storeKey] = createStore();

    if (headers) {
      this.set(headers);
    }
  }

  set(header, value) {
    if (header == null) {
      return this;
    }

    if (header instanceof AxiosHeaders) {
      for (const [name, currentValue] of header) {
        writeHeader(this[storeKey], name, currentValue);
      }
      return this;
    }

    if (typeof Headers !== 'undefined' && header instanceof Headers) {
      header.forEach((currentValue, name) => {
        writeHeader(this[storeKey], name, currentValue);
      });
      return this;
    }

    if (Array.isArray(header)) {
      for (let index = 0; index < header.length; index += 1) {
        const entry = header[index];
        writeHeader(this[storeKey], entry[0], entry[1]);
      }
      return this;
    }

    if (typeof header === 'object' && value === undefined) {
      for (const name in header) {
        if (hasOwn.call(header, name)) {
          writeHeader(this[storeKey], name, header[name]);
        }
      }
      return this;
    }

    writeHeader(this[storeKey], header, value);
    return this;
  }

  get(header) {
    return this[storeKey][normalizeName(header)];
  }

  has(header) {
    return hasOwn.call(this[storeKey], normalizeName(header));
  }

  delete(header) {
    const normalizedName = normalizeName(header);

    if (!hasOwn.call(this[storeKey], normalizedName)) {
      return false;
    }

    delete this[storeKey][normalizedName];
    return true;
  }

  clear() {
    this[storeKey] = createStore();
    return this;
  }

  normalize() {
    return this;
  }

  concat(...targets) {
    targets.forEach((target) => {
      this.set(target);
    });

    return this;
  }

  toJSON() {
    const out = {};
    const store = this[storeKey];

    for (const name in store) {
      if (!hasOwn.call(store, name)) {
        continue;
      }

      const value = store[name];

      if (value != null) {
        out[name] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    return out;
  }

  setContentType(value) {
    return this.set('Content-Type', value);
  }

  getContentType() {
    return this.get('Content-Type');
  }

  [Symbol.iterator]() {
    return Object.entries(this[storeKey])[Symbol.iterator]();
  }

  static from(thing) {
    if (thing instanceof AxiosHeaders) {
      const headers = new AxiosHeaders();
      headers[storeKey] = cloneStore(thing[storeKey]);
      return headers;
    }

    return new AxiosHeaders(thing);
  }

  static concat(...targets) {
    return new AxiosHeaders().concat(...targets);
  }
}
