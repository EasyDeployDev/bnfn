import AxiosHeaders from './AxiosHeaders.js';
import AxiosError from './AxiosError.js';
import CanceledError from './CanceledError.js';
import transformData from './transformData.js';

const hasOwn = Object.prototype.hasOwnProperty;
const headerBuckets = Object.freeze({
  delete: true,
  get: true,
  head: true,
  options: true,
  post: true,
  put: true,
  patch: true,
  common: true,
});

function flattenHeaders(config) {
  if (config.headers instanceof AxiosHeaders) {
    return AxiosHeaders.from(config.headers);
  }

  const headers = config.headers;

  if (!headers) {
    return new AxiosHeaders();
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return AxiosHeaders.from(headers);
  }

  if (Array.isArray(headers)) {
    return AxiosHeaders.from(headers);
  }

  const flattened = new AxiosHeaders();

  if (headers.common) {
    flattened.set(headers.common);
  }

  if (config.method && headers[config.method]) {
    flattened.set(headers[config.method]);
  }

  for (const name in headers) {
    if (hasOwn.call(headers, name) && !headerBuckets[name]) {
      flattened.set(name, headers[name]);
    }
  }

  return flattened;
}

function throwIfCancellationRequested(config) {
  if (config.signal?.aborted) {
    throw new CanceledError(config.signal.reason?.message || 'canceled', config);
  }
}

function resolveAdapter(config) {
  return config.adapter;
}

export default async function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  config.headers = flattenHeaders(config);
  config.data = transformData.call(config, config.data, config.headers, config.transformRequest);

  const adapter = resolveAdapter(config);

  try {
    const response = await adapter(config);

    throwIfCancellationRequested(config);

    response.headers = AxiosHeaders.from(response.headers);
    response.data = transformData.call(
      config,
      response.data,
      response.headers,
      config.transformResponse,
      response.status
    );

    if (!config.validateStatus || config.validateStatus(response.status)) {
      return response;
    }

    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      response.request,
      response
    );
  } catch (error) {
    if (error?.response) {
      error.response.headers = AxiosHeaders.from(error.response.headers);
      error.response.data = transformData.call(
        config,
        error.response.data,
        error.response.headers,
        config.transformResponse,
        error.response.status
      );
    }

    throw error;
  }
}
