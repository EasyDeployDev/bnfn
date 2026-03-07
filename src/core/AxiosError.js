export default class AxiosError extends Error {
  constructor(message, code, config, request, response) {
    super(message);
    this.name = 'AxiosError';
    this.code = code;
    this.config = config;
    this.request = request;
    this.response = response;
    this.isAxiosError = true;
  }

  toJSON() {
    return {
      message: this.message,
      name: this.name,
      code: this.code,
      status: this.response?.status ?? null,
    };
  }

  static from(error, code, config, request, response) {
    const axiosError = new AxiosError(error.message, code, config, request, response);
    axiosError.cause = error;
    return axiosError;
  }
}

AxiosError.ERR_NETWORK = 'ERR_NETWORK';
AxiosError.ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';
AxiosError.ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';
AxiosError.ERR_CANCELED = 'ERR_CANCELED';
AxiosError.ETIMEDOUT = 'ETIMEDOUT';

export function isAxiosError(value) {
  return Boolean(value?.isAxiosError);
}
