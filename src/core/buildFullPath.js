import { combineURLs, isAbsoluteURL } from '../utils.js';

export default function buildFullPath(baseURL, requestedURL) {
  if (baseURL && requestedURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }

  return requestedURL || baseURL;
}
