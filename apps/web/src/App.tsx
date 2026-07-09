// ============================================================
// App.tsx — Main application with theme toggle, role switcher,
// health score dashboard, and recommendation feed.
// Premium dark/light UI with glassmorphism.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Sun, Moon, Activity, Users, Radio,
  ChevronDown, RefreshCw, Zap, AlertTriangle
} from 'lucide-react';
import { ROLES, DOMAINS } from '@aegis/shared';
import type { Role, Domain } from '@aegis/shared';
import { getRecommendations, getHealthScore, triggerCycle, createSSEConnection, ingestEvent } from './api/client.js';
import { HealthScoreDashboard } from './components/HealthScoreDashboard.js';
import { RecommendationCard } from './components/RecommendationCard.js';

const ROLE_LABELS: Record<string, string> = {
  fan: '🎫 Fan',
  volunteer: '🙋 Volunteer',
  security: '🛡️ Security',
  medical: '🏥 Medical',
  organizer: '📋 Organizer',
  venue_operations: '🏟️ Venue Ops',
  accessibility_coordinator: '♿ Accessibility',
  transportation_coordinator: '🚌 Transport',
};

const DOMAIN_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  crowd: 'Crowd',
  transport: 'Transport',
  accessibility: 'Accessibility',
  sustainability: 'Sustainability',
  multilingual: 'Multilingual',
  operations: 'Operations',
  medical: 'Medical',
  security: 'Security',
};

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aegis-theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  const [activeRole, setActiveRole] = useState<Role>('organizer');
  const [domainFilter, setDomainFilter] = useState<Domain | 'all'>('all');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const queryClient = useQueryClient();

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('aegis-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // SSE connection
  useEffect(() => {
    const disconnect = createSSEConnection((type, _data) => {
      if (type === 'recommendation.created' || type === 'recommendation.updated') {
        queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      }
      if (type === 'health.updated') {
        queryClient.invalidateQueries({ queryKey: ['healthScore'] });
      }
    });
    return disconnect;
  }, [queryClient]);

  // Queries
  const { data: recommendations = [], isLoading: recsLoading } = useQuery({
    queryKey: ['recommendations', activeRole, domainFilter],
    queryFn: () => getRecommendations({
      role: activeRole,
      domain: domainFilter === 'all' ? undefined : domainFilter,
      status: 'proposed',
    }),
  });

  const { data: healthScore } = useQuery({
    queryKey: ['healthScore'],
    queryFn: getHealthScore,
  });

  const handleTriggerCycle = useCallback(async () => {
    await triggerCycle();
    queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    queryClient.invalidateQueries({ queryKey: ['healthScore'] });
  }, [queryClient]);

  const handleSimulateIncident = useCallback(async () => {
    // Generate a high severity mock incident to force a recommendation
    const domains = ['crowd', 'security', 'medical', 'transport'];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)] as Domain;
    
    await ingestEvent({
      domain: randomDomain,
      type: 'incident',
      severity: 'high',
      zone: 'gate-a',
      payload: { 
        simulated: true, 
        timestamp: new Date().toISOString(),
        summary: `Simulated high severity ${randomDomain} incident detected at Gate A.`,
        source: 'simulator'
      }
    });
    
    // Immediately trigger the cycle so the user sees the result
    await handleTriggerCycle();
  }, [handleTriggerCycle]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-aegis-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-500">
      {/* ── Top Navigation Bar ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aegis-500 to-aegis-700 flex items-center justify-center shadow-lg shadow-aegis-500/25">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900 animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-aegis-600 to-aegis-800 dark:from-aegis-400 dark:to-aegis-600 bg-clip-text text-transparent">
                  AEGIS
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-widest uppercase">
                  Stadium Intelligence
                </p>
              </div>
            </div>

            {/* Center — Live Status */}
            <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                LIVE — MetLife Stadium
              </span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
              {/* Simulate Incident Button */}
              <button
                onClick={handleSimulateIncident}
                className="btn-danger flex items-center gap-2 text-sm ml-2"
                aria-label="Simulate a high-severity incident"
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Simulate Incident</span>
              </button>

              {/* Trigger Cycle Button */}
              <button
                onClick={handleTriggerCycle}
                className="btn-ghost flex items-center gap-2 text-sm"
                aria-label="Run reasoning cycle manually"
              >
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Run Cycle</span>
              </button>

              {/* Role Switcher */}
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label={`Operating as ${activeRole}`}
                  id="role-switcher"
                >
                  <Users className="w-4 h-4 text-aegis-500" />
                  <span className="text-sm font-medium">{ROLE_LABELS[activeRole]}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {roleDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl glass-card p-2 animate-slide-down z-50">
                    {ROLES.map((role) => (
                      <button
                        key={role}
                        onClick={() => { setActiveRole(role); setRoleDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeRole === role
                            ? 'bg-aegis-500/10 text-aegis-600 dark:text-aegis-400 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 hover:scale-105"
                aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
                id="theme-toggle"
              >
                {darkMode ? (
                  <Sun className="w-4.5 h-4.5 text-amber-400" />
                ) : (
                  <Moon className="w-4.5 h-4.5 text-slate-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Health Score Dashboard */}
        {healthScore && <HealthScoreDashboard healthScore={healthScore} />}

        {/* Domain Filter Bar */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
          <button
            onClick={() => setDomainFilter('all')}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              domainFilter === 'all'
                ? 'bg-aegis-500 text-white shadow-md shadow-aegis-500/25'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            All Domains
          </button>
          {DOMAINS.map((domain) => (
            <button
              key={domain}
              onClick={() => setDomainFilter(domain)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                domainFilter === domain
                  ? 'text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
              style={
                domainFilter === domain
                  ? { backgroundColor: `var(--tw-colors-domain-${domain}, #338dff)` }
                  : undefined
              }
            >
              {DOMAIN_LABELS[domain]}
            </button>
          ))}
        </div>

        {/* Recommendation Feed */}
        <div className="space-y-4" role="feed" aria-label="Recommendation feed">
          {recsLoading && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-aegis-500 animate-spin" />
              <span className="ml-3 text-slate-500 font-medium">Loading recommendations...</span>
            </div>
          )}

          {!recsLoading && recommendations.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400 mb-2">
                No Active Recommendations
              </h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 max-w-md mx-auto">
                The reasoning engine is monitoring the stadium. Recommendations will appear here when situations are detected.
              </p>
              <button onClick={handleTriggerCycle} className="btn-primary mt-6">
                <Zap className="w-4 h-4 inline mr-2" />
                Trigger Reasoning Cycle
              </button>
            </div>
          )}

          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              activeRole={activeRole}
            />
          ))}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/50 dark:border-slate-800 mt-12 py-6">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>AEGIS v1.0 — FIFA World Cup 2026</span>
          <span>Adaptive Event-Ground Intelligence System</span>
        </div>
      </footer>
    </div>
  );
}
