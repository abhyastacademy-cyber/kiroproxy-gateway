import { GoogleGenAI } from '@google/genai';
import { configManager } from '../config/index.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function normalizeGeminiModel(modelName: string): string {
  if (!modelName) return 'gemini-3.8-flash';
  const clean = modelName.replace(/^models\//, '').trim();
  if (clean.startsWith('ngrok-gemini-') || clean.startsWith('canvas-') || clean.startsWith('ngrok-')) {
    return clean.includes('pro') ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
  }
  if (clean.endsWith('-otomode') || clean === 'global-automode' || clean === 'auto') {
    return clean.includes('pro') ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
  }
  if (clean === 'gemini-2.5-flash') {
    return 'gemini-3.8-flash';
  }
  return clean;
}

export class GeminiProvider {
  private activeKeyIndex: number = 0;

  private getCandidateKeys(customKey?: string): string[] {
    if (customKey && customKey.trim().length > 0 && customKey !== 'MY_GEMINI_API_KEY') {
      return [customKey.trim()];
    }
    const config = configManager.getConfig();
    const keys: string[] = [];
    if (Array.isArray(config.geminiApiKeys)) {
      for (const k of config.geminiApiKeys) {
        if (k && k.trim().length > 0 && k !== 'MY_GEMINI_API_KEY' && !keys.includes(k.trim())) {
          keys.push(k.trim());
        }
      }
    }
    if (config.geminiApiKey && config.geminiApiKey.trim().length > 0 && config.geminiApiKey !== 'MY_GEMINI_API_KEY' && !keys.includes(config.geminiApiKey.trim())) {
      keys.push(config.geminiApiKey.trim());
    }
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey && envKey.trim().length > 0 && envKey !== 'MY_GEMINI_API_KEY' && !keys.includes(envKey.trim())) {
      keys.push(envKey.trim());
    }
    return keys;
  }

  public isAvailable(customKey?: string): boolean {
    return this.getCandidateKeys(customKey).length > 0;
  }

  public async streamGenerate(
    messages: ChatMessage[],
    systemInstruction?: string,
    modelName: string = 'gemini-3.8-flash',
    onChunk?: (text: string) => void,
    customApiKey?: string
  ): Promise<string> {
    const candidateKeys = this.getCandidateKeys(customApiKey);
    if (candidateKeys.length === 0) {
      throw new Error('GEMINI_API_KEY is not configured in environment or settings.');
    }

    // Map messages for Gemini API
    const contents: any[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
    }

    const cleanModel = normalizeGeminiModel(modelName);
    let lastError: Error | null = null;

    // Multi-key failover rotation loop across all available Gemini API keys
    const totalKeys = candidateKeys.length;
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIndex = (this.activeKeyIndex + attempt) % totalKeys;
      const apiKey = candidateKeys[keyIndex];

      try {
        const client = new GoogleGenAI({ apiKey });
        const responseStream = await client.models.generateContentStream({
          model: cleanModel,
          contents,
          config: {
            systemInstruction: systemInstruction || undefined,
            temperature: configManager.getConfig().temperature,
            maxOutputTokens: configManager.getConfig().maxTokens,
          },
        });

        let fullText = '';
        for await (const chunk of responseStream) {
          const text = chunk.text || '';
          if (text) {
            fullText += text;
            if (onChunk) {
              onChunk(text);
            }
          }
        }

        // Keep activeKeyIndex sticky on success
        this.activeKeyIndex = keyIndex;
        return fullText;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isQuotaOrAuth = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('API_KEY_INVALID');
        console.warn(`[GeminiProvider] Key #${keyIndex + 1} failed (${errMsg.substring(0, 150)}). ` + (isQuotaOrAuth ? 'Rotating to next Gemini key...' : 'Retrying next key...'));
      }
    }

    throw lastError || new Error('All Gemini API keys in multi-key rotation failed.');
  }
}

export const geminiProvider = new GeminiProvider();
