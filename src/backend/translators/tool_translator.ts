import type { NormalizedTool } from './tool_extractor.js';
import {
  createToolUseEventFrame,
  createMetadataEventFrame,
} from '../handlers/eventstream.js';

export interface ToolCallInvocation {
  id: string;
  name: string;
  arguments: string;
}

export class ToolTranslator {
  /**
   * Formats normalized tools into OpenAI `tools` array.
   */
  public toOpenAITools(tools: NormalizedTool[]): any[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  /**
   * Formats normalized tools into Google Gemini `functionDeclarations`.
   */
  public toGeminiFunctionDeclarations(tools: NormalizedTool[]): any[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  /**
   * Generates native Smithy EventStream binary frames for a tool call invocation.
   * Frame 0: toolUseEvent { toolUseId, name, input, stop: true }
   * Frame 1: metadataEvent { stopReason: 'TOOL_USE' }
   */
  public createBedrockFramesForToolCall(
    call: ToolCallInvocation,
    _blockIndex: number = 0
  ): Buffer[] {
    const frames: Buffer[] = [];

    // 1. Native Smithy toolUseEvent frame
    frames.push(createToolUseEventFrame(call.id, call.name, call.arguments, true));

    // 2. Native Smithy metadataEvent frame signaling TOOL_USE completion
    frames.push(createMetadataEventFrame('TOOL_USE', { outputTokens: 1 }));

    return frames;
  }
}

export const toolTranslator = new ToolTranslator();
