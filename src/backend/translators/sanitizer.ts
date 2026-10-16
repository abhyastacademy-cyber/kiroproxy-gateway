import type { ChatMessage } from '../providers/gemini_provider.js';

/**
 * Context & System Prompt Sanitizer for KiroProxy Cloud Gateway.
 * Strips internal telemetry signatures, redundant Kiro IDE scaffolding,
 * and compacts conversation history so free-tier models don't blow token budgets.
 */

export interface SanitizationOptions {
  maxPromptLength?: number;
  maxHistoryTurns?: number;
  stripTelemetry?: boolean;
  compactSystemPrompt?: boolean;
}

const TELEMETRY_PATTERNS = [
  /\[KiroTelemetry\][\s\S]*?(?=\n\n|$)/gi,
  /TelemetryEvent:[\s\S]*?(?=\n\n|$)/gi,
  /<kiro-telemetry>[\s\S]*?<\/kiro-telemetry>/gi,
  /<ide-internal-state>[\s\S]*?<\/ide-internal-state>/gi,
  /\[SystemMetadata:.*?\]/gi,
];

const REDUNDANT_SYSTEM_INSTRUCTIONS = [
  /You are a helpful programming assistant developed by.*?(\n|$)/gi,
  /Telemetry logging is (enabled|disabled).*?(\n|$)/gi,
  /Always include metadata blocks in your response.*?(\n|$)/gi,
];

export class ContextSanitizer {
  /**
   * Sanitizes a system prompt to eliminate bloat.
   */
  public sanitizeSystemPrompt(prompt?: string, options: SanitizationOptions = {}): string | undefined {
    if (!prompt) return undefined;

    let clean = prompt;

    // Strip telemetry signatures
    if (options.stripTelemetry !== false) {
      for (const pat of TELEMETRY_PATTERNS) {
        clean = clean.replace(pat, '');
      }
    }

    // Strip redundant boilerplate
    if (options.compactSystemPrompt !== false) {
      for (const pat of REDUNDANT_SYSTEM_INSTRUCTIONS) {
        clean = clean.replace(pat, '');
      }
    }

    clean = clean.trim();

    // If max length is set, safely clamp
    if (options.maxPromptLength && clean.length > options.maxPromptLength) {
      clean = clean.substring(0, options.maxPromptLength) + '\n[...system prompt truncated for context efficiency]';
    }

    return clean.length > 0 ? clean : undefined;
  }

  /**
   * Sanitizes conversation history, removing internal telemetry messages and clamping turn counts.
   */
  public sanitizeMessages(messages: ChatMessage[], options: SanitizationOptions = {}): ChatMessage[] {
    const maxTurns = options.maxHistoryTurns || 30;
    const cleanList: ChatMessage[] = [];

    for (const msg of messages) {
      let content = msg.content || '';

      if (options.stripTelemetry !== false) {
        for (const pat of TELEMETRY_PATTERNS) {
          content = content.replace(pat, '');
        }
      }

      content = content.trim();
      if (!content) continue;

      cleanList.push({
        role: msg.role,
        content,
      });
    }

    // If history exceeds max turns, preserve the initial turn (often project brief) and most recent turns
    if (cleanList.length > maxTurns) {
      const first = cleanList[0];
      const recent = cleanList.slice(-(maxTurns - 1));
      return [first, ...recent];
    }

    return cleanList;
  }
}

export const contextSanitizer = new ContextSanitizer();

/**
 * Sanitizes unescaped Windows backslashes and LaTeX escapes in JSON strings
 * while strictly preserving valid JSON escape sequences: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX.
 */
export function sanitizeJsonBackslashes(jsonStr: string): string {
  if (!jsonStr || typeof jsonStr !== 'string') return '';
  return jsonStr.replace(/(?<!\\)\\(?!["\\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
}
