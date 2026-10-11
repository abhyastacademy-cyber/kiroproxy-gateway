#!/usr/bin/env node
/**
 * Kiro IDE Extension Patcher — Cloud & Local Dual-Mode Edition (v5.1)
 *
 * Surgically patches Kiro IDE's `kiro.kiro-agent/dist/extension.js` to route
 * model discovery and `/generateAssistantResponse` Bedrock EventStream inference
 * to any KiroProxy Gateway URL:
 *   - AI Studio Custom Domain : https://kiroproxy.ai.studio
 *   - Cloud Run Domain        : https://kiroproxy-746899042471.asia-southeast1.run.app
 *   - Local Modular Gateway   : http://127.0.0.1:8084
 *
 * Features:
 *   1. Dynamic Dual-Mode Model Discovery (`whgwListModels`):
 *      - Automatically supports both `/listAvailableModels` (Smithy JSON) and
 *        `/v1/models` (OpenAI JSON catalog on Cloud Run v2.5.0-cloud).
 *      - Gracefully falls back to native AWS models if the gateway is unreachable.
 *   2. Conditional `cloudConfig` Flag:
 *      - Suppresses unwanted `fetch_cloud_config` tool calls on every turn.
 *   3. KRS Client (`Bte` & `RKo`) + Runtime `getTarget()` Override:
 *      - Routes `/generateAssistantResponse` to the configured gateway URL even
 *        when no AWS SSO session is active.
 *   4. Idempotent Clean-Backup Patching:
 *      - Always patches from `extension.js.original` so switching `--url` targets
 *        or running `--revert` / `--restore` never corrupts `extension.js`.
 *
 * Usage:
 *   node patch_kiro_extension.js --url https://kiroproxy.ai.studio
 *   node patch_kiro_extension.js --url https://kiroproxy-746899042471.asia-southeast1.run.app
 *   node patch_kiro_extension.js --url http://127.0.0.1:8084
 *   node patch_kiro_extension.js --token mySecretKey --url https://kiroproxy.ai.studio
 *   node patch_kiro_extension.js --check
 *   node patch_kiro_extension.js --revert
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CLOUD_URL = 'https://kiroproxy-746899042471.asia-southeast1.run.app';

// Parse CLI Arguments
const args = process.argv.slice(2);
let targetUrl = '';
let targetToken = '';
let isRevert = false;
let isCheck = false;
let isDryRun = false;
let customPath = '';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--url' && args[i + 1]) {
    targetUrl = args[++i];
  } else if (arg.startsWith('--url=')) {
    targetUrl = arg.split('=').slice(1).join('=');
  } else if (arg === '--token' && args[i + 1]) {
    targetToken = args[++i];
  } else if (arg.startsWith('--token=')) {
    targetToken = arg.split('=').slice(1).join('=');
  } else if (arg === '--revert' || arg === '--restore') {
    isRevert = true;
  } else if (arg === '--check') {
    isCheck = true;
  } else if (arg === '--dry-run') {
    isDryRun = true;
  } else if (arg === '--path' && args[i + 1]) {
    customPath = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║          Kiro IDE Extension Patcher (Cloud & Local v5.1)             ║
║   Point Kiro IDE to AI Studio / Cloud Run Domain or Local Gateway    ║
╚══════════════════════════════════════════════════════════════════════╝

Usage:
  node patch_kiro_extension.js --url https://kiroproxy.ai.studio
  node patch_kiro_extension.js --url https://kiroproxy-746899042471.asia-southeast1.run.app
  node patch_kiro_extension.js --url http://127.0.0.1:8084
  node patch_kiro_extension.js --check
  node patch_kiro_extension.js --revert

Options:
  --url <domain>     Target gateway URL (defaults to ${DEFAULT_CLOUD_URL})
  --token <secret>   Optional PROXY_ADMIN_TOKEN protection (/k/<token>)
  --check            Verify current patch status and active gateway URL
  --revert           Revert patched extension back to native AWS Bedrock endpoints
  --restore          Alias for --revert
  --path <path>      Specify explicit path to Kiro extension.js bundle
  --dry-run          Simulate patching without modifying files on disk
  --help, -h         Show this help message
`);
}

/**
 * Locate Kiro IDE's `kiro.kiro-agent/dist/extension.js` across Windows, macOS, and Linux
 */
