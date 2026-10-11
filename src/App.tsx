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
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Navbar } from './frontend/components/Navbar.js';
import { OverviewTab } from './frontend/components/OverviewTab.js';
import { ProvidersTab } from './frontend/components/ProvidersTab.js';
import { PatcherTab } from './frontend/components/PatcherTab.js';
import { CanvasBridgeTab } from './frontend/components/CanvasBridgeTab.js';
import { TesterTab } from './frontend/components/TesterTab.js';
import { BackupTab } from './frontend/components/BackupTab.js';
import { SecurityModal } from './frontend/components/SecurityModal.js';
import type { HealthData, GatewayConfig } from './frontend/types.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'patcher' | 'canvas' | 'tester' | 'backup'>('overview');
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
        const result = await res.json();
        if (result.config) {
          setConfig(result.config);
        }
        await loadSystemData();
        return true;
      } else if (res.status === 401) {
        setIsSecurityModalOpen(true);
        return false;
      }
      return false;
    } catch (err) {
      console.error('Error saving config:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview & Arch', icon: Activity },
    { id: 'providers', label: 'Priority Tiers & Failover', icon: Layers },
    { id: 'patcher', label: 'Kiro IDE Patcher', icon: Terminal },
    { id: 'canvas', label: 'Gemini Canvas Bridge', icon: Radio },
    { id: 'tester', label: 'Stream Playground', icon: Zap },
    { id: 'backup', label: 'Cloud Sync & Backup', icon: Cloud },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        health={health}
        adminToken={adminToken}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onRefresh={loadSystemData}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Auth Notice if 401 */}
        {authError && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold"
            >
              Enter Token
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
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
              onNavigateTab={(tab: string) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'providers' && (
            <ProvidersTab
              config={config}
              onSaveConfig={handleSaveConfig}
              isSaving={isSaving}
            />
          )}

          {activeTab === 'patcher' && (
            <PatcherTab health={health} config={config} />
          )}

          {activeTab === 'canvas' && (
            <CanvasBridgeTab health={health} />
          )}

          {activeTab === 'tester' && (
            <TesterTab config={config} adminToken={adminToken} />
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
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
        <p>
          KiroProxy Cloud Gateway • Drop-in zero-local-daemon alternative for Kiro IDE & AWS Bedrock
        </p>
      </footer>
    </div>
  );
}
