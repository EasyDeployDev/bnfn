export type LowercaseMethod =
  | 'delete'
  | 'get'
  | 'head'
  | 'options'
  | 'post'
  | 'put'
  | 'patch';

export type AxiosMethod = LowercaseMethod | Uppercase<LowercaseMethod> | (string & {});

export type AxiosResponseType = 'arrayBuffer' | 'blob' | 'bytes' | 'json' | 'stream' | 'text';

export type AxiosHeaderPrimitive = string | number | boolean | null | undefined;
export type AxiosHeaderValue = AxiosHeaderPrimitive | readonly AxiosHeaderPrimitive[];

export interface RawAxiosHeaders {
  [header: string]: AxiosHeaderValue;
}

export type AxiosHeadersDefaults = RawAxiosHeaders &
  Partial<Record<LowercaseMethod | 'common', RawAxiosHeaders>>;

export type AxiosHeadersSource =
  | AxiosHeaders
  | Headers
  | RawAxiosHeaders
  | ReadonlyArray<readonly [string, AxiosHeaderValue]>;

export type AxiosRequestHeaders = AxiosHeadersSource | AxiosHeadersDefaults;

export type AxiosParamValue =
  | string
  | number
  | boolean
  | bigint
  | Date
  | null
  | undefined
  | Record<string, unknown>
  | readonly AxiosParamValue[];

export interface AxiosParamsObject {
  [key: string]: AxiosParamValue;
}

export type AxiosParams = AxiosParamsObject | URLSearchParams;

export interface AxiosRequestConfig<D = unknown> {
  url?: string;
  method?: AxiosMethod;
  baseURL?: string;
  headers?: AxiosRequestHeaders;
  params?: AxiosParams;
  paramsSerializer?: (params: AxiosParams) => string;
  data?: D;
  timeout?: number;
  responseType?: AxiosResponseType;
  signal?: AbortSignal;
  adapter?: AxiosAdapter;
  transformRequest?: AxiosTransformer<D> | readonly AxiosTransformer<D>[];
  transformResponse?: AxiosTransformer<D> | readonly AxiosTransformer<D>[];
  validateStatus?: (status: number) => boolean;
  fetchOptions?: RequestInit;
  [key: string]: unknown;
}

export interface AxiosResponse<T = unknown, D = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: AxiosHeaders;
  config: AxiosRequestConfig<D>;
  request: unknown;
}

export type AxiosPromise<T = unknown, D = unknown> = Promise<AxiosResponse<T, D>>;

export type AxiosTransformer<D = unknown> = (
  this: AxiosRequestConfig<D>,
  data: unknown,
  headers: AxiosHeaders,
  status?: number
) => unknown;

export type AxiosFulfilledInterceptor<T> = (value: T) => T | Promise<T>;
export type AxiosRejectedInterceptor = (error: unknown) => unknown;

export interface AxiosInterceptorHandler<T> {
  fulfilled?: AxiosFulfilledInterceptor<T>;
  rejected?: AxiosRejectedInterceptor;
}

export interface AxiosInterceptorManager<T> {
  use(fulfilled?: AxiosFulfilledInterceptor<T>, rejected?: AxiosRejectedInterceptor): number;
  eject(id: number): void;
  clear(): void;
  forEach(iterator: (handler: AxiosInterceptorHandler<T>) => void): void;
}

export interface NativeStatus {
  available: true;
  path: string;
  reason: null;
}

export type AxiosAdapter = <T = unknown, D = unknown>(
  config: AxiosRequestConfig<D>
) => AxiosPromise<T, D>;

export class AxiosHeaders implements Iterable<[string, string | string[] | null | undefined]> {
  constructor(headers?: AxiosHeadersSource | null);
  set(header?: string | AxiosHeadersSource | null, value?: AxiosHeaderValue): this;
  get(header: string): string | string[] | null | undefined;
  has(header: string): boolean;
  delete(header: string): boolean;
  clear(): this;
  normalize(): this;
  concat(...targets: Array<AxiosHeadersSource | null | undefined>): this;
  toJSON(): Record<string, string>;
  setContentType(value?: AxiosHeaderValue): this;
  getContentType(): string | string[] | null | undefined;
  [Symbol.iterator](): IterableIterator<[string, string | string[] | null | undefined]>;
  static from(thing?: AxiosHeadersSource | null): AxiosHeaders;
  static concat(...targets: Array<AxiosHeadersSource | null | undefined>): AxiosHeaders;
}

