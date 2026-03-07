import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const suffixByPlatform = {
  darwin: 'dylib',
  linux: 'so',
  win32: 'dll',
};
const nativePath = resolve(
  __dirname,
  '../../native',
  `libbnfn_primitives.${suffixByPlatform[process.platform] ?? 'so'}`
);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let cachedLibrary;

function writeUint32LE(view, offset, value) {
  view.setUint32(offset, value, true);
  return offset + 4;
}

function encodeEntryPairs(entries) {
  if (entries.length > 0xffffffff) {
    throw new Error('Native entry serializer only supports up to 4,294,967,295 entries');
  }

  const encoded = new Array(entries.length);
  let inputLength = 4;
  let initialCapacity = 0;

  entries.forEach(([key, value], index) => {
    const keyBytes = textEncoder.encode(key);
    const valueBytes = textEncoder.encode(value);
    encoded[index] = [keyBytes, valueBytes];
    inputLength += 8 + keyBytes.length + valueBytes.length;
    initialCapacity += keyBytes.length * 3 + valueBytes.length * 3 + 1;

    if (index !== 0) {
      initialCapacity += 1;
    }
  });

  const bytes = new Uint8Array(inputLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = writeUint32LE(view, 0, entries.length);

  encoded.forEach(([keyBytes, valueBytes]) => {
    offset = writeUint32LE(view, offset, keyBytes.length);
    bytes.set(keyBytes, offset);
    offset += keyBytes.length;
    offset = writeUint32LE(view, offset, valueBytes.length);
    bytes.set(valueBytes, offset);
    offset += valueBytes.length;
  });

  return {
    bytes,
    initialCapacity,
  };
}

function requireBunFFI() {
  const ffi = globalThis.Bun?.FFI ?? null;

  if (!ffi?.dlopen || !ffi?.ptr) {
    throw new Error('bnfn requires the Bun runtime with Bun.FFI available.');
  }

  return ffi;
}

function requireNativeLibrary() {
  if (!existsSync(nativePath)) {
    throw new Error(
      `bnfn requires the Zig native library at ${nativePath}. Run npm install or npm run build:native.`
    );
  }
}

function decodeNativeWrite(symbol, ptrFn, bytes, initialCapacity) {
  if (bytes.length === 0) {
    return '';
  }

  let capacity = Math.max(initialCapacity, 1);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const out = new Uint8Array(capacity);
    const writtenValue = symbol(ptrFn(bytes), bytes.length, ptrFn(out), out.length);
    const written =
      typeof writtenValue === 'bigint' ? Number(writtenValue) : writtenValue;

    if (written === 0) {
      throw new Error('Native primitive returned no bytes');
    }

    if (written <= out.length) {
      return textDecoder.decode(out.subarray(0, written));
    }

    capacity = written;
  }

  throw new Error('Native primitive exceeded output buffer capacity twice');
}

export function loadNativePrimitives() {
  if (cachedLibrary) {
    return cachedLibrary;
  }

  const ffi = requireBunFFI();
  requireNativeLibrary();

  try {
    const { dlopen, ptr } = ffi;
    const library = dlopen(nativePath, {
      percent_encode_component_write: {
        args: ['ptr', 'usize', 'ptr', 'usize'],
        returns: 'usize',
      },
      serialize_entries_binary_write: {
        args: ['ptr', 'usize', 'ptr', 'usize'],
        returns: 'usize',
      },
    });

    cachedLibrary = {
      path: nativePath,
      percentEncode(value) {
        const bytes = textEncoder.encode(value);

        return decodeNativeWrite(
          library.symbols.percent_encode_component_write,
          ptr,
          bytes,
          bytes.length * 3
        );
      },
      serializeEntries(entries) {
        const { bytes, initialCapacity } = encodeEntryPairs(entries);

        return decodeNativeWrite(
          library.symbols.serialize_entries_binary_write,
          ptr,
          bytes,
          initialCapacity
        );
      },
    };

    return cachedLibrary;
  } catch (error) {
    throw new Error(`bnfn failed to load the Zig native library at ${nativePath}: ${error.message}`);
  }
}
