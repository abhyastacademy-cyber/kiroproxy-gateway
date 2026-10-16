/**
 * AWS EventStream binary encoder and decoder with IEEE 802.3 CRC32 calculation.
 * Encodes text chunks and tool calls into application/vnd.amazon.eventstream frames
 * matching the Smithy binary protocol expected by Kiro IDE and Amazon Q Developer:
 * - assistantResponseEvent: Direct UTF-8 JSON { content, modelId?, messageId? }
 * - toolUseEvent: Direct UTF-8 JSON { toolUseId, name, input, stop: true }
 * - metadataEvent: Direct UTF-8 JSON { tokenUsage, stopReason }
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
 * Builds a complete AWS EventStream message frame with 12-byte prelude and 4-byte message CRC.
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
 * Creates a native Smithy assistantResponseEvent frame.
 * Directly decodable by Kiro IDE extension without unmarshaller crashes.
 */
export function createAssistantResponseFrame(
  content: string,
  modelId?: string,
  messageId?: string
): Buffer {
  const payloadObj: Record<string, any> = { content };
  if (modelId) payloadObj.modelId = modelId;
  if (messageId) payloadObj.messageId = messageId;

  return buildEventStreamFrame(JSON.stringify(payloadObj), [
    { name: ':event-type', value: 'assistantResponseEvent' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}

/**
 * Creates a native Smithy toolUseEvent frame.
 * Emits direct tool execution calls with toolUseId, name, arguments string, and stop flag.
 */
export function createToolUseEventFrame(
  toolUseId: string,
  name: string,
  input: any,
  stop: boolean = true
): Buffer {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input || {});
  const payload = JSON.stringify({
    toolUseId,
    name,
    input: inputStr,
    stop,
  });

  return buildEventStreamFrame(payload, [
    { name: ':event-type', value: 'toolUseEvent' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}

/**
 * Creates a native Smithy metadataEvent frame to signal turn completion,
 * token accounting, and stop reasons ('END_TURN' or 'TOOL_USE').
 */
export function createMetadataEventFrame(
  stopReason: string = 'END_TURN',
  tokenUsage: { uncachedInputTokens?: number; outputTokens?: number; totalTokens?: number } = {}
): Buffer {
  const payload = JSON.stringify({
    tokenUsage: {
      uncachedInputTokens: tokenUsage.uncachedInputTokens ?? 0,
      outputTokens: tokenUsage.outputTokens ?? 0,
      ...(tokenUsage.totalTokens ? { totalTokens: tokenUsage.totalTokens } : {}),
    },
    stopReason: stopReason.toUpperCase(),
  });

  return buildEventStreamFrame(payload, [
    { name: ':event-type', value: 'metadataEvent' },
    { name: ':content-type', value: 'application/json' },
    { name: ':message-type', value: 'event' },
  ]);
}

/**
 * Backward compatibility alias for Bedrock chunk frames -> maps cleanly to assistantResponseEvent.
 */
export function createBedrockChunkFrame(text: string): Buffer {
  return createAssistantResponseFrame(text);
}

/**
 * Backward compatibility alias for completion frames -> maps cleanly to metadataEvent.
 */
export function createBedrockEndFrame(stopReason: string = 'END_TURN'): Buffer {
  const normalizedReason = stopReason.toLowerCase().includes('tool') ? 'TOOL_USE' : 'END_TURN';
  return createMetadataEventFrame(normalizedReason);
}

/**
 * Tool use frame helpers for compatibility
 */
export function createBedrockToolUseStartFrame(_index: number, toolUseId: string, name: string): Buffer {
  return createToolUseEventFrame(toolUseId, name, '', false);
}

export function createBedrockToolUseDeltaFrame(_index: number, inputChunk: string): Buffer {
  return createToolUseEventFrame('', '', inputChunk, false);
}

export function createBedrockToolUseStopFrame(_index: number = 0): Buffer {
  return createMetadataEventFrame('TOOL_USE');
}
