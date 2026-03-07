import bnfn, { AxiosError, AxiosHeaders, native } from '@easydev/bnfn';

const client = bnfn.create({
  baseURL: 'https://example.test',
  responseType: 'json',
});

client.interceptors.request.use((config) => {
  config.headers = AxiosHeaders.concat(config.headers ?? {}, {
    'x-runtime': 'bun',
  });

  return config;
});

async function typecheck() {
  const response = await client.get<{ ok: boolean }>('/ping', {
    params: {
      page: 1,
      tags: ['bun', 'zig'],
    },
  });

  const ok: boolean = response.data.ok;
  const headers = new AxiosHeaders({
    Accept: 'application/json',
  });
  headers.setContentType('application/json');

  const status = native();
  const path: string = status.path;
  const error = new AxiosError('boom');
  const isAxios: boolean = bnfn.isAxiosError(error);

  return {
    ok,
    headers,
    path,
    isAxios,
  };
}

void typecheck();
