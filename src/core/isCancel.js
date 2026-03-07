export default function isCancel(value) {
  return Boolean(value?.__CANCEL__);
}
