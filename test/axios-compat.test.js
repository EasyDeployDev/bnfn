import { describe, expect, test } from 'bun:test';
import axios from 'axios';
import bnfn from '../src/index.js';

const baseURL = 'https://service.example/api';

function normalizeHeaderSnapshot(headers) {
  return Object.fromEntries(
    Object.entries(headers.toJSON()).map(([key, value]) => {
      return [key.toLowerCase(), value];
    })
  );
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

function getHeader(headers, name) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return headers.get(name);
  }

  const key = Object.keys(headers).find((candidate) => {
    return candidate.toLowerCase() === name.toLowerCase();
  });

  if (!key) {
    return null;
  }

  const value = headers[key];
  return Array.isArray(value) ? value.join(', ') : value;
}

function createEchoAdapter(label) {
  return async (config) => {
    return {
      data: {
        ok: true,
        label,
        method: config.method,
        url: config.url,
        contentType: getHeader(config.headers, 'content-type'),
        runtime: getHeader(config.headers, 'x-runtime'),
        body: config.data,
      },
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
      },
      config,
      request: {
        label,
      },
    };
  };
}

function createClient(library, label, adapter) {
  const client = library.create({
    baseURL,
    timeout: 2_000,
    adapter,
    headers: {
      common: {
        Accept: 'application/json',
      },
    },
  });

  client.interceptors.request.use((config) => {
    setHeader(config, 'x-runtime', label);
    return config;
  });

  client.interceptors.response.use((response) => {
    response.data.via = label;
    return response;
  });

  return client;
}

describe('bnfn axios compatibility', () => {
  test('matches axios getUri output for params serialization', () => {
    const request = {
      baseURL,
      url: '/search',
      params: {
        q: 'bun zig',
        page: 2,
        tags: ['fast', 'native'],
        meta: {
          source: 'bench',
        },
      },
    };

    expect(bnfn.getUri(request)).toBe(axios.getUri(request));
  });

  test('matches axios request config shaping for interceptors and JSON payloads', async () => {
    const payload = {
      query: 'bun zig',
      filters: {
        stars: 100,
      },
    };
    const params = {
      page: 2,
      tags: ['fast', 'native'],
    };

    const bnfnClient = createClient(bnfn, 'bnfn', createEchoAdapter('bnfn'));
    const axiosClient = createClient(axios, 'axios', createEchoAdapter('axios'));

    const [bnfnResponse, axiosResponse] = await Promise.all([
      bnfnClient.post('/search', payload, { params }),
      axiosClient.post('/search', payload, { params }),
    ]);

    expect(bnfnResponse.status).toBe(200);
    expect(axiosResponse.status).toBe(200);
    expect(bnfnResponse.data.method).toBe('post');
    expect(axiosResponse.data.method).toBe('post');
    expect(bnfnResponse.data.runtime).toBe('bnfn');
    expect(axiosResponse.data.runtime).toBe('axios');
    expect(bnfnResponse.data.contentType).toBe(axiosResponse.data.contentType);
    expect(JSON.parse(bnfnResponse.data.body)).toEqual(payload);
    expect(bnfnResponse.data.body).toBe(axiosResponse.data.body);
    expect(bnfnResponse.data.via).toBe('bnfn');
    expect(axiosResponse.data.via).toBe('axios');
    expect(
      bnfnClient.getUri({
        url: '/search',
        params,
      })
    ).toBe(
      axiosClient.getUri({
        url: '/search',
        params,
      })
    );
  });

  test('matches axios AxiosHeaders normalization output', () => {
    const rawHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Trace-Id': 'trace-123',
    };

    const bnfnHeaders = bnfn.AxiosHeaders.from(rawHeaders);
    bnfnHeaders.set('x-request-id', 'req-1');

    const axiosHeaders = axios.AxiosHeaders.from(rawHeaders);
    axiosHeaders.set('x-request-id', 'req-1');

    expect(normalizeHeaderSnapshot(bnfnHeaders)).toEqual(normalizeHeaderSnapshot(axiosHeaders));
  });
});
