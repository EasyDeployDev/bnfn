import AxiosHeaders from '../core/AxiosHeaders.js';
import AxiosError from '../core/AxiosError.js';
import CanceledError from '../core/CanceledError.js';
import buildFullPath from '../core/buildFullPath.js';
import buildURL from '../core/buildURL.js';

function bridgeAbortSignal(source, target) {
  if (!source) {
    return () => {};
  }

  if (source.aborted) {
    target.abort(source.reason);
    return () => {};
  }

  const onAbort = () => {
    target.abort(source.reason);
  };

  source.addEventListener('abort', onAbort, { once: true });

  return () => {
    source.removeEventListener('abort', onAbort);
  };
}

async function resolveResponseData(response, responseType) {
  switch (responseType) {
    case 'arrayBuffer':
      return response.arrayBuffer();
    case 'blob':
      return response.blob();
    case 'bytes': {
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
    case 'stream':
      return response.body;
    case 'text':
      return response.text();
    case 'json':
    default:
      return response.text();
  }
}

export default async function bunFetchAdapter(config) {
  const controller = new AbortController();
  const cleanupAbort = bridgeAbortSignal(config.signal, controller);
  const url = buildURL(buildFullPath(config.baseURL, config.url), config.params, config.paramsSerializer);
  const method = String(config.method || 'get').toUpperCase();
  const headers = AxiosHeaders.from(config.headers);
  const timeout = Number(config.timeout) || 0;
  const dataAllowed = method !== 'GET' && method !== 'HEAD';
  let timeoutId;

  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      const reason = new Error(`timeout of ${timeout}ms exceeded`);
      reason.name = 'TimeoutError';
      controller.abort(reason);
    }, timeout);
  }

  try {
    const response = await fetch(url, {
      ...(config.fetchOptions ?? {}),
      method,
      headers: headers.toJSON(),
      body: dataAllowed ? config.data : undefined,
      signal: controller.signal,
    });

    return {
      data: await resolveResponseData(response, config.responseType),
      status: response.status,
      statusText: response.statusText,
      headers: AxiosHeaders.from(response.headers),
      config,
      request: {
        url,
        method,
      },
    };
  } catch (error) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;

      if (reason?.name === 'TimeoutError') {
        throw new AxiosError(reason.message, AxiosError.ETIMEDOUT, config);
      }

      throw new CanceledError(reason?.message || error.message || 'canceled', config);
    }

    throw AxiosError.from(error, AxiosError.ERR_NETWORK, config);
  } finally {
    cleanupAbort();
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