function findKiroExtensionJs() {
  if (customPath) {
    const resolved = path.resolve(customPath);
    if (fs.existsSync(resolved)) {
      if (fs.statSync(resolved).isDirectory()) {
        const candidate = path.join(resolved, 'extension.js');
        if (fs.existsSync(candidate)) return candidate;
      } else {
        return resolved;
      }
    }
  }

  const homedir = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');

  const exactCandidates = [
    // Windows standard installer path
    path.join(localAppData, 'Programs', 'Kiro', 'resources', 'app', 'extensions', 'kiro.kiro-agent', 'dist', 'extension.js'),
    path.join(homedir, 'AppData', 'Local', 'Programs', 'Kiro', 'resources', 'app', 'extensions', 'kiro.kiro-agent', 'dist', 'extension.js'),
    // macOS standard bundle path
    '/Applications/Kiro.app/Contents/Resources/app/extensions/kiro.kiro-agent/dist/extension.js',
    path.join(homedir, 'Applications', 'Kiro.app', 'Contents', 'Resources', 'app', 'extensions', 'kiro.kiro-agent', 'dist', 'extension.js'),
    // Linux standard paths
    '/usr/share/kiro/resources/app/extensions/kiro.kiro-agent/dist/extension.js',
    '/opt/Kiro/resources/app/extensions/kiro.kiro-agent/dist/extension.js',
    path.join(homedir, '.local', 'share', 'kiro', 'resources', 'app', 'extensions', 'kiro.kiro-agent', 'dist', 'extension.js')
  ];

  for (const candidate of exactCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback recursive search in user extension directories
  const fallbackSearchRoots = [
    path.join(localAppData, 'Programs', 'Kiro', 'resources', 'app', 'extensions'),
    path.join(homedir, '.kiro', 'extensions')
  ];

  for (const rootDir of fallbackSearchRoots) {
    if (!fs.existsSync(rootDir)) continue;
    try {
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.toLowerCase().includes('kiro-agent')) {
          const distExt = path.join(rootDir, entry.name, 'dist', 'extension.js');
          if (fs.existsSync(distExt)) return distExt;
        }
      }
    } catch (_) {}
  }

  return null;
}

