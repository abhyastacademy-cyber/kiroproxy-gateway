/**
 * src/backend/translators/tool_extractor.ts - Multi-format tool extraction engine
 * Supports 13+ LLM formats including Format 1b bare JSON and Format 6b XML tags,
 * manifest auto-extraction, shell argument recovery, and validation loop suppression.
 */

import { sanitizeJsonBackslashes } from './sanitizer.js';

export interface NormalizedTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ExtractedToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ProviderResponseExtractionResult {
  text: string;
  rawText: string;
  toolCalls: ExtractedToolCall[];
  stopReason: 'TOOL_USE' | 'END_TURN';
}

/**
 * Extract tool metadata (name, description, schema) regardless of input format
 */
export function extractToolMetadata(tool: any): { name: string; description: string; schema: Record<string, any> } {
  if (!tool || typeof tool !== 'object') {
    return { name: 'unknown', description: '', schema: { type: 'object', properties: {} } };
  }
  const spec = tool.toolSpecification || tool.toolSpec || tool.function || tool;
  const name = spec.name || tool.name || 'unknown';
  const description = spec.description || tool.description || '';

  let rawSchema = spec.parameters || spec.input_schema || spec.inputSchema || tool.parameters || tool.input_schema || tool.inputSchema || {};
  while (rawSchema && typeof rawSchema === 'object' && rawSchema.json && typeof rawSchema.json === 'object') {
    rawSchema = rawSchema.json;
  }
  if (!rawSchema || typeof rawSchema !== 'object' || Array.isArray(rawSchema)) {
    rawSchema = { type: 'object', properties: {} };
  }
  return { name, description, schema: rawSchema };
}

/**
 * Extract a balanced JSON object { ... } starting at openBraceIdx.
 * Properly handles nested braces inside string literals and backslash escapes.
 */
