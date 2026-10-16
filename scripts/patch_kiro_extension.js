#!/usr/bin/env node

/**
 * Kiro IDE Extension Patcher (v5.2-cloud-resilient)
 * Automatically locates the installed Kiro IDE extension, creates a backup,
 * and applies the full suite of runtime proxy and telemetry isolation patches:
 * - Patch 1: Endpoints redirection (generateAssistantResponse & listAvailableModels)
 * - Patch 3A+: Dynamic service rerouting restricted strictly to t === "runtime" (RKo)
 * - Patch 3B: Telemetry bypass in resolveTarget() returning void 0 (activity.publish.disabled_for_region)
 * - Patch 6: Synthetic 200 OK empty stream interception for InvokeMCPStreamCommand (RIt)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const targetGatewayUrl = process.argv[2] || process.env.KIRO_GATEWAY_URL || 'http://localhost:3000';
const adminToken = process.argv[3] || process.env.PROXY_ADMIN_TOKEN || '';

const cleanGatewayUrl = targetGatewayUrl.replace(/\/+$/, '');
const bedrockEndpoint = adminToken
  ? `${cleanGatewayUrl}/k/${adminToken}/generateAssistantResponse`
  : `${cleanGatewayUrl}/generateAssistantResponse`;
const modelsEndpoint = adminToken
  ? `${cleanGatewayUrl}/k/${adminToken}/listAvailableModels`
  : `${cleanGatewayUrl}/listAvailableModels`;

console.log('========================================================');
console.log('⚡ Kiro IDE Cloud Gateway Patcher (v5.2 - Full Resilience)');
console.log(`🌐 Target Gateway URL: ${cleanGatewayUrl}`);
if (adminToken) {
  console.log(`🔒 Admin Auth Token:  [CONFIGURED]`);
}
console.log(`📡 Bedrock Stream:    ${bedrockEndpoint}`);
console.log(`📋 Model Discovery:   ${modelsEndpoint}`);
console.log('========================================================\n');

const homeDir = os.homedir();
const possibleExtensionsDirs = [
  path.join(homeDir, '.kiro', 'extensions'),
  path.join(homeDir, '.cursor', 'extensions'),
  path.join(homeDir, '.vscode', 'extensions'),
  path.join(homeDir, 'AppData', 'Roaming', 'Kiro', 'extensions'),
  path.join(homeDir, 'Library', 'Application Support', 'Kiro', 'extensions'),
];

let candidatesFound = [];

for (const extDir of possibleExtensionsDirs) {
  if (!fs.existsSync(extDir)) continue;
  try {
    const entries = fs.readdirSync(extDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && (entry.name.toLowerCase().includes('kiro') || entry.name.toLowerCase().includes('bedrock') || entry.name.toLowerCase().includes('amazon'))) {
        const fullPath = path.join(extDir, entry.name);
        const jsFiles = ['extension.js', path.join('dist', 'extension.js'), path.join('out', 'extension.js')];
        for (const relativeJs of jsFiles) {
          const candidateJs = path.join(fullPath, relativeJs);
          if (fs.existsSync(candidateJs)) {
            candidatesFound.push(candidateJs);
          }
        }
      }
    }
  } catch (err) {
    // Ignore unreadable dirs
  }
}

if (candidatesFound.length === 0) {
  if (process.argv[4] && fs.existsSync(process.argv[4])) {
    candidatesFound.push(process.argv[4]);
  } else {
    console.log('ℹ️  No extension found in default directories.');
    console.log('👉 If your extension is installed in a custom location, run:');
    console.log(`   node patch_kiro_extension.js "${cleanGatewayUrl}" "${adminToken}" "/path/to/extension.js"\n`);
    process.exit(0);
  }
}

let patchedCount = 0;

for (const targetFile of candidatesFound) {
  try {
    console.log(`🔍 Inspecting candidate: ${targetFile}`);
    const content = fs.readFileSync(targetFile, 'utf8');

    // Create backup
    const backupFile = `${targetFile}.bak`;
    if (!fs.existsSync(backupFile)) {
      fs.writeFileSync(backupFile, content, 'utf8');
      console.log(`   📁 Created backup: ${backupFile}`);
    }

    let modified = content;
    let patchesApplied = 0;

    // --- Patch 1: Direct endpoint URL rewrites ---
    if (modified.includes('generateAssistantResponse')) {
      modified = modified.replace(
        /https?:\/\/[a-zA-Z0-9.\-_:]+\/generateAssistantResponse/g,
        bedrockEndpoint
      );
      console.log(`   ✅ [Patch 1A] Bedrock endpoint redirected -> ${bedrockEndpoint}`);
      patchesApplied++;
    }

    if (modified.includes('listAvailableModels')) {
      modified = modified.replace(
        /https?:\/\/[a-zA-Z0-9.\-_:]+\/listAvailableModels/g,
        modelsEndpoint
      );
      console.log(`   ✅ [Patch 1B] Model discovery redirected -> ${modelsEndpoint}`);
      patchesApplied++;
    }

    // --- Patch 3B: Disable activity.publish telemetry uploader in resolveTarget() ---
    // In unpatched Kiro, resolveTarget() sends background telemetry to POST /.
    // Returning void 0 causes Kiro to log activity.publish.disabled_for_region and send 0 POST / calls.
    if (modified.includes('resolveTarget') && !modified.includes('/* KIRO_PATCH_3B */')) {
      const resolveTargetRegex = /(function\s+resolveTarget\s*\([^)]*\)\s*\{|resolveTarget\s*:\s*function\s*\([^)]*\)\s*\{|resolveTarget\s*\([^)]*\)\s*\{)/;
      if (resolveTargetRegex.test(modified)) {
        modified = modified.replace(
          resolveTargetRegex,
          `$1 /* KIRO_PATCH_3B */ return void 0; `
        );
        console.log(`   ✅ [Patch 3B] Telemetry uploader disabled in resolveTarget() -> returns void 0`);
        patchesApplied++;
      }
    }

    // --- Patch 3A+: Restrict RKo dynamic rerouting strictly to t === "runtime" ---
    // Prevents redirection of non-inference services (management, telemetry, auth) to gateway.
    if (modified.includes('RKo') && !modified.includes('/* KIRO_PATCH_3AP */')) {
      const rkoRegex = /function\s+RKo\s*\(([^)]+)\)\s*\{/g;
      if (rkoRegex.test(modified)) {
        modified = modified.replace(
          rkoRegex,
          `function RKo($1) { /* KIRO_PATCH_3AP */ if (arguments[0] !== "runtime" && arguments[1] !== "runtime") return void 0; `
        );
        console.log(`   ✅ [Patch 3A+] Dynamic service resolver (RKo) isolated strictly to runtime service`);
        patchesApplied++;
      }
    }

    // --- Patch 6: Synthetic 200 OK empty stream for InvokeMCPStreamCommand (RIt) ---
    if (modified.includes('InvokeMCPStreamCommand') && !modified.includes('/* KIRO_PATCH_6 */')) {
      const mcpRegex = /async\s+InvokeMCPStreamCommand\s*\([^)]*\)\s*\{/g;
      if (mcpRegex.test(modified)) {
        modified = modified.replace(
          mcpRegex,
          `async InvokeMCPStreamCommand() { /* KIRO_PATCH_6 */ return { stream: (async function*() {})(), $metadata: { httpStatusCode: 200 } }; `
        );
        console.log(`   ✅ [Patch 6] InvokeMCPStreamCommand synthetic 200 OK stream interceptor installed`);
        patchesApplied++;
      }
    }

    if (patchesApplied > 0) {
      fs.writeFileSync(targetFile, modified, 'utf8');
      console.log(`   ✨ Successfully applied ${patchesApplied} patch(es) to ${targetFile}\n`);
      patchedCount++;
    } else {
      console.log(`   ℹ️  No new patches needed for ${targetFile}\n`);
    }
  } catch (err) {
    console.error(`   ❌ Failed patching ${targetFile}:`, err.message);
  }
}

console.log('========================================================');
console.log(`🎉 Patching complete! (${patchedCount} file(s) updated)`);
console.log('👉 Please restart Kiro IDE to activate the connection.');
console.log('========================================================');
