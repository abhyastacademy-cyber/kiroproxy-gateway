/**
 * AWS Bedrock binary EventStream encoder and decoder with CRC32 calculation.
 * Encodes text chunks and tool calls into application/vnd.amazon.eventstream frames
 * expected by Kiro IDE and AWS Bedrock streaming clients.
 */

// Precompute CRC32 IEEE 802.3 lookup table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32(buffer: Uint8Array, previous = 0): number {
  let crc = (previous ^ -1) >>> 0;
  for (let i = 0; i < buffer.length; i++) {
    crc = (CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ -1) >>> 0;
}

export interface BedrockHeader {
  name: string;
  value: string;
}

/**
 * Encodes headers into AWS EventStream binary format.
 * Header format:
 * - name_len (1 byte)
 * - name (UTF-8 bytes)
 * - header_value_type (7 = String) (1 byte)
 * - value_len (2 bytes uint16 BE)
 * - value (UTF-8 bytes)
 */
export function encodeHeaders(headers: BedrockHeader[]): Buffer {
  const chunks: Buffer[] = [];
  for (const h of headers) {
    const nameBytes = Buffer.from(h.name, 'utf8');
    const valBytes = Buffer.from(h.value, 'utf8');

    const headerBuf = Buffer.alloc(1 + nameBytes.length + 1 + 2 + valBytes.length);
    let offset = 0;

    headerBuf.writeUInt8(nameBytes.length, offset++);
    nameBytes.copy(headerBuf, offset);
    offset += nameBytes.length;

    headerBuf.writeUInt8(7, offset++); // 7 = String

    headerBuf.writeUInt16BE(valBytes.length, offset);
    offset += 2;
    valBytes.copy(headerBuf, offset);

    chunks.push(headerBuf);
  }
  return Buffer.concat(chunks);
}

/**
 * Builds a complete AWS Bedrock EventStream message frame.
 */
export function buildEventStreamFrame(payload: Buffer | string, headers: BedrockHeader[] = []): Buffer {
  const payloadBuf = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  const headersBuf = encodeHeaders(headers);

  const headerLen = headersBuf.length;
  const totalLen = 16 + headerLen + payloadBuf.length; // 12 prelude + headers + payload + 4 message_crc

  const frame = Buffer.alloc(totalLen);

  // Prelude: total length & header length
  frame.writeUInt32BE(totalLen, 0);
  frame.writeUInt32BE(headerLen, 4);

  // Prelude CRC
  const preludeCrc = crc32(new Uint8Array(frame.subarray(0, 8)));
  frame.writeUInt32BE(preludeCrc, 8);

  // Headers
  if (headerLen > 0) {
    headersBuf.copy(frame, 12);
  }

  // Payload
  payloadBuf.copy(frame, 12 + headerLen);

  // Message CRC (CRC of all bytes up to this point)
  const messageCrc = crc32(new Uint8Array(frame.subarray(0, totalLen - 4)));
  frame.writeUInt32BE(messageCrc, totalLen - 4);

  return frame;
}

/**
 * Encodes a text chunk into a Bedrock chunk event frame for Kiro IDE.
 * Kiro IDE expects JSON payloads wrapped with bytes base64.
 */
export function createBedrockChunkFrame(text: string): Buffer {
  const innerPayload = JSON.stringify({
    bytes: Buffer.from(
      JSON.stringify({
        contentBlockDelta: {
          delta: {
            text,
          },
        },
        delta: {
          text,
        },
        completion: text,
      }),
      'utf8'
    ).toString('base64'),
  });

  return buildEventStreamFrame(innerPayload, [
    { name: ':event-type', value: 'chunk' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}

/**
 * Creates final completion frame with custom stopReason (end_turn, tool_use, etc.)
 */
export function createBedrockEndFrame(stopReason: string = 'end_turn'): Buffer {
  const innerPayload = JSON.stringify({
    bytes: Buffer.from(
      JSON.stringify({
        contentBlockStop: true,
        stopReason,
      }),
      'utf8'
    ).toString('base64'),
  });

  return buildEventStreamFrame(innerPayload, [
    { name: ':event-type', value: 'chunk' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}

/**
 * Creates a tool use start frame for AutoMode / OtoMode tool chaining.
 */
export function createBedrockToolUseStartFrame(index: number, toolUseId: string, name: string): Buffer {
  const innerPayload = JSON.stringify({
    bytes: Buffer.from(
      JSON.stringify({
        contentBlockIndex: index,
        start: {
          toolUse: {
            toolUseId,
            name,
          },
        },
      }),
      'utf8'
    ).toString('base64'),
  });

  return buildEventStreamFrame(innerPayload, [
    { name: ':event-type', value: 'chunk' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}

/**
 * Creates a tool use input delta frame for AutoMode / OtoMode.
 */
export function createBedrockToolUseDeltaFrame(index: number, inputChunk: string): Buffer {
  const innerPayload = JSON.stringify({
    bytes: Buffer.from(
      JSON.stringify({
        contentBlockIndex: index,
        delta: {
          toolUse: {
            input: inputChunk,
          },
        },
      }),
      'utf8'
    ).toString('base64'),
  });

  return buildEventStreamFrame(innerPayload, [
    { name: ':event-type', value: 'chunk' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}

/**
 * Creates a tool use stop frame signaling the tool invocation is complete.
 */
export function createBedrockToolUseStopFrame(index: number = 0): Buffer {
  const innerPayload = JSON.stringify({
    bytes: Buffer.from(
      JSON.stringify({
        contentBlockIndex: index,
        stop: {
          toolUse: true,
        },
      }),
      'utf8'
    ).toString('base64'),
  });

  return buildEventStreamFrame(innerPayload, [
    { name: ':event-type', value: 'chunk' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}
