import { serializeParams } from '../native/primitives.js';

export default function buildURL(url, params, paramsSerializer) {
  if (!params) {
    return url;
  }

  const serialized = paramsSerializer ? paramsSerializer(params) : serializeParams(params);

  if (!serialized) {
    return url;
  }

  const hashIndex = url.indexOf('#');
  const cleanURL = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const separator = cleanURL.includes('?') ? '&' : '?';

  return `${cleanURL}${separator}${serialized}`;
}
