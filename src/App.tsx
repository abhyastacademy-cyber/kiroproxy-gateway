/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Layers,
  Terminal,
  Radio,
  Zap,
  Cloud,
  AlertCircle,
  Sparkles,
  Key,
} from 'lucide-react';
import { Navbar } from './frontend/components/Navbar.js';
import { OverviewTab } from './frontend/components/OverviewTab.js';
import { ModelsTab } from './frontend/components/ModelsTab.js';
import { ApiKeysTab } from './frontend/components/ApiKeysTab.js';
import { ProvidersTab } from './frontend/components/ProvidersTab.js';
import { PatcherTab } from './frontend/components/PatcherTab.js';
import { CanvasBridgeTab } from './frontend/components/CanvasBridgeTab.js';
import { TesterTab } from './frontend/components/TesterTab.js';
import { BackupTab } from './frontend/components/BackupTab.js';
import { SecurityModal } from './frontend/components/SecurityModal.js';
import type { HealthData, GatewayConfig } from './frontend/types.js';

type TabType = 'overview' | 'models' | 'tester' | 'keys' | 'providers' | 'canvas' | 'patcher' | 'backup';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedTestModel, setSelectedTestModel] = useState<string>('global-automode');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminToken, setAdminToken] = useState<string>(() => {
    return localStorage.getItem('kiro_admin_token') || '';
  });
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch Health & Config
  const loadSystemData = useCallback(async () => {
    setIsRefreshing(true);
    setAuthError(null);

    try {
      // 1. Health
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
      }

      // 2. Config
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      const configRes = await fetch('/api/config', { headers });
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      } else if (configRes.status === 401) {
        setAuthError('Admin token required to load and save gateway configuration.');
      }
    } catch (err: any) {
      console.warn('Failed to load system data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [adminToken]);

  useEffect(() => {
    loadSystemData();
    const interval = setInterval(loadSystemData, 6000);
    return () => clearInterval(interval);
  }, [loadSystemData]);

  // Handle Token Save
  const handleSaveToken = (token: string) => {
    setAdminToken(token);
    if (token) {
      localStorage.setItem('kiro_admin_token', token);
    } else {
      localStorage.removeItem('kiro_admin_token');
    }
    setTimeout(loadSystemData, 200);
  };

  // Handle Config Save
  const handleSaveConfig = async (updated: Partial<GatewayConfig>): Promise<boolean> => {
    setIsSaving(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(updated),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
        return true;
      } else if (res.status === 401) {
        setAuthError('Unauthorized: Token required to modify settings.');
        setIsSecurityModalOpen(true);
        return false;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to save config:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle AutoMode toggle
  const handleToggleAutoMode = async () => {
    const currentState = config?.globalAutoMode ?? true;
    const nextState = !currentState;
    await handleSaveConfig({ globalAutoMode: nextState });
  };

  const navItems = [
    { id: 'overview', label: 'Overview & Health', icon: Activity },
    { id: 'models', label: 'Free Models', icon: Sparkles },
    { id: 'tester', label: 'Quick Test', icon: Zap },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'providers', label: 'Custom Providers', icon: Layers },
    { id: 'canvas', label: 'Canvas Bridge', icon: Radio },
    { id: 'patcher', label: 'Kiro IDE Patcher', icon: Terminal },
    { id: 'backup', label: 'Backup & JSON', icon: Cloud },
  ] as const;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col font-sans selection:bg-[#27272a] selection:text-[#fafafa]">
      {/* Top Navbar */}
      <Navbar
        health={health}
        config={config}
        adminToken={adminToken}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onRefresh={loadSystemData}
        onToggleAutoMode={handleToggleAutoMode}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Auth Notice if 401 */}
        {authError && (
          <div className="p-4 rounded-xl bg-[#141417] border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="px-3 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-amber-300 font-semibold border border-[#3f3f46] transition-colors"
            >
              Enter Token
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0f0f12] border border-[#27272a] overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#fafafa] text-[#09090b] shadow-sm'
                    : 'text-zinc-400 hover:text-[#fafafa] hover:bg-[#141417]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#09090b]' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Views */}
        <div>
          {activeTab === 'overview' && (
            <OverviewTab
              health={health}
              config={config}
              onNavigateTab={(tab: string) => setActiveTab(tab as TabType)}
              onSaveConfig={handleSaveConfig}
              onRefreshHealth={loadSystemData}
            />
          )}

          {activeTab === 'models' && (
            <ModelsTab
              config={config}
              onNavigateTab={(tab: string) => setActiveTab(tab as TabType)}
              onTestModel={(modelId: string) => {
                setSelectedTestModel(modelId);
                setActiveTab('tester');
              }}
            />
          )}

          {activeTab === 'tester' && (
            <TesterTab
              config={config}
              adminToken={adminToken}
              initialModel={selectedTestModel}
            />
          )}

          {activeTab === 'keys' && (
            <ApiKeysTab
              config={config}
              onSaveConfig={handleSaveConfig}
            />
          )}

          {activeTab === 'providers' && (
            <ProvidersTab
              config={config}
              onSaveConfig={handleSaveConfig}
              isSaving={isSaving}
            />
          )}

          {activeTab === 'canvas' && (
            <CanvasBridgeTab health={health} />
          )}

          {activeTab === 'patcher' && (
            <PatcherTab health={health} config={config} />
          )}

          {activeTab === 'backup' && (
            <BackupTab
              config={config}
              adminToken={adminToken}
              onSaveConfig={handleSaveConfig}
            />
          )}
        </div>
      </main>

      {/* Security Auth Modal */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        adminToken={adminToken}
        onSaveToken={handleSaveToken}
      />

      {/* Footer */}
      <footer className="border-t border-[#27272a] bg-[#09090b] py-6 mt-12 text-center text-xs text-zinc-500">
        <p>
          KiroProxy Cloud Gateway • Drop-in zero-local-daemon alternative for Kiro IDE &amp; AWS Bedrock
        </p>
      </footer>
    </div>
  );
}
