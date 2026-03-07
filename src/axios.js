import Axios from './core/Axios.js';
import AxiosError, { isAxiosError } from './core/AxiosError.js';
import AxiosHeaders from './core/AxiosHeaders.js';
import CanceledError from './core/CanceledError.js';
import isCancel from './core/isCancel.js';
import defaults from './defaults.js';
import mergeConfig from './core/mergeConfig.js';
import { nativePrimitivesStatus } from './native/primitives.js';

function extend(target, source, thisArg) {
  Object.getOwnPropertyNames(source).forEach((key) => {
    if (key === 'constructor') {
      return;
    }

    const value = source[key];
    target[key] = typeof value === 'function' ? value.bind(thisArg ?? source) : value;
  });

  return target;
}

function createInstance(defaultConfig) {
  const context = new Axios(defaultConfig);
  const instance = context.request.bind(context);

  extend(instance, Axios.prototype, context);
  extend(instance, context);

  instance.create = function create(instanceConfig = {}) {
    return createInstance(mergeConfig(context.defaults, instanceConfig));
  };

  return instance;
}

const bnfn = createInstance(defaults);

bnfn.Axios = Axios;
bnfn.AxiosError = AxiosError;
bnfn.CanceledError = CanceledError;
bnfn.Cancel = CanceledError;
bnfn.isCancel = isCancel;
bnfn.isAxiosError = isAxiosError;
bnfn.AxiosHeaders = AxiosHeaders;
bnfn.VERSION = '0.1.1';
bnfn.all = function all(promises) {
  return Promise.all(promises);
};
bnfn.spread = function spread(callback) {
  return function wrap(array) {
    return callback(...array);
  };
};
bnfn.mergeConfig = mergeConfig;
bnfn.getAdapter = function getAdapter() {
  return defaults.adapter;
};
bnfn.native = nativePrimitivesStatus;
bnfn.default = bnfn;

export default bnfn;
