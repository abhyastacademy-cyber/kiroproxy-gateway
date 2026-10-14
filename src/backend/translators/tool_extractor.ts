/**
 * Extracts and normalizes tool definitions from Kiro IDE / Bedrock payloads.
 */

export interface NormalizedTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export class ToolExtractor {
  /**
   * Extracts tool specifications from raw request body or conversationState.
   */
  public extractTools(body: any): NormalizedTool[] {
    const tools: NormalizedTool[] = [];
    if (!body) return tools;

    const rawTools = body.tools || body.conversationState?.tools || body.toolConfig?.tools;
    if (!Array.isArray(rawTools)) return tools;

    for (const item of rawTools) {
      // 1. Bedrock format: { toolSpec: { name, description, inputSchema: { json: ... } } }
      if (item.toolSpec) {
        const spec = item.toolSpec;
        tools.push({
          name: spec.name,
          description: spec.description || '',
          parameters: spec.inputSchema?.json || spec.inputSchema || { type: 'object', properties: {} },
        });
        continue;
      }

      // 2. OpenAI format: { type: 'function', function: { name, description, parameters } }
      if (item.function || item.type === 'function') {
        const fn = item.function || item;
        tools.push({
          name: fn.name,
          description: fn.description || '',
          parameters: fn.parameters || { type: 'object', properties: {} },
        });
        continue;
      }

      // 3. Direct format: { name, description, parameters }
      if (item.name) {
        tools.push({
          name: item.name,
          description: item.description || '',
          parameters: item.parameters || item.inputSchema || { type: 'object', properties: {} },
        });
      }
    }

    return tools;
  }
}

export const toolExtractor = new ToolExtractor();
