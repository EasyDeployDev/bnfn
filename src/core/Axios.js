import InterceptorManager from './InterceptorManager.js';
import mergeConfig from './mergeConfig.js';
import buildFullPath from './buildFullPath.js';
import buildURL from './buildURL.js';
import dispatchRequest from './dispatchRequest.js';

async function runInterceptorChain(handlers, initialValue, rejected = false) {
  let current = initialValue;
  let currentRejected = rejected;

  for (let index = 0; index < handlers.length; index += 1) {
    const interceptor = handlers[index];

    if (!interceptor) {
      continue;
    }

    const fn = currentRejected ? interceptor.rejected : interceptor.fulfilled;

    if (!fn) {
      continue;
    }

    try {
      current = await fn(current);
      currentRejected = false;
    } catch (error) {
      current = error;
      currentRejected = true;
    }
  }

  return {
    rejected: currentRejected,
    value: current,
  };
}

export default class Axios {
  constructor(instanceConfig = {}) {
    this.defaults = mergeConfig({}, instanceConfig);
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  async request(configOrUrl, config) {
    const requestConfig =
      typeof configOrUrl === 'string'
        ? {
            ...(config ?? {}),
            url: configOrUrl,
          }
        : (configOrUrl ?? {});

    const merged = mergeConfig(this.defaults, requestConfig);
    merged.method = String(merged.method || 'get').toLowerCase();

    const requestState = await runInterceptorChain(this.interceptors.request.handlers, merged);

    if (requestState.rejected) {
      throw requestState.value;
    }

    let responseState;

    try {
      const response = await dispatchRequest(requestState.value);
      responseState = await runInterceptorChain(this.interceptors.response.handlers, response);
    } catch (error) {
      responseState = await runInterceptorChain(this.interceptors.response.handlers, error, true);
    }

    if (responseState.rejected) {
      throw responseState.value;
    }

    return responseState.value;
  }

  getUri(config) {
    const merged = mergeConfig(this.defaults, config);
    return buildURL(buildFullPath(merged.baseURL, merged.url), merged.params, merged.paramsSerializer);
  }
}

['delete', 'get', 'head', 'options'].forEach((method) => {
  Axios.prototype[method] = function withoutData(url, config) {
    return this.request({
      ...(config ?? {}),
      method,
      url,
    });
  };
});

['post', 'put', 'patch'].forEach((method) => {
  Axios.prototype[method] = function withData(url, data, config) {
    return this.request({
      ...(config ?? {}),
      method,
      url,
      data,
    });
  };
});
