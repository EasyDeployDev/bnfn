import { deepMerge, isPlainObject, isUndefined } from '../utils.js';

export default function mergeConfig(config1 = {}, config2 = {}) {
  const config = {};
  const keys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

  keys.forEach((key) => {
    const value1 = config1[key];
    const value2 = config2[key];

    if (!isUndefined(value2)) {
      if (Array.isArray(value2)) {
        config[key] = value2.slice();
        return;
      }

      if (isPlainObject(value1) && isPlainObject(value2)) {
        config[key] = deepMerge(value1, value2);
        return;
      }

      if (isPlainObject(value2)) {
        config[key] = deepMerge(value2);
        return;
      }

      config[key] = value2;
      return;
    }

    if (Array.isArray(value1)) {
      config[key] = value1.slice();
      return;
    }

    if (isPlainObject(value1)) {
      config[key] = deepMerge(value1);
      return;
    }

    if (!isUndefined(value1)) {
      config[key] = value1;
    }
  });

  return config;
}
