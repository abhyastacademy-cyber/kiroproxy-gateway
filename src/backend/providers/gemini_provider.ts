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
  private getClient(customKey?: string): GoogleGenAI | null {
    const key = customKey || configManager.getConfig().geminiApiKey || process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') return null;
    return new GoogleGenAI({ apiKey: key });
  }

  public isAvailable(customKey?: string): boolean {
    const key = customKey || configManager.getConfig().geminiApiKey || process.env.GEMINI_API_KEY;
    return !!key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY';
  }

  public async streamGenerate(
    messages: ChatMessage[],
    systemInstruction?: string,
    modelName: string = 'gemini-3.8-flash',
    onChunk?: (text: string) => void
  ): Promise<string> {
    const client = this.getClient();
    if (!client) {
      throw new Error('GEMINI_API_KEY is not configured in environment or settings.');
    }

    // Map messages for Gemini API
    const contents: any[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') continue; // Handled in config
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // If no user message was provided, add default prompt
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
    }

    // Clean model name (support gemini-2.5-flash, gemini-2.5-pro, gemini-3.8-flash, virtual canvas models, etc.)
    const cleanModel = normalizeGeminiModel(modelName);

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

    return fullText;
  }
}

export const geminiProvider = new GeminiProvider();
