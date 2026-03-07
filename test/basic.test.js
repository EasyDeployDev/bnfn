import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import bnfn, { AxiosError } from '../src/index.js';

let originalFetch;
const baseURL = 'https://example.test';

beforeAll(() => {
  originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);

    if (url.pathname === '/echo' && request.method === 'GET') {
      return Response.json({
        ok: true,
        query: Object.fromEntries(url.searchParams.entries()),
      });
    }

    if (url.pathname === '/form' && request.method === 'POST') {
      return new Response(await request.text(), {
        headers: {
          'content-type': 'text/plain',
        },
      });
    }

    if (url.pathname === '/headers' && request.method === 'GET') {
      return Response.json({
        header: request.headers.get('x-runtime'),
      });
    }

    return new Response('missing', { status: 404 });
  };
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('bnfn', () => {
  test('works as a callable default export', async () => {
    const response = await bnfn('/echo', {
      baseURL,
      params: {
        q: 'bun zig',
        page: 2,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      ok: true,
      query: {
        q: 'bun zig',
        page: '2',
      },
    });
  });

  test('supports request interceptors on created instances', async () => {
    const client = bnfn.create({ baseURL });

    client.interceptors.request.use((config) => {
      config.headers = {
        ...(config.headers ?? {}),
        'X-Runtime': 'bun',
      };

      return config;
    });

    const response = await client.get('/headers');
    expect(response.data.header).toBe('bun');
  });

  test('supports async request and response interceptors', async () => {
    const client = bnfn.create({ baseURL });

    client.interceptors.request.use(async (config) => {
      config.headers = {
        ...(config.headers ?? {}),
        'X-Runtime': 'async-bun',
      };

      return config;
    });

    client.interceptors.response.use(async (response) => {
      response.data = {
        ...response.data,
        intercepted: true,
      };

      return response;
    });

    const response = await client.get('/headers');
    expect(response.data).toEqual({
      header: 'async-bun',
      intercepted: true,
    });
  });

  test('allows later request interceptors to recover from earlier errors', async () => {
    const client = bnfn.create({ baseURL });

    client.interceptors.request.use(() => {
      throw new Error('boom');
    });

    client.interceptors.request.use(undefined, (error) => {
      expect(error.message).toBe('boom');

      return {
        ...client.defaults,
        baseURL,
        url: '/echo',
        method: 'get',
      };
    });

    const response = await client.request('/ignored');
    expect(response.status).toBe(200);
    expect(response.data.ok).toBe(true);
  });

  test('serializes array and object params in getUri', () => {
    const uri = bnfn.getUri({
      baseURL,
      url: '/echo',
      params: {
        tags: ['bun', 'zig'],
        meta: {
          page: 1,
        },
        when: new Date('2026-03-07T00:00:00.000Z'),
      },
    });

    expect(uri).toBe(
      'https://example.test/echo?tags%5B%5D=bun&tags%5B%5D=zig&meta%5Bpage%5D=1&when=2026-03-07T00:00:00.000Z'
    );
  });

  test('serializes x-www-form-urlencoded bodies', async () => {
    const response = await bnfn.post(
      '/form',
      {
        hello: 'bun zig',
      },
      {
        baseURL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        responseType: 'text',
      }
    );

    expect(response.data).toBe('hello=bun+zig');
  });

  test('rejects non-2xx responses with AxiosError', async () => {
    await expect(bnfn.get('/missing', { baseURL })).rejects.toBeInstanceOf(AxiosError);
  });

  test('reports native layer status', () => {
    const status = bnfn.native();
    expect(status.available).toBe(true);
    expect(typeof status.path).toBe('string');
    expect(status.reason).toBeNull();
  });
});
