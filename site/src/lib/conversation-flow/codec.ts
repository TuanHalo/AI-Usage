import { parseConversation } from './parser';
import type { ConversationFlow } from './types';

interface CompressionStreamConstructor {
  new (format: 'gzip'): TransformStream<Uint8Array, Uint8Array>;
}

interface DecompressionStreamConstructor {
  new (format: 'gzip'): TransformStream<Uint8Array, Uint8Array>;
}

function getCompressionApi(): {
  readonly Compression: CompressionStreamConstructor | null;
  readonly Decompression: DecompressionStreamConstructor | null;
} {
  const g = globalThis as unknown as {
    readonly CompressionStream?: CompressionStreamConstructor;
    readonly DecompressionStream?: DecompressionStreamConstructor;
  };
  return {
    Compression: typeof g.CompressionStream === 'function' ? g.CompressionStream : null,
    Decompression:
      typeof g.DecompressionStream === 'function' ? g.DecompressionStream : null,
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  const normalized = mod === 0 ? padded : `${padded}${'='.repeat(4 - mod)}`;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function transformBytes(
  bytes: Uint8Array,
  stream: TransformStream<Uint8Array, Uint8Array>
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const writePromise = writer.write(bytes).then(() => writer.close());
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    if (result.value) {
      chunks.push(result.value);
      totalLength += result.value.length;
    }
  }

  await writePromise;
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export async function encodeFlowToHash(flow: ConversationFlow): Promise<string> {
  const json = JSON.stringify(flow);
  const utf8Bytes = new TextEncoder().encode(json);
  const { Compression } = getCompressionApi();

  if (Compression) {
    try {
      const compressed = await transformBytes(utf8Bytes, new Compression('gzip'));
      return `#flow=gz.${bytesToBase64Url(compressed)}`;
    } catch {
      // Fallback to raw base64url when gzip stream fails
    }
  }

  return `#flow=raw.${bytesToBase64Url(utf8Bytes)}`;
}

export async function decodeFlowFromHash(
  hash: string
): Promise<ConversationFlow | null> {
  const cleaned = hash.trim().replace(/^#/, '');
  if (!cleaned.startsWith('flow=')) {
    return null;
  }

  const payload = cleaned.slice('flow='.length);
  if (!payload) {
    return null;
  }

  let jsonText = '';
  try {
    if (payload.startsWith('gz.')) {
      const { Decompression } = getCompressionApi();
      if (!Decompression) {
        return null;
      }
      const compressedBytes = base64UrlToBytes(payload.slice(3));
      const rawBytes = await transformBytes(
        compressedBytes,
        new Decompression('gzip')
      );
      jsonText = new TextDecoder().decode(rawBytes);
    } else if (payload.startsWith('raw.')) {
      const rawBytes = base64UrlToBytes(payload.slice(4));
      jsonText = new TextDecoder().decode(rawBytes);
    } else {
      return null;
    }
  } catch {
    return null;
  }

  const result = parseConversation(jsonText);
  if (result.flow.parseMode !== 'structured-json' || result.flow.turns.length === 0) {
    return null;
  }

  return result.flow;
}
