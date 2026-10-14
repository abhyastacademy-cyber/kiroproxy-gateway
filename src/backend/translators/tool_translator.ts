import type { NormalizedTool } from './tool_extractor.js';
import {
  createBedrockToolUseStartFrame,
  createBedrockToolUseDeltaFrame,
  createBedrockToolUseStopFrame,
  createBedrockEndFrame,
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
   * Generates Bedrock EventStream binary frames for a tool call invocation.
   */
  public createBedrockFramesForToolCall(
    call: ToolCallInvocation,
    blockIndex: number = 0
  ): Buffer[] {
    const frames: Buffer[] = [];

    // 1. Tool Use Start frame
    frames.push(createBedrockToolUseStartFrame(blockIndex, call.id, call.name));

    // 2. Tool Use Delta frame (chunked if large)
    const chunkSize = 1024;
    for (let i = 0; i < call.arguments.length; i += chunkSize) {
      const chunk = call.arguments.slice(i, i + chunkSize);
      frames.push(createBedrockToolUseDeltaFrame(blockIndex, chunk));
    }

    // 3. Tool Use Stop frame
    frames.push(createBedrockToolUseStopFrame(blockIndex));

    // 4. End frame with stopReason = 'tool_use'
    frames.push(createBedrockEndFrame('tool_use'));

    return frames;
  }
}

export const toolTranslator = new ToolTranslator();
