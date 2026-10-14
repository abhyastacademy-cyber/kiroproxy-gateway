#!/usr/bin/env node

/**
 * Kiro IDE Extension Patcher (v5.1-cloud)
 * Automatically locates the installed Kiro IDE extension, creates a backup,
 * and patches the Bedrock EventStream and model discovery URLs to point to KiroProxy Cloud Gateway.
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
console.log('⚡ Kiro IDE Cloud Gateway Patcher (v5.1)');
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
  console.log('ℹ️  No extension found in default directories.');
  console.log('👉 If your extension is installed in a custom location, run:');
  console.log(`   node patch_kiro_extension.js "${cleanGatewayUrl}" "${adminToken}" "/path/to/extension.js"\n`);
  
  if (process.argv[4] && fs.existsSync(process.argv[4])) {
    candidatesFound.push(process.argv[4]);
  } else {
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

    // Patch endpoints
    if (modified.includes('generateAssistantResponse')) {
      console.log(`   ✅ Patching Bedrock endpoint -> ${bedrockEndpoint}`);
      modified = modified.replace(
        /https?:\/\/[a-zA-Z0-9.\-_:]+\/generateAssistantResponse/g,
        bedrockEndpoint
      );
      patchedCount++;
    }

    if (modified.includes('listAvailableModels')) {
      console.log(`   ✅ Patching Models discovery -> ${modelsEndpoint}`);
      modified = modified.replace(
        /https?:\/\/[a-zA-Z0-9.\-_:]+\/listAvailableModels/g,
        modelsEndpoint
      );
    }

    fs.writeFileSync(targetFile, modified, 'utf8');
    console.log(`   ✨ Successfully patched ${targetFile}\n`);
  } catch (err) {
    console.error(`   ❌ Failed patching ${targetFile}:`, err.message);
  }
}

console.log('========================================================');
console.log(`🎉 Patching complete! (${patchedCount} file(s) updated)`);
console.log('👉 Please restart Kiro IDE to activate the connection.');
console.log('========================================================');
