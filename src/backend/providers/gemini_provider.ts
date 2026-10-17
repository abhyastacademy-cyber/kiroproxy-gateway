import { GoogleGenAI } from '@google/genai';
import { configManager } from '../config/index.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function normalizeGeminiModel(modelName: string): string {
  if (!modelName) return 'gemini-flash-latest';
  const clean = modelName.replace(/^models\//, '').trim();
  if (clean.startsWith('ngrok-gemini-') || clean.startsWith('canvas-') || clean.startsWith('ngrok-')) {
    return clean.includes('pro') ? 'gemini-4-argon' : 'gemini-flash-latest';
  }
  if (clean.endsWith('-otomode') || clean === 'global-automode' || clean === 'auto') {
    return clean.includes('pro') ? 'gemini-4-argon' : 'gemini-flash-latest';
  }
  // Deprecated model mappings to supported counterparts
  if (clean === 'gemini-1.5-flash' || clean === 'gemini-2.0-flash' || clean === 'gemini-2.0-flash-exp') {
    return 'gemini-flash-latest';
  }
  if (clean === 'gemini-1.5-pro' || clean === 'gemini-2.0-pro' || clean === 'gemini-pro') {
    return 'gemini-4-argon';
  }
  return clean;
}

export class GeminiProvider {
  private activeKeyIndex: number = 0;
  private deadApiKeys: Set<string> = new Set();

  public markKeyAsDead(key: string): void {
    if (key && key.trim().length > 0) {
      this.deadApiKeys.add(key.trim());
      console.warn(`[GeminiProvider] Key ${key.trim().substring(0, 8)}... marked as DEAD (leaked/invalid).`);
    }
  }

  public clearDeadKeys(): void {
    this.deadApiKeys.clear();
    console.log('[GeminiProvider] Dead keys cache cleared.');
  }

  private getCandidateKeys(customKey?: string): string[] {
    if (customKey && customKey.trim().length > 0 && customKey !== 'MY_GEMINI_API_KEY' && !this.deadApiKeys.has(customKey.trim())) {
      return [customKey.trim()];
    }
    const config = configManager.getConfig();
    const keys: string[] = [];
    if (Array.isArray(config.geminiApiKeys)) {
      for (const k of config.geminiApiKeys) {
        if (k && k.trim().length > 0 && k !== 'MY_GEMINI_API_KEY' && !this.deadApiKeys.has(k.trim()) && !keys.includes(k.trim())) {
          keys.push(k.trim());
        }
      }
    }
    if (config.geminiApiKey && config.geminiApiKey.trim().length > 0 && config.geminiApiKey !== 'MY_GEMINI_API_KEY' && !this.deadApiKeys.has(config.geminiApiKey.trim()) && !keys.includes(config.geminiApiKey.trim())) {
      keys.push(config.geminiApiKey.trim());
    }
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey && envKey.trim().length > 0 && envKey !== 'MY_GEMINI_API_KEY' && !this.deadApiKeys.has(envKey.trim()) && !keys.includes(envKey.trim())) {
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
    modelName: string = 'gemini-2.5-flash',
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
    const fallbackModels = [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-4-argon',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
    ];
    const modelCandidates = Array.from(new Set([cleanModel, ...fallbackModels]));

    let lastError: Error | null = null;
    const totalKeys = candidateKeys.length;

    // Multi-key and multi-model rotation loop across all available Gemini API keys & model candidates
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIndex = (this.activeKeyIndex + attempt) % totalKeys;
      const apiKey = candidateKeys[keyIndex];

      for (const mCandidate of modelCandidates) {
        try {
          const client = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });
          const responseStream = await client.models.generateContentStream({
            model: mCandidate,
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
          const isQuotaOrAuth =
            errMsg.includes('429') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('quota') ||
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('API_KEY_INVALID');
          console.warn(
            `[GeminiProvider] Key #${keyIndex + 1} with model '${mCandidate}' failed (${errMsg.substring(0, 150)}). ` +
              (isQuotaOrAuth ? 'Trying next model/key candidate...' : 'Retrying candidate...')
          );
          if (
            errMsg.includes('API_KEY_INVALID') ||
            errMsg.includes('leaked') ||
            errMsg.includes('403') ||
            errMsg.includes('PERMISSION_DENIED')
          ) {
            this.markKeyAsDead(apiKey);
            break; // Skip remaining models for this dead key
          }
        }
      }
    }

    throw lastError || new Error('All Gemini API keys and candidate models in rotation failed.');
  }
}

export const geminiProvider = new GeminiProvider();
