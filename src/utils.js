const hasOwn = Object.prototype.hasOwnProperty;

export function isUndefined(value) {
  return typeof value === 'undefined';
}

export function isString(value) {
  return typeof value === 'string';
}

export function isNumber(value) {
  return typeof value === 'number';
}

export function isFunction(value) {
  return typeof value === 'function';
}

export function isObject(value) {
  return value !== null && typeof value === 'object';
}

export function isPlainObject(value) {
  if (!isObject(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

export function isURLSearchParams(value) {
  return typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams;
}

export function isBlob(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

export function isReadableStream(value) {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

export function forEach(collection, iterator) {
  if (!collection) {
    return;
  }

  if (Array.isArray(collection)) {
    collection.forEach(iterator);
    return;
  }

  Object.entries(collection).forEach(([key, value]) => {
    iterator(value, key);
  });
}

export function asArray(value) {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function mergeInto(target, source) {
  if (!isPlainObject(source)) {
    return target;
  }

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      target[key] = value.slice();
      continue;
    }

    if (isPlainObject(value)) {
      const base = isPlainObject(target[key]) ? target[key] : {};
      target[key] = deepMerge(base, value);
      continue;
    }

    target[key] = value;
  }

  return target;
}

export function deepMerge(...sources) {
  return sources.reduce((target, source) => mergeInto(target, source), {});
}

export function combineURLs(baseURL, relativeURL) {
  return `${baseURL.replace(/\/+$/, '')}/${relativeURL.replace(/^\/+/, '')}`;
}

export function isAbsoluteURL(url) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(url);
}

export function trim(value) {
  return String(value).trim();
}

export function toFiniteNumber(value) {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : null;
}

export function hasOwnProp(object, key) {
  return hasOwn.call(object, key);
}