export class AxiosError<T = unknown, D = unknown> extends Error {
  constructor(
    message: string,
    code?: string,
    config?: AxiosRequestConfig<D>,
    request?: unknown,
    response?: AxiosResponse<T, D>
  );
  code?: string;
  config?: AxiosRequestConfig<D>;
  request?: unknown;
  response?: AxiosResponse<T, D>;
  isAxiosError: true;
  cause?: unknown;
  toJSON(): {
    message: string;
    name: string;
    code?: string;
    status: number | null;
  };
  static from<T = unknown, D = unknown>(
    error: Error,
    code?: string,
    config?: AxiosRequestConfig<D>,
    request?: unknown,
    response?: AxiosResponse<T, D>
  ): AxiosError<T, D>;
  static readonly ERR_NETWORK: 'ERR_NETWORK';
  static readonly ERR_BAD_REQUEST: 'ERR_BAD_REQUEST';
  static readonly ERR_BAD_RESPONSE: 'ERR_BAD_RESPONSE';
  static readonly ERR_CANCELED: 'ERR_CANCELED';
  static readonly ETIMEDOUT: 'ETIMEDOUT';
}

export class CanceledError<D = unknown> extends AxiosError<unknown, D> {
  constructor(message?: string, config?: AxiosRequestConfig<D>, request?: unknown);
  __CANCEL__: true;
}

export class Axios<D = unknown> {
  constructor(instanceConfig?: AxiosRequestConfig<D>);
  defaults: AxiosRequestConfig<D>;
  interceptors: {
    request: AxiosInterceptorManager<AxiosRequestConfig<D>>;
    response: AxiosInterceptorManager<AxiosResponse<unknown, D>>;
  };
  request<T = unknown>(config: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  request<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  getUri(config?: AxiosRequestConfig<D>): string;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  get<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  head<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  options<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  post<T = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  put<T = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  patch<T = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
}

export interface AxiosInstance<D = unknown> {
  <T = unknown>(config: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  <T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  defaults: AxiosRequestConfig<D>;
  interceptors: {
    request: AxiosInterceptorManager<AxiosRequestConfig<D>>;
    response: AxiosInterceptorManager<AxiosResponse<unknown, D>>;
  };
  create(instanceConfig?: AxiosRequestConfig<D>): AxiosInstance<D>;
  request<T = unknown>(config: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  request<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  getUri(config?: AxiosRequestConfig<D>): string;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  get<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  head<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  options<T = unknown>(url: string, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  post<T = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  put<T = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
  patch<T = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): AxiosPromise<T, D>;
}

export interface AxiosStatic<D = unknown> extends AxiosInstance<D> {
  Axios: typeof Axios;
  AxiosError: typeof AxiosError;
  CanceledError: typeof CanceledError;
  Cancel: typeof CanceledError;
  AxiosHeaders: typeof AxiosHeaders;
  VERSION: string;
  all<T>(promises: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]>;
  spread<T extends readonly unknown[], R>(callback: (...args: T) => R): (array: T) => R;
  mergeConfig(config1?: AxiosRequestConfig<D>, config2?: AxiosRequestConfig<D>): AxiosRequestConfig<D>;
  getAdapter(): AxiosAdapter;
  isCancel(value: unknown): boolean;
  isAxiosError<T = unknown, D2 = unknown>(value: unknown): value is AxiosError<T, D2>;
  native(): NativeStatus;
  default: AxiosStatic<D>;
}

export declare function all<T>(promises: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]>;
export declare function spread<T extends readonly unknown[], R>(
  callback: (...args: T) => R
): (array: T) => R;
export declare function mergeConfig<D = unknown>(
  config1?: AxiosRequestConfig<D>,
  config2?: AxiosRequestConfig<D>
): AxiosRequestConfig<D>;
export declare function isCancel(value: unknown): boolean;
export declare function isAxiosError<T = unknown, D = unknown>(
  value: unknown
): value is AxiosError<T, D>;
export declare function native(): NativeStatus;

export declare const VERSION: string;
export declare const Cancel: typeof CanceledError;

declare const bnfn: AxiosStatic;

export default bnfn;
