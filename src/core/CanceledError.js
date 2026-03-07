import AxiosError from './AxiosError.js';

export default class CanceledError extends AxiosError {
  constructor(message = 'canceled', config, request) {
    super(message, AxiosError.ERR_CANCELED, config, request);
    this.name = 'CanceledError';
    this.__CANCEL__ = true;
  }
}