function checkStatus(extFile) {
  if (!extFile || !fs.existsSync(extFile)) {
    console.error('[ERROR] Could not locate Kiro IDE extension.js. Use --path <path/to/extension.js>.');
    process.exit(1);
  }
  const content = fs.readFileSync(extFile, 'utf8');
  const origBackup = extFile + '.original';
  const kiroBackup = extFile + '.kiro-backup';

  const urlMatch = content.match(/\/\*\[WHGW_FORCE_8084\]\*\/"([^"]+)"/);
  const activeUrl = urlMatch ? urlMatch[1] : 'Not Patched (Native AWS)';

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║               Kiro IDE Extension Patch Status (v5.1)                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Target File                           : ${extFile}`);
  console.log(`  Active Gateway Endpoint               : ${activeUrl}`);
  console.log(`  Patch 1 (Model list + /v1/models)     : ${content.includes('whgwListModels') ? '✅ APPLIED (Cloud + Local + Native Fallback)' : '❌ NOT applied'}`);
  console.log(`  Patch 2 (cloudConfig conditional)     : ${!content.includes('/*[WHGW_CC_FLAG]*/true') ? '✅ CLEAN (No unwanted fetch_cloud_config)' : '⚠️  FORCED'}`);
  console.log(`  Patch 3A (KRS Client dynamic endpoint): ${content.includes('/*[WHGW_FORCE_8084]*/') ? '✅ APPLIED' : '❌ NOT applied'}`);
  console.log(`  Patch 3B (Runtime Prompt / getTarget) : ${content.includes('/*[WHGW_RUNTIME_OVERRIDE]*/') ? '✅ APPLIED (Routes /generateAssistantResponse)' : '❌ NOT applied'}`);
  console.log(`  Clean Backup (.original)              : ${fs.existsSync(origBackup) || fs.existsSync(kiroBackup) ? '✅ YES' : '⚠️  NO'}`);
  console.log(`  Bundle Size                           : ${(content.length / 1024 / 1024).toFixed(2)} MB\n`);
}

function revertPatches(extFile) {
  if (!extFile || !fs.existsSync(extFile)) {
    console.error('[ERROR] Could not locate Kiro IDE extension.js. Use --path <path/to/extension.js>.');
    process.exit(1);
  }
  const origFile = extFile + '.original';
  const kiroBackup = extFile + '.kiro-backup';
  const backupSource = fs.existsSync(origFile)
    ? origFile
    : (fs.existsSync(kiroBackup) ? kiroBackup : null);

  if (!backupSource) {
    console.error(`[ERROR] No clean backup found at ${origFile} or ${kiroBackup}`);
    process.exit(1);
  }

  if (!isDryRun) {
    fs.copyFileSync(backupSource, extFile);
  }
  console.log(`\n✅ Successfully reverted ${extFile} from ${path.basename(backupSource)} (Native AWS Providers Active)`);
  console.log('Restart Kiro IDE to activate changes.\n');
}

function buildModelListInterceptor(proxyUrl, tokenHeaderSnippet) {
  // Supports both Smithy `/listAvailableModels` ({ models: [...] }) and OpenAI `/v1/models` ({ data: [...] })
  return `/*[whgwListModels]*/(async(args)=>{try{let h=${tokenHeaderSnippet},c=new AbortController(),s=setTimeout(()=>c.abort(),8000),f=await fetch("${proxyUrl}/listAvailableModels",{headers:h,signal:c.signal});clearTimeout(s);if(f.ok&&(f.headers.get("content-type")||"").includes("json")){let j=await f.json();if(j&&Array.isArray(j.models)){globalThis.__kiroProxyActive=true;return j;}}let c2=new AbortController(),s2=setTimeout(()=>c2.abort(),8000),f2=await fetch("${proxyUrl}/v1/models",{headers:h,signal:c2.signal});clearTimeout(s2);if(f2.ok){let j2=await f2.json(),arr=Array.isArray(j2?.data)?j2.data:[];if(arr.length>0){globalThis.__kiroProxyActive=true;let mList=arr.map(m=>({modelId:m.id,modelName:m.name||m.id,description:m.description||("Cloud Gateway Model ("+(m.owned_by||"free")+")"),rateMultiplier:0,rateUnit:"credit",supportedInputTypes:["TEXT","IMAGE"],tokenLimits:{maxInputTokens:128000,maxOutputTokens:16384},pricing:{prompt:"0",completion:"0",unit:"credit"}}));return{models:mList,defaultModel:{modelId:mList[0].modelId,modelName:mList[0].modelName}};}}}catch(e){};globalThis.__kiroProxyActive=false;`;
}

async function run() {
  const extFile = findKiroExtensionJs();

  if (isCheck) {
    checkStatus(extFile);
    return;
  }

  if (isRevert) {
    revertPatches(extFile);
    return;
  }

  if (!targetUrl) {
    targetUrl = DEFAULT_CLOUD_URL;
  }

  const cleanUrl = targetUrl.trim().replace(/\/+$/, '');
  const destinationUrl = targetToken
    ? `${cleanUrl}/k/${targetToken.trim()}`
    : cleanUrl;

  const tokenHeaderSnippet = targetToken
    ? `{"x-admin-token":${JSON.stringify(targetToken.trim())},"ngrok-skip-browser-warning":"69420"}`
    : `{"ngrok-skip-browser-warning":"69420"}`;

  console.log('\n[Kiro Patcher] Initializing Dual-Mode Cloud/Local Patch (v5.1)...');
  console.log(`[Target Gateway URL]: ${destinationUrl}`);
  if (isDryRun) console.log('[Dry Run]: ON - no changes will be written to disk');

  if (!extFile || !fs.existsSync(extFile)) {
    console.error('\n[ERROR] Could not locate Kiro IDE extension.js automatically.');
    console.error('Pass the explicit path via: node patch_kiro_extension.js --path <path/to/extension.js> --url ' + cleanUrl);
    process.exit(1);
  }

  console.log(`[Found Kiro Bundle] : ${extFile}`);

  const origFile = extFile + '.original';
  const kiroBackup = extFile + '.kiro-backup';
  const existingBackup = fs.existsSync(origFile)
    ? origFile
    : (fs.existsSync(kiroBackup) ? kiroBackup : null);

  let content;
  if (existingBackup) {
    // Always start from clean original backup so switching URLs is 100% idempotent
    content = fs.readFileSync(existingBackup, 'utf8');
    console.log(`[Backup Source]     : Reading clean baseline from ${path.basename(existingBackup)}`);
  } else {
    content = fs.readFileSync(extFile, 'utf8');
    if (!isDryRun) {
      fs.copyFileSync(extFile, origFile);
      fs.copyFileSync(extFile, kiroBackup);
      console.log(`[Backup Created]    : Saved clean original to ${path.basename(origFile)}`);
    }
  }

  let patchCount = 0;

  // ── Patch 1: Model List Dynamic Fallback (/listAvailableModels + /v1/models) ──
  const p1Regex = /transport:(\w+)=(\w+)\}=t;if\(\w+\?\.aborted\)throw \w+\.reason instanceof Error\?\w+\.reason:new Error\("listAvailableModels aborted"\)/;
  if (p1Regex.test(content)) {
    const interceptorPrefix = buildModelListInterceptor(destinationUrl, tokenHeaderSnippet);
    content = content.replace(p1Regex, (match, paramName, defaultVal) => {
      return `transport:${paramName}=${interceptorPrefix}return ${defaultVal}(args);})}=t;if(u?.aborted)throw u.reason instanceof Error?u.reason:new Error("listAvailableModels aborted")`;
    });
    console.log('  ✅ Patch 1: Dynamic model catalog applied (/listAvailableModels + /v1/models + Native Fallback)');
    patchCount++;
  } else {
    console.warn('  ⚠️  Patch 1: Could not locate listAvailableModels transport pattern');
  }

  // ── Patch 2: cloudConfig Feature Flag (Conditional) ─────────────────────────
  const p2Target = 'n=vo("cloudConfig");';
  if (content.includes(p2Target)) {
    content = content.replace(p2Target, 'n=Boolean(process.env.CLOUD_CONFIG_ENDPOINT)||vo("cloudConfig");');
    console.log('  ✅ Patch 2: cloudConfig set to conditional (Eliminates unwanted fetch_cloud_config)');
    patchCount++;
  } else if (content.includes('/*[WHGW_CC_FLAG]*/true')) {
    content = content.replace('n=/*[WHGW_CC_FLAG]*/true;', 'n=Boolean(process.env.CLOUD_CONFIG_ENDPOINT)||vo("cloudConfig");');
    console.log('  ✅ Patch 2: Removed forced cloudConfig flag');
    patchCount++;
  }

  // ── Patch 3A: KRS Client Dynamic Endpoint (Bte & RKo) ───────────────────────
  const p3aRegex = /\{region:([a-zA-Z0-9_$]+),endpoint:([a-zA-Z0-9_$]+)\}=([a-zA-Z0-9_$]+)\(\{identity:([a-zA-Z0-9_$]+),regionOverride:([a-zA-Z0-9_$]+)\.region,endpointOverride:\5\.endpoint\}\)/;
  if (p3aRegex.test(content)) {
    content = content.replace(p3aRegex, (match, regionVar, endpointVar, fnName, identityVar, envVar) => {
      return `{region:${regionVar},endpoint:${endpointVar}}=globalThis.__kiroProxyActive?{region:"us-east-1",endpoint:/*[WHGW_FORCE_8084]*/"${destinationUrl}"}:${fnName}({identity:${identityVar},regionOverride:${envVar}.region,endpointOverride:${envVar}.endpoint})`;
    });
    console.log('  ✅ Patch 3A: Dynamic converse endpoint applied');
    patchCount++;
  } else {
    console.warn('  ⚠️  Patch 3A: Could not locate getKrsClient Zee/Bte pattern');
  }

  const rkoPattern = 'function RKo(t,e){let r=Vjl(e)??"us-east-1";return{region:r,endpoint:e.endpointOverride||`https://${t}.${r}.kiro.dev`}}';
  if (content.includes(rkoPattern)) {
    content = content.replace(
      rkoPattern,
      `function RKo(t,e){if(globalThis.__kiroProxyActive){return{region:"us-east-1",endpoint:/*[WHGW_FORCE_8084]*/"${destinationUrl}"};}let r=Vjl(e)??"us-east-1";return{region:r,endpoint:e.endpointOverride||\`https://\${t}.\${r}.kiro.dev\`}}`
    );
    console.log('  ✅ Patch 3A+: Central RKo runtime endpoint resolver patched');
  }

  // ── Patch 3B: Runtime Prompt URL / getTarget() Interceptor ──────────────────
  const p3bRegex = /(\w+)=\w+!==void 0&&oos\.has\(\w+\)\?(globalThis\.__kiroProxyActive\?\/\*\[WHGW_RUNTIME_OVERRIDE\]\*\/"[^"]+":this\.routing\.endpointOverride\|\|`https:\/\/runtime\.\$\{(\w+)\}\.kiro\.dev`):void 0/;
  const p3bRegexFresh = /(\w+)=(\w+)!==void 0&&oos\.has\((\w+)\)\?\(?(this\.routing\.endpointOverride\|\|`https:\/\/runtime\.\$\{(\w+)\}\.kiro\.dev`)\)?:void 0/;

  if (p3bRegex.test(content)) {
    content = content.replace(p3bRegex, (match, sVar, _inner, nVar) => {
      return `${sVar}=globalThis.__kiroProxyActive?/*[WHGW_RUNTIME_OVERRIDE]*/"${destinationUrl}":(${nVar}!==void 0&&oos.has(${nVar})?(this.routing.endpointOverride||\`https://runtime.\${${nVar}}.kiro.dev\`):void 0)`;
    });
    console.log('  ✅ Patch 3B: Upgraded getTarget() region-bypass routing');
    patchCount++;
  } else if (p3bRegexFresh.test(content)) {
    content = content.replace(p3bRegexFresh, (match, sVar, n1, n2, endpointExpr) => {
      return `${sVar}=globalThis.__kiroProxyActive?/*[WHGW_RUNTIME_OVERRIDE]*/"${destinationUrl}":(${n1}!==void 0&&oos.has(${n2})?(${endpointExpr}):void 0)`;
    });
    console.log('  ✅ Patch 3B: Applied getTarget() region-bypass routing (/generateAssistantResponse)');
    patchCount++;
  } else {
    console.warn('  ⚠️  Patch 3B: Could not locate runtime URL construction pattern');
  }

  if (patchCount > 0 && !isDryRun) {
    fs.writeFileSync(extFile, content, 'utf8');
  }

  console.log('\n======================================================================');
  console.log(`[Done]: Applied ${patchCount} surgical patches to Kiro IDE extension.js`);
  console.log(`        Active Gateway URL: ${destinationUrl}`);
  if (isDryRun) {
    console.log('        (Dry run only — no files were modified on disk)');
  } else {
    console.log('        Restart Kiro IDE (or Reload Window) to activate changes.');
  }
  console.log('======================================================================\n');
}

run().catch((e) => {
  console.error('[Fatal Error]:', e);
  process.exit(1);
});