export function extractBalancedJson(str: string, openBraceIdx: number): { jsonText: string; endIndex: number } | null {
  if (!str || openBraceIdx < 0 || openBraceIdx >= str.length || str[openBraceIdx] !== '{') {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openBraceIdx; i < str.length; i++) {
    const ch = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return {
            jsonText: str.slice(openBraceIdx, i + 1),
            endIndex: i + 1,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Robust Tool Argument Extractor (Handles unescaped newlines, quotes, markdown)
 */
export function extractToolArguments(rawArgs: any): Record<string, any> {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object' && !Array.isArray(rawArgs)) return rawArgs;
  if (typeof rawArgs !== 'string') return {};
  const trimmed = rawArgs.trim();

  // 1. Direct JSON.parse first
  try {
    return JSON.parse(trimmed);
  } catch (e1) {}

  // 2. Escape literal control characters (newlines, tabs) inside string literals
  try {
    const escaped = trimmed.replace(/"((?:\\.|[^"\\])*)"/gs, (_match: string, inner: string) => {
      return '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
    });
    return JSON.parse(escaped);
  } catch (e2) {}

  // 3. Fix unquoted keys and unescaped Windows single backslashes
  try {
    const s = trimmed.replace(/([{,]\s*)([a-zA-Z0-9_\-]+)\s*:/g, '$1"$2":');
    const fixed = s.replace(/(?<!\\)\\(?!["\\\/bfnrtu])/g, '\\\\');
    const escaped = fixed.replace(/"((?:\\.|[^"\\])*)"/gs, (_match: string, inner: string) => {
      return '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
    });
    return JSON.parse(escaped);
  } catch (e3) {}

  // 4. Robust regex fallbacks (supporting both quoted and unquoted keys)
  const parsed: Record<string, any> = {};
  const pathMatch = trimmed.match(/['"]?(?:path|directory|dir|folder|file|filepath)['"]?\s*:\s*['"]([^'"]+)['"]/i);
  if (pathMatch) parsed.path = pathMatch[1].replace(/\\\\/g, '\\');

  const textMatch =
    trimmed.match(/['"]?(?:text|content|code)['"]?\s*:\s*['"]([\s\S]*?)['"]\s*\}?$/i) ||
    trimmed.match(/['"]?(?:text|content|code)['"]?\s*:\s*['"]([\s\S]*?)['"]\s*,/i);
  if (textMatch) parsed.text = textMatch[1];

  const oldMatch = trimmed.match(/['"]?oldStr['"]?\s*:\s*['"]([\s\S]*?)['"]\s*,\s*['"]?newStr/i);
  if (oldMatch) parsed.oldStr = oldMatch[1];
  const newMatch = trimmed.match(/['"]?newStr['"]?\s*:\s*['"]([\s\S]*?)['"]\s*\}?$/i);
  if (newMatch) parsed.newStr = newMatch[1];

  const promptMatch = trimmed.match(/['"]?prompt['"]?\s*:\s*['"]([\s\S]*?)['"]\s*\}?$/i);
  if (promptMatch) parsed.prompt = promptMatch[1];

  const cmdMatch = trimmed.match(/['"]?(?:command|cmd)['"]?\s*:\s*['"]([\s\S]*?)['"]\s*\}?$/i);
  if (cmdMatch) parsed.command = cmdMatch[1];

  const filePathMatch = trimmed.match(
    /['"]?(?:filePath|tasksFilePath|requirementsFilePath)['"]?\s*:\s*['"]([^'"]+)['"]/i
  );
  if (filePathMatch) {
    parsed.filePath = filePathMatch[1].replace(/\\\\/g, '\\');
    parsed.tasksFilePath = parsed.filePath;
    parsed.requirementsFilePath = parsed.filePath;
  }

  const taskIdMatch = trimmed.match(/['"]?taskId['"]?\s*:\s*['"]([^'"]+)['"]/i);
  if (taskIdMatch) parsed.taskId = taskIdMatch[1];

  const statusMatch = trimmed.match(/['"]?status['"]?\s*:\s*['"]([^'"]+)['"]/i);
  if (statusMatch) parsed.status = statusMatch[1];

  return parsed;
}

/**
 * Detect if a parsed JSON object represents a package.json manifest
 */
export function isPackageJsonManifest(obj: any): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Boolean(
    typeof obj.name === 'string' &&
      (obj.version ||
        obj.scripts ||
        obj.dependencies ||
        obj.devDependencies ||
        obj.main ||
        obj.keywords ||
        obj.author ||
        obj.license)
  );
}

/**
 * Detect if a parsed JSON object represents a tsconfig.json file
 */
export function isTsConfigManifest(obj: any): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Boolean(obj.compilerOptions && typeof obj.compilerOptions === 'object');
}

const CORE_KNOWN_TOOL_NAMES = new Set([
  'fs_write',
  'str_replace',
  'read_file',
  'list_directory',
  'grep_search',
  'file_search',
  'execute_pwsh',
  'invoke_sub_agent',
  'validate_spec_format',
  'task_list',
  'task_update',
  'task_get',
  'write_file',
  'write_to_file',
  'create_file',
  'edit_file',
  'modify_file',
  'replace_file_content',
  'run_command',
  'bash',
  'powershell',
  'terminal',
  'ls',
  'dir',
  'list_dir',
  'cat',
  'type',
  'read',
  'open_file',
  'search_files',
  'find_files',
  'find',
  'grep',
  'search_code',
  'analyze_requirements',
  'verify_requirements',
]);

function isKnownTool(rawName: string, matchedName?: string, availableTools: any[] = []): boolean {
  if (!rawName) return false;
  const clean = String(rawName).toLowerCase().trim();
  const matchedClean = String(matchedName || '').toLowerCase().trim();
  if (CORE_KNOWN_TOOL_NAMES.has(clean) || CORE_KNOWN_TOOL_NAMES.has(matchedClean)) return true;
  if (Array.isArray(availableTools)) {
    for (const t of availableTools) {
      const name = t?.function?.name || t?.toolSpecification?.name || t?.toolSpec?.name || t?.name || '';
      if (name && (name.toLowerCase().trim() === clean || name.toLowerCase().trim() === matchedClean)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract tool calls from response text across 13+ formats
 */
export function extractToolCallsFromResponse(responseText: string, availableTools: any[] = []): ExtractedToolCall[] {
  const detected: ExtractedToolCall[] = [];
  if (!responseText) return detected;

  // Normalize unicode vertical pipes into standard ASCII pipe
  const normalizedText = String(responseText).replace(/[\uFF5C\u2502\u00A6]/g, '|');

  function matchToolName(extractedName: string): string {
    if (!extractedName) return 'unknown';
    const cleaned = String(extractedName).replace(/^(?:call:|l:|tool:)/i, '').trim();
    if (!availableTools || availableTools.length === 0) return cleaned;
    const lower = cleaned.toLowerCase();
    for (const t of availableTools) {
      const candidate = t?.function?.name || t?.toolSpecification?.name || t?.toolSpec?.name || t?.name || '';
      if (candidate && candidate.toLowerCase().trim() === lower) {
        return candidate;
      }
    }
    return cleaned;
  }

  // Format 1: Fenced JSON Tool Blocks: ```json {"tool":"name","arguments":{...}} ```
  const jsonPrefixRegex = /```(?:json|tool_call)?\s*(?=\{)/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonPrefixRegex.exec(normalizedText)) !== null) {
    const openBraceIdx = match.index + match[0].length;
    const balanced = extractBalancedJson(normalizedText, openBraceIdx);
    const rawJson = balanced ? balanced.jsonText : null;
    if (rawJson) {
      try {
        const sanitized = sanitizeJsonBackslashes(rawJson);
        const data = JSON.parse(sanitized);
        const rawName = data.tool || data.name;
        const args = data.arguments || data.input || data.parameters || data.args;
        if (rawName && args !== undefined) {
          detected.push({
            name: matchToolName(rawName),
            args: typeof args === 'object' && args !== null ? args : extractToolArguments(String(args)),
          });
        } else if (isPackageJsonManifest(data)) {
          detected.push({
            name: matchToolName('fs_write'),
            args: { path: 'package.json', text: balanced ? balanced.jsonText.trim() : JSON.stringify(data, null, 2) },
          });
        } else if (isTsConfigManifest(data)) {
          detected.push({
            name: matchToolName('fs_write'),
            args: { path: 'tsconfig.json', text: balanced ? balanced.jsonText.trim() : JSON.stringify(data, null, 2) },
          });
        }
      } catch {
        const parsedArgs = extractToolArguments(rawJson);
        const rawName = parsedArgs.tool || parsedArgs.name;
        if (rawName && (parsedArgs.arguments || parsedArgs.input || parsedArgs.command || parsedArgs.path)) {
          detected.push({
            name: matchToolName(rawName),
            args: parsedArgs.arguments || parsedArgs.input || parsedArgs,
          });
        }
      }
    }
  }

  // Format 1b: Bare / Unfenced JSON Tool Blocks
  const maskedForBare = normalizedText
    .replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length))
    .replace(
      /<[\|\s]*(?:DSML[\|\s]*)?tool_call[\|\s]*>[\s\S]*?<[\|\/\s]*(?:DSML[\|\s]*)?tool_call[\|\/\s]*>/gi,
      (m) => ' '.repeat(m.length)
    );

  const bareJsonCandidateRegex =
    /\{\s*"(?:tool|name|action|arguments|input|parameters|args|action_input|compilerOptions)"/gi;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = bareJsonCandidateRegex.exec(maskedForBare)) !== null) {
    const openBraceIdx = bareMatch.index;
    const balanced = extractBalancedJson(normalizedText, openBraceIdx);
    if (!balanced) continue;

    const rawJson = balanced.jsonText;
    let data: any = null;

    try {
      data = JSON.parse(rawJson);
    } catch {
      try {
        const sanitized = sanitizeJsonBackslashes(rawJson);
        data = JSON.parse(sanitized);
      } catch {
        data = extractToolArguments(rawJson);
      }
    }

    if (data && typeof data === 'object') {
      if (isPackageJsonManifest(data)) {
        detected.push({
          name: matchToolName('fs_write'),
          args: { path: 'package.json', text: balanced ? balanced.jsonText.trim() : JSON.stringify(data, null, 2) },
        });
        bareJsonCandidateRegex.lastIndex = balanced.endIndex;
        continue;
      } else if (isTsConfigManifest(data)) {
        detected.push({
          name: matchToolName('fs_write'),
          args: { path: 'tsconfig.json', text: balanced ? balanced.jsonText.trim() : JSON.stringify(data, null, 2) },
        });
        bareJsonCandidateRegex.lastIndex = balanced.endIndex;
        continue;
      }

      const hasExplicitToolKey = Boolean(data.tool || data.action);
      const hasExplicitArgsKey = Boolean(
        data.arguments || data.input || data.parameters || data.args || data.action_input
      );
      const rawName = data.tool || data.name || data.action;
      const matched = matchToolName(rawName);
      const known = isKnownTool(rawName, matched, availableTools);

      if (!hasExplicitToolKey && !hasExplicitArgsKey && !known) {
        bareJsonCandidateRegex.lastIndex = balanced.endIndex;
        continue;
      }

      let args = data.arguments || data.input || data.parameters || data.args || data.action_input;
      if (args === undefined) {
        const rootArgs = { ...data };
        delete rootArgs.tool;
        delete rootArgs.name;
        delete rootArgs.action;
        delete rootArgs.id;
        delete rootArgs.type;
        if (Object.keys(rootArgs).length > 0) {
          args = rootArgs;
        }
      }
      if (rawName && args !== undefined && (hasExplicitToolKey || hasExplicitArgsKey || known)) {
        detected.push({
          name: matched,
          args: typeof args === 'object' && args !== null ? args : extractToolArguments(String(args)),
        });
      }
    }

    bareJsonCandidateRegex.lastIndex = balanced.endIndex;
  }

  // Format 2: Claude XML Tool Blocks: <invoke name="tool">{"arg":"val"}</invoke>
  const xmlRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
  while ((match = xmlRegex.exec(normalizedText)) !== null) {
    const inner = match[2].trim();
    if (inner.startsWith('<parameter')) continue;
    try {
      const args = JSON.parse(inner);
      detected.push({ name: matchToolName(match[1]), args });
    } catch {
      detected.push({ name: matchToolName(match[1]), args: extractToolArguments(inner) });
    }
  }

  // Format 3: Standard Anthropic XML: <tool_use><name>...</name><arguments>...</arguments></tool_use>
  const nativeXmlRegex =
    /<tool_use>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<arguments>([\s\S]*?)<\/arguments>[\s\S]*?<\/tool_use>/gi;
  while ((match = nativeXmlRegex.exec(normalizedText)) !== null) {
    try {
      detected.push({
        name: matchToolName(match[1].trim()),
        args: JSON.parse(match[2]),
      });
    } catch {
      detected.push({
        name: matchToolName(match[1].trim()),
        args: extractToolArguments(match[2]),
      });
    }
  }

  // Format 8: Anthropic tool_use with <input> tag instead of <arguments>
  const inputXmlRegex =
    /<tool_use>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<input>([\s\S]*?)<\/input>[\s\S]*?<\/tool_use>/gi;
  while ((match = inputXmlRegex.exec(normalizedText)) !== null) {
    try {
      detected.push({
        name: matchToolName(match[1].trim()),
        args: JSON.parse(match[2]),
      });
    } catch {
      detected.push({
        name: matchToolName(match[1].trim()),
        args: extractToolArguments(match[2]),
      });
    }
  }

  // Format 4: Kiro Native Format: <|tool_call>call:TOOL{ARGS}<tool_call|>
  const kiroPrefixRegex =
    /(?:<[\|\s]*(?:DSML[\|\s]*)?tool_call[\|\s]*>\s*(?:call[:=]|l:|tool[:=])?|(?:call[:=]|tool[:=]))\s*([a-zA-Z0-9_\-:\.\/]+)\s*(?=\{)/gi;
  while ((match = kiroPrefixRegex.exec(normalizedText)) !== null) {
    const toolName = match[1];
    const openBraceIdx = match.index + match[0].length;
    const balanced = extractBalancedJson(normalizedText, openBraceIdx);
    if (balanced) {
      try {
        detected.push({
          name: matchToolName(toolName),
          args: JSON.parse(balanced.jsonText),
        });
      } catch {
        try {
          detected.push({
            name: matchToolName(toolName),
            args: JSON.parse(sanitizeJsonBackslashes(balanced.jsonText)),
          });
        } catch {
          detected.push({
            name: matchToolName(toolName),
            args: extractToolArguments(balanced.jsonText),
          });
        }
      }
      kiroPrefixRegex.lastIndex = balanced.endIndex;
    } else {
      const closeTagMatch = normalizedText
        .slice(openBraceIdx)
        .match(/^(\{[\s\S]*?)<[\|\/\s]*(?:DSML[\|\s]*)?tool_call[\|\/\s]*>/i);
      if (closeTagMatch) {
        detected.push({
          name: matchToolName(toolName),
          args: extractToolArguments(closeTagMatch[1]),
        });
      }
    }
  }

  // Format 4b: Qwen / Hermes / DeepSeek <tool_call>{"name": "TOOL", "arguments": {...}}</tool_call>
  const qwenToolCallRegex = /<[\|\s]*tool_call[\|\s]*>\s*(?=\{)/gi;
  while ((match = qwenToolCallRegex.exec(normalizedText)) !== null) {
    const openBraceIdx = match.index + match[0].length;
    const balanced = extractBalancedJson(normalizedText, openBraceIdx);
    if (balanced) {
      try {
        const data = JSON.parse(balanced.jsonText);
        const rawName = data.name || data.tool;
        const args = data.arguments || data.input || data.parameters || data.args || {};
        if (rawName) {
          detected.push({
            name: matchToolName(rawName),
            args: typeof args === 'object' && args !== null ? args : extractToolArguments(String(args)),
          });
        }
      } catch {
        const parsedArgs = extractToolArguments(balanced.jsonText);
        const rawName = parsedArgs.name || parsedArgs.tool;
        if (rawName) {
          detected.push({
            name: matchToolName(rawName),
            args: parsedArgs.arguments || parsedArgs,
          });
        }
      }
      qwenToolCallRegex.lastIndex = balanced.endIndex;
    }
  }

  // Format 6: Gemini Canvas dots_function_call format
  const dotsRegex = /<dots_function_call>\s*<([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/\1>\s*<\/dots_function_call>/gi;
  while ((match = dotsRegex.exec(normalizedText)) !== null) {
    const toolName = match[1];
    const toolContent = match[2].trim();
    if (toolName === 'execute_pwsh' || toolName === 'execute_bash' || toolName === 'bash' || toolName === 'powershell') {
      detected.push({ name: matchToolName('execute_pwsh'), args: { command: toolContent } });
    } else {
      try {
        const args = JSON.parse(toolContent);
        detected.push({ name: matchToolName(toolName), args });
      } catch {
        detected.push({ name: matchToolName(toolName), args: extractToolArguments(toolContent) });
      }
    }
  }

  // Format 6b: Standalone Direct Tool XML Tags (<read_file>path</read_file>, <execute_pwsh>cmd</execute_pwsh>)
  const directTagRegex =
    /<(read_file|read_code|fs_write|write_file|str_replace|edit_file|execute_pwsh|execute_bash|bash|powershell|list_directory|grep_search|file_search|invoke_sub_agent)>([\s\S]*?)<\/\1>/gi;
  while ((match = directTagRegex.exec(normalizedText)) !== null) {
    const rawTag = match[1];
    const rawContent = match[2].trim();
    if (rawTag === 'execute_pwsh' || rawTag === 'execute_bash' || rawTag === 'bash' || rawTag === 'powershell') {
      detected.push({ name: matchToolName('execute_pwsh'), args: { command: rawContent } });
    } else if (rawTag === 'read_file' || rawTag === 'read_code') {
      let pathVal = rawContent;
      try {
        const parsed = JSON.parse(rawContent);
        pathVal = parsed.path || parsed.file || rawContent;
      } catch {}
      detected.push({
        name: matchToolName('read_file'),
        args: { path: String(pathVal).replace(/^["']|["']$/g, '').trim() },
      });
    } else if (rawTag === 'list_directory') {
      let pathVal = rawContent;
      try {
        const parsed = JSON.parse(rawContent);
        pathVal = parsed.path || rawContent;
      } catch {}
      detected.push({
        name: matchToolName('list_directory'),
        args: { path: String(pathVal).replace(/^["']|["']$/g, '').trim() || '.' },
      });
    } else {
      try {
        const args = JSON.parse(rawContent);
        detected.push({ name: matchToolName(rawTag), args });
      } catch {
        detected.push({ name: matchToolName(rawTag), args: extractToolArguments(rawContent) });
      }
    }
  }

  // Format 7: function_calls wrapper with invoke blocks
  const fnCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/gi;
  while ((match = fnCallsRegex.exec(normalizedText)) !== null) {
    const innerContent = match[1];
    const innerInvokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = innerInvokeRegex.exec(innerContent)) !== null) {
      try {
        const args = JSON.parse(innerMatch[2]);
        detected.push({ name: matchToolName(innerMatch[1]), args });
      } catch {
        const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
        let paramMatch: RegExpExecArray | null;
        const args: Record<string, any> = {};
        while ((paramMatch = paramRegex.exec(innerMatch[2])) !== null) {
          args[paramMatch[1]] = paramMatch[2].trim();
        }
        if (Object.keys(args).length > 0) {
          detected.push({ name: matchToolName(innerMatch[1]), args });
        } else {
          detected.push({ name: matchToolName(innerMatch[1]), args: extractToolArguments(innerMatch[2]) });
        }
      }
    }
  }

  // Format 9: OpenAI native tool_calls JSON in content
  try {
    const tcIdx = normalizedText.indexOf('"tool_calls"');
    if (tcIdx !== -1) {
      const openIdx = normalizedText.lastIndexOf('{', tcIdx);
      const balanced = openIdx !== -1 ? extractBalancedJson(normalizedText, openIdx) : null;
      if (balanced) {
        const data = JSON.parse(balanced.jsonText);
        if (data.tool_calls && Array.isArray(data.tool_calls)) {
          data.tool_calls.forEach((tc: any) => {
            if (tc.function && tc.function.name) {
              let args = {};
              if (tc.function.arguments) {
                try {
                  args =
                    typeof tc.function.arguments === 'string'
                      ? JSON.parse(tc.function.arguments)
                      : tc.function.arguments;
                } catch {
                  args = extractToolArguments(String(tc.function.arguments));
                }
              }
              detected.push({ name: matchToolName(tc.function.name), args });
            }
          });
        }
      }
    }
  } catch {}

  // Format 10: Parameter tag format (nested parameters)
  const paramOnlyRegex = /<invoke\s+name="([^"]+)">\s*(<parameter[\s\S]*?<\/invoke>)/gi;
  while ((match = paramOnlyRegex.exec(normalizedText)) !== null) {
    const toolName = match[1];
    const content = match[2];
    const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
    let paramMatch: RegExpExecArray | null;
    const args: Record<string, any> = {};
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      args[paramMatch[1]] = paramMatch[2].trim();
    }
    if (Object.keys(args).length > 0) {
      detected.push({ name: matchToolName(toolName), args });
    }
  }

  // Format 11: antml_function_calls format
  const antmlRegex = /<antml_function_calls>([\s\S]*?)<\/antml_function_calls>/gi;
  while ((match = antmlRegex.exec(normalizedText)) !== null) {
    const innerContent = match[1];
    const antmlInvokeRegex = /<antml_invoke\s+name="([^"]+)">([\s\S]*?)<\/antml_invoke>/g;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = antmlInvokeRegex.exec(innerContent)) !== null) {
      const toolName = innerMatch[1];
      const content = innerMatch[2];
      const antmlParamRegex = /<antml_parameter\s+name="([^"]+)">([\s\S]*?)<\/antml_parameter>/g;
      let paramMatch: RegExpExecArray | null;
      const args: Record<string, any> = {};
      while ((paramMatch = antmlParamRegex.exec(content)) !== null) {
        args[paramMatch[1]] = paramMatch[2].trim();
      }
      if (Object.keys(args).length > 0) {
        detected.push({ name: matchToolName(toolName), args });
      } else {
        try {
          const jsonArgs = JSON.parse(content.trim());
          detected.push({ name: matchToolName(toolName), args: jsonArgs });
        } catch {
          detected.push({ name: matchToolName(toolName), args: extractToolArguments(content) });
        }
      }
    }
  }

  // Format 12: Tool calls with function/parameter syntax
  const toolCallParamRegex = /<tool_call>\s*<function=([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/function>\s*<\/tool_call>/gi;
  while ((match = toolCallParamRegex.exec(normalizedText)) !== null) {
    const toolName = match[1];
    const content = match[2];
    const paramRegex = /<parameter=([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/parameter>/g;
    let paramMatch: RegExpExecArray | null;
    const args: Record<string, any> = {};
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      args[paramMatch[1]] = paramMatch[2].trim();
    }
    if (Object.keys(args).length > 0) {
      detected.push({ name: matchToolName(toolName), args });
    }
  }

  // Format 13: Opensource XML tag tool calls
  const opensourceTcRegex = /<tool_call(?::[a-zA-Z0-9_\-]+)?>([\s\S]*?)<\/tool_call(?::[a-zA-Z0-9_\-]+)?>/gi;
  while ((match = opensourceTcRegex.exec(normalizedText)) !== null) {
    const block = match[1].trim();
    const nameMatch = block.match(/^([a-zA-Z0-9_\-]+)\s*(?=<arg_key)/i);
    if (!nameMatch) continue;
    const toolName = nameMatch[1];

    const args: Record<string, any> = {};
    const kvRegex =
      /<arg_key(?::[a-zA-Z0-9_\-]+)?>([\s\S]*?)<\/arg_key(?::[a-zA-Z0-9_\-]+)?>\s*<arg_value(?::[a-zA-Z0-9_\-]+)?>([\s\S]*?)<\/arg_value(?::[a-zA-Z0-9_\-]+)?>/gi;
    let kv: RegExpExecArray | null;
    while ((kv = kvRegex.exec(block)) !== null) {
      const key = kv[1].trim();
      let val = kv[2].trim();
      if (key === 'path' && val.includes('kiro-integration.agents')) {
        val = val.replace('kiro-integration.agents', 'kiro-integration\\.agents');
      }
      args[key] = val;
    }
    if (Object.keys(args).length > 0) {
      detected.push({ name: matchToolName(toolName), args });
    }
  }

  // Format 14: Structural Manifest & Code File Auto-Extraction
  if (!detected.some((t) => t.name === 'fs_write')) {
    const codeBlockRegex =
      /(?:(?:(?:###|##|#|\*\*|File:?|Create:?|Write:?|Save to:?)\s*[`'"]?([a-zA-Z0-9_\-\.\/\\\\]+\.[a-zA-Z0-9_\-]+)[`'"]?|(?:\/\/|#)\s*[`'"]?([a-zA-Z0-9_\-\.\/\\\\]+\.[a-zA-Z0-9_\-]+)[`'"]?)\s*\r?\n\s*)?```([a-zA-Z0-9_\-]+)?(?::([a-zA-Z0-9_\-\.\/\\\\]+))?\r?\n([\s\S]*?)```/gi;
    let cbMatch: RegExpExecArray | null;
    while ((cbMatch = codeBlockRegex.exec(normalizedText)) !== null) {
      const headerPath = cbMatch[1] || cbMatch[2];
      const lang = (cbMatch[3] || '').toLowerCase().trim();
      const inlinePath = cbMatch[4];
      const content = cbMatch[5];
      const targetPath = inlinePath || headerPath;

      if (targetPath && targetPath.includes('.') && content && content.trim().length > 0) {
        const cleanedPath = targetPath.replace(/^[\\\/]+/, '').trim();
        if (!cleanedPath.endsWith('.md') || cleanedPath.includes('/')) {
          detected.push({
            name: matchToolName('fs_write'),
            args: { path: cleanedPath, text: content },
          });
        }
      } else if (
        !targetPath &&
        (lang === 'json' || !lang) &&
        content &&
        content.trim().startsWith('{') &&
        content.trim().endsWith('}')
      ) {
        try {
          const parsedJson = JSON.parse(sanitizeJsonBackslashes(content.trim()));
          if (isPackageJsonManifest(parsedJson)) {
            detected.push({
              name: matchToolName('fs_write'),
              args: { path: 'package.json', text: content.trim() },
            });
          } else if (isTsConfigManifest(parsedJson)) {
            detected.push({
              name: matchToolName('fs_write'),
              args: { path: 'tsconfig.json', text: content.trim() },
            });
          }
        } catch {}
      }
    }
  }

  // Terminal Command Auto-Extraction (execute_pwsh)
  if (!detected.some((t) => t.name === 'execute_pwsh')) {
    const cmdBlockRegex =
      /(?:(?:run|execute|install|command|terminal)[:\s]*\r?\n\s*)?```(?:bash|sh|powershell|pwsh|cmd)\r?\n([\s\S]*?)```/gi;
    let cmdMatch: RegExpExecArray | null;
    while ((cmdMatch = cmdBlockRegex.exec(normalizedText)) !== null) {
      const cmdText = cmdMatch[1].trim();
      const lines = cmdText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      const isCliCommand = lines.some((l) =>
        /^(?:npm|npx|node|pnpm|yarn|git|cargo|pip|python|dotnet|go|tsc)\b/i.test(l)
      );
      if (isCliCommand && lines.length > 0) {
        detected.push({
          name: matchToolName('execute_pwsh'),
          args: { command: lines.join(' && ') },
        });
        break;
      }
    }
  }

  // Format 16: Llama 3 <|python_tag|> and Python-style function calls
  const pyCallRegex = /(?:<[\|\s]*python_tag[\|\s]*>\s*)?([a-zA-Z0-9_\-]+)\s*\(([\s\S]*?)\)/gi;
  let pyMatch: RegExpExecArray | null;
  while ((pyMatch = pyCallRegex.exec(normalizedText)) !== null) {
    const rawToolName = pyMatch[1];
    const argsStr = pyMatch[2].trim();
    const matched = matchToolName(rawToolName);
    if (!isKnownTool(rawToolName, matched, availableTools)) continue;

    const kvRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_.-]+))/g;
    let kvMatch: RegExpExecArray | null;
    const parsedArgs: Record<string, any> = {};
    while ((kvMatch = kvRegex.exec(argsStr)) !== null) {
      parsedArgs[kvMatch[1]] =
        kvMatch[2] !== undefined ? kvMatch[2] : kvMatch[3] !== undefined ? kvMatch[3] : kvMatch[4];
    }
    if (Object.keys(parsedArgs).length > 0 || argsStr === '') {
      detected.push({ name: matched, args: parsedArgs });
    }
  }

  return detected;
}

/**
 * Strip tool blocks from text content to prevent duplicate rendering in chat bubbles
 */
export function stripToolBlocksFromText(text: string): string {
  if (!text) return '';
  let cleaned = String(text).replace(/[\uFF5C\u2502\u00A6]/g, '|');

  // Remove balanced <|tool_call>call:NAME{...}<tool_call|> and headless call:NAME{...}<tool_call|> blocks first
  const kiroPrefixRegex =
    /(?:<[\|\s]*(?:DSML[\|\s]*)?tool_call[\|\s]*>\s*(?:call[:=]|l:|tool[:=])?|(?:call[:=]|tool[:=]))\s*[a-zA-Z0-9_\-:\.\/]+\s*(?=\{)/i;
  let m: RegExpExecArray | null;
  let safety = 0;
  while ((m = kiroPrefixRegex.exec(cleaned)) !== null && safety++ < 25) {
    const startIdx = m.index;
    const openBraceIdx = startIdx + m[0].length;
    const balanced = extractBalancedJson(cleaned, openBraceIdx);
    if (!balanced) break;
    let endIdx = balanced.endIndex;
    const closeMatch = cleaned.slice(endIdx).match(/^\s*<[\|\/\s]*(?:DSML[\|\s]*)?tool_call[\|\/\s]*>/i);
    if (closeMatch) endIdx += closeMatch[0].length;
    cleaned = cleaned.slice(0, startIdx) + cleaned.slice(endIdx);
  }

  // Remove JSON tool blocks
  cleaned = cleaned.replace(
    /```(?:json|tool_call)?\s*\{\s*(?:"tool"|"name"):\s*"[^"]+",\s*(?:"arguments"|"input"|"parameters"|"args"):\s*\{[\s\S]*?\}\s*\}\s*```/gi,
    ''
  );

  // Remove bare JSON tool blocks
  const bareJsonStripRegex = /\{\s*"(?:tool|name|action|arguments|input|parameters|args)"/gi;
  let bMatch: RegExpExecArray | null;
  let bSafety = 0;
  while ((bMatch = bareJsonStripRegex.exec(cleaned)) !== null && bSafety++ < 25) {
    const startIdx = bMatch.index;
    const balanced = extractBalancedJson(cleaned, startIdx);
    if (!balanced) break;
    const txt = balanced.jsonText;
    if (
      /(?:"tool"|"name"|"action")\s*:\s*"[a-zA-Z0-9_\-:\.\/]+"/.test(txt) &&
      /(?:"arguments"|"input"|"parameters"|"args"|"action_input")\s*:/.test(txt)
    ) {
      cleaned = cleaned.slice(0, startIdx) + cleaned.slice(balanced.endIndex);
      bareJsonStripRegex.lastIndex = startIdx;
    } else {
      bareJsonStripRegex.lastIndex = balanced.endIndex;
    }
  }

  // Remove XML invoke blocks
  cleaned = cleaned.replace(/<invoke\s+name="[^"]+">([\s\S]*?)<\/invoke>/gi, '');

  // Remove standalone direct tool XML tags
  cleaned = cleaned.replace(
    /<(read_file|read_code|fs_write|write_file|str_replace|edit_file|execute_pwsh|execute_bash|bash|powershell|list_directory|grep_search|file_search|invoke_sub_agent)>[\s\S]*?<\/\1>/gi,
    ''
  );

  // Remove Anthropic tool_use blocks
  cleaned = cleaned.replace(/<tool_use>[\s\S]*?<\/tool_use>/gi, '');

  // Remove Kiro native tool_call blocks and orphaned tool_call tags
  cleaned = cleaned.replace(
    /<[\|\s]*(?:DSML[\|\s]*)?tool_call[\|\s]*>[\s\S]*?<[\|\/\s]*(?:DSML[\|\s]*)?tool_call[\|\/\s]*>/gi,
    ''
  );
  cleaned = cleaned.replace(/<[\|\/\s]*(?:DSML[\|\s]*)?tool_call[\|\/\s]*>/gi, '');

  // Remove bare tool invocation markers
  cleaned = cleaned.replace(/\[tool_call:\s*\w+[\s\S]*?\]/gi, '');

  // Remove dots_function_call blocks
  cleaned = cleaned.replace(/<dots_function_call>[\s\S]*?<\/dots_function_call>/gi, '');

  // Remove function_calls wrapper blocks
  cleaned = cleaned.replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '');

  // Remove tool_use blocks with <input> tag
  cleaned = cleaned.replace(/<tool_use>[\s\S]*?<input>[\s\S]*?<\/input>[\s\S]*?<\/tool_use>/gi, '');

  // Remove OpenAI tool_calls JSON structures
  cleaned = cleaned.replace(/\{\s*"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}/gi, '');

  // Remove antml_function_calls blocks
  cleaned = cleaned.replace(/<antml_function_calls>[\s\S]*?<\/antml_function_calls>/gi, '');

  // Remove tool_call with function/parameter syntax
  cleaned = cleaned.replace(
    /<tool_call>\s*<function=[a-zA-Z0-9_\-]+>[\s\S]*?<\/function>\s*<\/tool_call>/gi,
    ''
  );

  // Remove opensource XML tool call blocks
  cleaned = cleaned.replace(/<tool_calls(?::[a-zA-Z0-9_\-]+)?>[\s\S]*?<\/tool_calls(?::[a-zA-Z0-9_\-]+)?>/gi, '');
  cleaned = cleaned.replace(/<tool_call(?::[a-zA-Z0-9_\-]+)?>[\s\S]*?<\/tool_call(?::[a-zA-Z0-9_\-]+)?>/gi, '');

  // Remove thinking tags
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

  // Remove bare manifest JSON blocks
  const manifestStripRegex = /\{\s*"(?:name|compilerOptions|scripts|dependencies)"/gi;
  let mMatch: RegExpExecArray | null;
  let mSafety = 0;
  while ((mMatch = manifestStripRegex.exec(cleaned)) !== null && mSafety++ < 25) {
    const startIdx = mMatch.index;
    const balanced = extractBalancedJson(cleaned, startIdx);
    if (!balanced) break;
    try {
      const parsedJson = JSON.parse(sanitizeJsonBackslashes(balanced.jsonText));
      if (isPackageJsonManifest(parsedJson) || isTsConfigManifest(parsedJson)) {
        cleaned = cleaned.slice(0, startIdx) + cleaned.slice(balanced.endIndex);
        manifestStripRegex.lastIndex = startIdx;
        continue;
      }
    } catch {}
    manifestStripRegex.lastIndex = balanced.endIndex;
  }

  // Remove fenced manifest JSON blocks
  cleaned = cleaned.replace(
    /```(?:json(?::[a-zA-Z0-9_\-\.\/]+)?)?\s*\{\s*"(?:name|compilerOptions)"[\s\S]*?\}\s*```/gi,
    (match) => {
      try {
        const jsonStr = match.replace(/^```[^\n]*\r?\n/, '').replace(/\r?\n```$/, '');
        const parsed = JSON.parse(sanitizeJsonBackslashes(jsonStr));
        if (isPackageJsonManifest(parsed) || isTsConfigManifest(parsed)) {
          return '';
        }
      } catch {}
      return match;
    }
  );

  // Remove Mistral [TOOL_CALLS] wrapper
  cleaned = cleaned.replace(/\[TOOL_CALLS\]\s*\[?[\s\S]*?\]?/gi, '');

  // Remove Llama 3 <|python_tag|> blocks
  cleaned = cleaned.replace(/<[\|\s]*python_tag[\|\s]*>[\s\S]*?(?=(?:<[\|\s]*python_tag|\n\n|$))/gi, '');

  // Clean up excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Normalize tool aliases and arguments (INV-12)
 */
export function normalizeToolAliases(
  toolName: string,
  args: any = {},
  responseText: string = ''
): { name: string; args: Record<string, any> } {
  let finalToolName = String(toolName || '').trim();
  let parsed: Record<string, any> = typeof args === 'object' && args !== null ? { ...args } : {};

  if (finalToolName === 'general-task-execution' || finalToolName === 'context-gatherer') {
    const agentName = finalToolName;
    finalToolName = 'invoke_sub_agent';
    parsed.name = agentName;
    parsed.prompt = parsed.prompt || '';
    parsed.explanation = parsed.explanation || `Delegating ${agentName} task`;
  } else if (finalToolName === 'write_file' || finalToolName === 'write_to_file' || finalToolName === 'create_file') {
    finalToolName = 'fs_write';
  } else if (
    finalToolName === 'edit_file' ||
    finalToolName === 'modify_file' ||
    finalToolName === 'replace_file_content'
  ) {
    finalToolName =
      parsed.oldStr || parsed.old_str || parsed.find || parsed.TargetContent || parsed.targetContent
        ? 'str_replace'
        : 'fs_write';
  } else if (
    finalToolName === 'run_command' ||
    finalToolName === 'bash' ||
    finalToolName === 'powershell' ||
    finalToolName === 'terminal' ||
    finalToolName === 'exec'
  ) {
    finalToolName = 'execute_pwsh';
  } else if (finalToolName === 'ls' || finalToolName === 'dir' || finalToolName === 'list_dir') {
    finalToolName = 'list_directory';
  } else if (
    finalToolName === 'cat' ||
    finalToolName === 'type' ||
    finalToolName === 'read' ||
    finalToolName === 'open_file'
  ) {
    finalToolName = 'read_file';
  } else if (finalToolName === 'search_files' || finalToolName === 'find_files' || finalToolName === 'find') {
    finalToolName = 'file_search';
  } else if (finalToolName === 'grep' || finalToolName === 'search_code') {
    finalToolName = 'grep_search';
  } else if (
    finalToolName === 'delete_file' ||
    finalToolName === 'remove_file' ||
    finalToolName === 'unlink' ||
    finalToolName === 'rm'
  ) {
    const targetPath = parsed.path || parsed.file || parsed.filepath || parsed.TargetFile || parsed.targetFile || '';
    finalToolName = 'execute_pwsh';
    parsed = {
      command: `Remove-Item -Path "${targetPath}" -Force -ErrorAction SilentlyContinue`,
      explanation: parsed.explanation || `Deleting ${targetPath}`,
    };
  } else if (finalToolName.includes(':')) {
    finalToolName = finalToolName.split(':').pop() || finalToolName;
  }

  if (finalToolName === 'invoke_sub_agent') {
    const agentName = parsed.name || parsed.agent_name || 'general-task-execution';
    parsed = {
      name: agentName,
      prompt: parsed.prompt || '',
      explanation: parsed.explanation || `Delegating ${agentName} task to analyze workspace.`,
    };
  } else if (finalToolName === 'fs_write') {
    const targetPath =
      parsed.path ||
      parsed.file ||
      parsed.filepath ||
      parsed.TargetFile ||
      parsed.targetFile ||
      parsed.filePath ||
      parsed.FilePath ||
      '.';
    const content =
      parsed.text !== undefined
        ? parsed.text
        : parsed.content !== undefined
        ? parsed.content
        : parsed.code !== undefined
        ? parsed.code
        : parsed.CodeContent !== undefined
        ? parsed.CodeContent
        : parsed.codeContent !== undefined
        ? parsed.codeContent
        : '';
    parsed = { path: targetPath, text: String(content) };
  } else if (finalToolName === 'str_replace') {
    parsed.path =
      parsed.path ||
      parsed.file ||
      parsed.filepath ||
      parsed.TargetFile ||
      parsed.targetFile ||
      parsed.filePath ||
      parsed.FilePath ||
      '.';
    parsed.oldStr =
      parsed.oldStr ||
      parsed.old_str ||
      parsed.find ||
      parsed.TargetContent ||
      parsed.targetContent ||
      parsed.old_string ||
      parsed.oldString ||
      '';
    parsed.newStr =
      parsed.newStr !== undefined
        ? parsed.newStr
        : parsed.new_str !== undefined
        ? parsed.new_str
        : parsed.replace !== undefined
        ? parsed.replace
        : parsed.ReplacementContent !== undefined
        ? parsed.ReplacementContent
        : parsed.replacementContent !== undefined
        ? parsed.replacementContent
        : parsed.new_string !== undefined
        ? parsed.new_string
        : parsed.newString !== undefined
        ? parsed.newString
        : '';
  } else if (finalToolName === 'read_file' || finalToolName === 'read_code') {
    finalToolName = 'read_file';
    parsed.path =
      parsed.path ||
      parsed.file ||
      parsed.filepath ||
      parsed.AbsolutePath ||
      parsed.absolutePath ||
      parsed.FilePath ||
      parsed.filePath ||
      parsed.TargetFile ||
      parsed.targetFile ||
      '';
    if (!parsed.explanation) {
      parsed.explanation = `Reading ${parsed.path}`;
    }
  } else if (finalToolName === 'execute_pwsh' || finalToolName === 'execute_bash') {
    finalToolName = 'execute_pwsh';
    let cmd =
      parsed.command ||
      parsed.cmd ||
      parsed.script ||
      parsed.code ||
      parsed.CommandLine ||
      parsed.commandLine ||
      parsed.powershell ||
      parsed.pwsh ||
      parsed.terminal ||
      parsed.exec ||
      '';
    if (!cmd && parsed.input) {
      cmd =
        typeof parsed.input === 'object'
          ? parsed.input.command || parsed.input.cmd || parsed.input.script || ''
          : String(parsed.input);
    }
    if (!cmd && parsed.action_input) {
      cmd =
        typeof parsed.action_input === 'object'
          ? parsed.action_input.command || parsed.action_input.cmd || parsed.action_input.script || ''
          : String(parsed.action_input);
    }
    if (!cmd && parsed.arguments) {
      cmd =
        typeof parsed.arguments === 'object'
          ? parsed.arguments.command || parsed.arguments.cmd || parsed.arguments.script || ''
          : String(parsed.arguments);
    }
    if (!cmd && parsed.args) {
      cmd = Array.isArray(parsed.args)
        ? parsed.args.join(' ')
        : typeof parsed.args === 'object'
        ? parsed.args.command || parsed.args.cmd || ''
        : String(parsed.args);
    }
    if (typeof cmd === 'string') {
      cmd = cmd.replace(/^(?:PS(?:\s*[\w:\\/.-]+)?\s*>\s*|\$\s+(?![a-zA-Z0-9_]+\s*=))/, '').trim();
      cmd = cmd.replace(/(^|[;&|\r\n]\s*)curl(?:\.exe)?(\s+)/g, (_m: string, p1: string, p2: string) => p1 + 'curl.exe' + p2);
      if (/^\s*(?:Invoke-WebRequest|iwr)\s*(?:-Uri\s*["']?\s*["']?)?\s*$/i.test(cmd)) {
        console.warn('[KiroProxy] ⚠️ Suppressing Invoke-WebRequest without URI to prevent PowerShell interactive prompt loop');
        cmd = '';
      }
    }
    parsed.command = cmd;

    if ((!parsed.command || typeof parsed.command !== 'string' || parsed.command.trim().length === 0) && responseText) {
      const codeBlockMatch = responseText.match(/```(?:powershell|pwsh|bash|sh|cmd)?\r?\n([\s\S]*?)```/i);
      if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
        let recovered = codeBlockMatch[1]
          .replace(/^(?:PS(?:\s*[\w:\\/.-]+)?\s*>\s*|\$\s+(?![a-zA-Z0-9_]+\s*=))/, '')
          .trim();
        recovered = recovered.replace(/(^|[;&|\r\n]\s*)curl(?:\.exe)?(\s+)/g, (_m: string, p1: string, p2: string) => p1 + 'curl.exe' + p2);
        if (/^\s*(?:Invoke-WebRequest|iwr)\s*(?:-Uri\s*["']?\s*["']?)?\s*$/i.test(recovered)) {
          recovered = '';
        }
        parsed.command = recovered;
      }
    }
  } else if (finalToolName === 'list_directory') {
    const targetPath = parsed.path || parsed.directory || parsed.dir || parsed.folder || parsed.target || '.';
    parsed = { path: targetPath || '.', explanation: parsed.explanation || `Listing contents of ${targetPath || '.'}` };
  } else if (finalToolName === 'grep_search' || finalToolName === 'file_search') {
    parsed.query = parsed.query || parsed.pattern || parsed.search || '';
    if (!parsed.explanation) {
      parsed.explanation = `Searching for ${parsed.query}`;
    }
  }

  return { name: finalToolName, args: parsed };
}

/**
 * Extract both native and text-embedded tool calls from upstream provider responses
 */
export function extractToolsAndTextFromProviderResponse(
  parsed: any,
  availableTools: any[] = []
): ProviderResponseExtractionResult {
  let responseText = '';
  const rawToolCalls: ExtractedToolCall[] = [];

  if (!parsed) {
    return {
      text: '',
      rawText: '',
      toolCalls: [],
      stopReason: 'END_TURN',
    };
  }

  if (typeof parsed === 'string') {
    responseText = parsed;
  } else if (Array.isArray(parsed?.choices) && parsed.choices.length > 0) {
    const firstChoice = parsed.choices[0] || {};
    const msg = firstChoice.message || {};
    if (typeof msg.content === 'string' && msg.content.length > 0) {
      responseText = msg.content;
    } else if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.length > 0) {
      responseText = msg.reasoning_content;
    } else if (typeof msg.reasoning === 'string' && msg.reasoning.length > 0) {
      responseText = msg.reasoning;
    } else if (typeof msg.thought === 'string' && msg.thought.length > 0) {
      responseText = msg.thought;
    } else if (Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b && typeof b === 'object') {
          if (b.type === 'text' && b.text) responseText += b.text;
          if (b.type === 'tool_use') {
            let args = b.input || {};
            if (args && args.json && typeof args.json === 'object') args = args.json;
            rawToolCalls.push({ name: b.name || 'unknown', args });
          }
        }
      }
    } else if (typeof firstChoice.text === 'string') {
      responseText = firstChoice.text;
    }
  } else if (Array.isArray(parsed?.content)) {
    for (const b of parsed.content) {
      if (b && typeof b === 'object') {
        if (b.type === 'text' && b.text) responseText += b.text;
        if (b.type === 'tool_use') {
          let args = b.input || {};
          if (args && args.json && typeof args.json === 'object') args = args.json;
          rawToolCalls.push({ name: b.name || 'unknown', args });
        }
      }
    }
  }

  // Native OpenAI tool_calls
  const nativeCalls = parsed?.choices?.[0]?.message?.tool_calls;
  if (Array.isArray(nativeCalls)) {
    for (const tc of nativeCalls) {
      if (!tc) continue;
      const fn = tc.function || tc;
      let args: any = {};
      if (typeof fn.arguments === 'string') {
        try {
          args = JSON.parse(fn.arguments);
        } catch {
          args = extractToolArguments(fn.arguments);
        }
      } else if (typeof fn.arguments === 'object' && fn.arguments) {
        args = fn.arguments;
      }
      if (args && args.json && typeof args.json === 'object') args = args.json;
      rawToolCalls.push({ name: fn.name || 'unknown', args: args || {} });
    }
  }

  // Also extract text-based tool calls from responseText
  if (responseText && typeof responseText === 'string') {
    const textToolCalls = extractToolCallsFromResponse(responseText, availableTools);
    if (Array.isArray(textToolCalls)) {
      for (const tt of textToolCalls) {
        if (!rawToolCalls.some((t) => (t.name || '').toLowerCase() === (tt.name || '').toLowerCase())) {
          rawToolCalls.push(tt);
        }
      }
    }
  }

  // Normalize, validate, and filter out suppressed/invalid tool calls
  const validatedToolCalls: ExtractedToolCall[] = [];
  for (const rawTool of rawToolCalls) {
    if (!rawTool || !rawTool.name) continue;
    const normalized = normalizeToolAliases(rawTool.name, rawTool.args || {}, responseText);
    const finalToolName = normalized.name;
    const finalArgs = normalized.args || {};

    if (finalToolName === 'execute_pwsh') {
      if (!finalArgs.command || typeof finalArgs.command !== 'string' || finalArgs.command.trim().length === 0) {
        console.warn(
          '[KiroProxy] ⚠️ Suppressing execute_pwsh with empty command during extraction to prevent IDE validation loop'
        );
        continue;
      }
    } else if (finalToolName === 'str_replace') {
      if (!finalArgs.oldStr || typeof finalArgs.oldStr !== 'string' || finalArgs.oldStr.trim().length === 0) {
        console.warn('[KiroProxy] ⚠️ Suppressing str_replace with empty oldStr during extraction');
        continue;
      }
    } else if (finalToolName === 'read_file') {
      if (!finalArgs.path || typeof finalArgs.path !== 'string' || finalArgs.path.trim().length === 0) {
        console.warn('[KiroProxy] ⚠️ Suppressing read_file with empty path during extraction');
        continue;
      }
    }

    validatedToolCalls.push({ name: finalToolName, args: finalArgs });
  }

  // Determine clean text and stopReason
  const hasTools = validatedToolCalls.length > 0;
  const cleanText =
    typeof responseText === 'string' && hasTools
      ? stripToolBlocksFromText(responseText)
      : typeof responseText === 'string'
      ? responseText
      : '';

  return {
    text: cleanText,
    rawText: typeof responseText === 'string' ? responseText : '',
    toolCalls: validatedToolCalls,
    stopReason: hasTools ? 'TOOL_USE' : 'END_TURN',
  };
}

/**
 * ToolExtractor class preserving full backward compatibility with Kiro Bedrock handlers
 */
export class ToolExtractor {
  public extractTools(body: any): NormalizedTool[] {
    const tools: NormalizedTool[] = [];
    if (!body) return tools;

    const rawTools = body.tools || body.conversationState?.tools || body.toolConfig?.tools;
    if (!Array.isArray(rawTools)) return tools;

    for (const item of rawTools) {
      if (item.toolSpec) {
        const spec = item.toolSpec;
        tools.push({
          name: spec.name,
          description: spec.description || '',
          parameters: spec.inputSchema?.json || spec.inputSchema || { type: 'object', properties: {} },
        });
        continue;
      }

      if (item.function || item.type === 'function') {
        const fn = item.function || item;
        tools.push({
          name: fn.name,
          description: fn.description || '',
          parameters: fn.parameters || { type: 'object', properties: {} },
        });
        continue;
      }

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

  public extractMetadata(tool: any) {
    return extractToolMetadata(tool);
  }

  public extractToolCalls(responseText: string, availableTools?: any[]) {
    return extractToolCallsFromResponse(responseText, availableTools);
  }

  public stripToolBlocks(text: string) {
    return stripToolBlocksFromText(text);
  }

  public extractFromResponse(parsed: any, availableTools?: any[]) {
    return extractToolsAndTextFromProviderResponse(parsed, availableTools);
  }

  public normalizeAliases(toolName: string, args?: any, responseText?: string) {
    return normalizeToolAliases(toolName, args, responseText);
  }
}

export const toolExtractor = new ToolExtractor();
