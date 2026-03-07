import { isFunction } from '../utils.js';

export default function transformData(data, headers, fns, status) {
  if (!fns) {
    return data;
  }

  if (!Array.isArray(fns)) {
    return isFunction(fns) ? fns.call(this, data, headers, status) : data;
  }

  let current = data;

  for (let index = 0; index < fns.length; index += 1) {
    const transformer = fns[index];

    if (isFunction(transformer)) {
      current = transformer.call(this, current, headers, status);
    }
  }

  return current;
}
