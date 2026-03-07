import bunFetchAdapter from './adapters/bun-fetch.js';
import {
  isBlob,
  isFormData,
  isPlainObject,
  isReadableStream,
  isString,
  isURLSearchParams,
} from './utils.js';
import { serializeParams } from './native/primitives.js';

const defaults = {
  adapter: bunFetchAdapter,
  timeout: 0,
  responseType: 'json',
  validateStatus(status) {
    return status >= 200 && status < 300;
  },
  transformRequest: [
    function transformRequest(data, headers) {
      if (data == null) {
        return data;
      }

      if (
        isString(data) ||
        isFormData(data) ||
        isURLSearchParams(data) ||
        isBlob(data) ||
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data) ||
        isReadableStream(data)
      ) {
        return data;
      }

      if (isPlainObject(data)) {
        const contentType = headers.getContentType();

        if (contentType?.includes('application/x-www-form-urlencoded')) {
          return serializeParams(data);
        }

        if (!contentType) {
          headers.setContentType('application/json');
        }

        return JSON.stringify(data);
      }

      return data;
    },
  ],
  transformResponse: [
    function transformResponse(data, headers) {
      if (typeof data !== 'string' || data.length === 0) {
        return data;
      }

      if (
        this.responseType === 'text' ||
        this.responseType === 'stream' ||
        this.responseType === 'arrayBuffer' ||
        this.responseType === 'blob' ||
        this.responseType === 'bytes'
      ) {
        return data;
      }

      const contentType = headers?.get?.('content-type') || '';
      const wantsJSON = this.responseType === 'json' || contentType.includes('application/json');

      if (!wantsJSON) {
        return data;
      }

      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    },
  ],
  headers: {
    common: {
      Accept: 'application/json, text/plain, */*',
    },
  },
};

['delete', 'get', 'head', 'options', 'post', 'put', 'patch'].forEach((method) => {
  defaults.headers[method] = {};
});

export default defaults;
