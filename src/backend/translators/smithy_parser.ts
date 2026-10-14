import type { ChatMessage } from '../providers/gemini_provider.js';

export interface ParsedConversation {
  messages: ChatMessage[];
  systemPrompt?: string;
  tools: any[];
  modelId?: string;
}

export class SmithyParser {
  /**
   * Decodes complex multi-part conversation payloads from Kiro IDE / Bedrock wire formats.
   */
  public parsePayload(body: any): ParsedConversation {
    const messages: ChatMessage[] = [];
    let systemPrompt: string | undefined;
    const tools: any[] = [];
    let modelId = body?.modelId || body?.model || body?.conversationState?.modelId || body?.conversationState?.model;

    if (!body) {
      return { messages, tools };
    }

    // 1. Extract System Prompt
    if (body.systemPrompt) {
      systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : JSON.stringify(body.systemPrompt);
    } else if (body.conversationState?.systemPrompt) {
      const sp = body.conversationState.systemPrompt;
      systemPrompt = typeof sp === 'string' ? sp : JSON.stringify(sp);
    }

    // 2. Extract Tools
    if (Array.isArray(body.tools)) {
      tools.push(...body.tools);
    } else if (Array.isArray(body.conversationState?.tools)) {
      tools.push(...body.conversationState.tools);
    }

    // 3. Extract History from conversationState
    const history = body.conversationState?.history || body.messages || [];
    if (Array.isArray(history)) {
      for (const item of history) {
        this.appendMessage(messages, item);
      }
    }

    // 4. Extract Current Message
    if (body.conversationState?.currentMessage) {
      this.appendMessage(messages, body.conversationState.currentMessage, 'user');
    }

    return {
      messages,
      systemPrompt,
      tools,
      modelId,
    };
  }

  private appendMessage(messages: ChatMessage[], item: any, defaultRole: 'user' | 'assistant' = 'user') {
    if (!item) return;

    let role: 'user' | 'assistant' | 'system' = defaultRole;
    const rawRole = (item.role || item.sender || '').toUpperCase();
    if (rawRole === 'ASSISTANT' || rawRole === 'MODEL') {
      role = 'assistant';
    } else if (rawRole === 'SYSTEM') {
      role = 'system';
    } else if (rawRole === 'USER') {
      role = 'user';
    }

    // If item is plain string
    if (typeof item === 'string') {
      messages.push({ role, content: item });
      return;
    }

    // If item has toolResult block
    if (item.toolResult) {
      const tr = item.toolResult;
      const resultContent = Array.isArray(tr.content)
        ? tr.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
        : typeof tr.content === 'string'
        ? tr.content
        : JSON.stringify(tr.content || {});
      const formatted = `[Tool Result: ${tr.toolUseId || 'tool'} (${tr.status || 'success'})]\n${resultContent}`;
      messages.push({ role: 'user', content: formatted });
      return;
    }

    // If item has toolUse block
    if (item.toolUse) {
      const tu = item.toolUse;
      const formatted = `[Tool Use: ${tu.name || 'tool'} (ID: ${tu.toolUseId || ''})]\nInput: ${JSON.stringify(tu.input || {})}`;
      messages.push({ role: 'assistant', content: formatted });
      return;
    }

    // If item has multi-part content array
    if (Array.isArray(item.content)) {
      const parts: string[] = [];
      for (const part of item.content) {
        if (typeof part === 'string') {
          parts.push(part);
        } else if (part.text) {
          parts.push(part.text);
        } else if (part.toolResult) {
          parts.push(`[Tool Result: ${part.toolResult.toolUseId}]\n${JSON.stringify(part.toolResult.content)}`);
        } else if (part.toolUse) {
          parts.push(`[Tool Call: ${part.toolUse.name}]\nInput: ${JSON.stringify(part.toolUse.input)}`);
        }
      }
      if (parts.length > 0) {
        messages.push({ role, content: parts.join('\n') });
      }
      return;
    }

    // Plain text content
    const content = item.content || item.text || JSON.stringify(item);
    if (typeof content === 'string' && content.trim().length > 0) {
      messages.push({ role, content });
    }
  }
}

export const smithyParser = new SmithyParser();
