// ============================================================
// HealthScoreDashboard — Overall + per-domain health scores
// with animated rings, trend indicators, and domain breakdown.
// ============================================================

import { TrendingUp, TrendingDown, Minus, Heart } from 'lucide-react';
import type { HealthScore } from '@aegis/shared';

const DOMAIN_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  crowd: { label: 'Crowd', color: '#f59e0b', icon: '👥' },
  medical: { label: 'Medical', color: '#ef4444', icon: '🏥' },
  security: { label: 'Security', color: '#f97316', icon: '🛡️' },
  transport: { label: 'Transport', color: '#3b82f6', icon: '🚌' },
  accessibility: { label: 'Accessibility', color: '#8b5cf6', icon: '♿' },
  sustainability: { label: 'Sustainability', color: '#10b981', icon: '🌱' },
  navigation: { label: 'Navigation', color: '#6366f1', icon: '🧭' },
  operations: { label: 'Operations', color: '#6b7280', icon: '⚙️' },
  multilingual: { label: 'Multilingual', color: '#ec4899', icon: '🌐' },
};

function getHealthColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#34d399';
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function getHealthLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

interface HealthRingProps {
  score: number;
  size: number;
  strokeWidth: number;
  label?: string;
}

function HealthRing({ score, size, strokeWidth, label }: HealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getHealthColor(score);

  return (
    <div className="health-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700"
        />
        {/* Score ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in">
        <span
          className={`font-bold tracking-tight ${size > 100 ? 'text-4xl' : 'text-xl'}`}
          style={{ color }}
        >
          {score.toFixed(0)}
        </span>
        {label && (
          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  healthScore: HealthScore;
}

export function HealthScoreDashboard({ healthScore }: Props) {
  const TrendIcon = healthScore.trend === 'improving'
    ? TrendingUp
    : healthScore.trend === 'declining'
      ? TrendingDown
      : Minus;

  const trendColor = healthScore.trend === 'improving'
    ? 'text-emerald-500'
    : healthScore.trend === 'declining'
      ? 'text-red-500'
      : 'text-slate-400';

  const trendLabel = healthScore.trend === 'improving'
    ? 'Improving'
    : healthScore.trend === 'declining'
      ? 'Declining'
      : 'Stable';

  return (
    <div className="glass-card p-6 mb-6 animate-fade-in" role="status" aria-label="Operational Health Score">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
        {/* Overall Score */}
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-aegis-500/10 dark:bg-aegis-400/10 rounded-full blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <HealthRing score={healthScore.overall} size={140} strokeWidth={8} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Stadium Health
              </h2>
              {healthScore.trend === 'improving' && <TrendingUp className="w-4 h-4 text-emerald-500 animate-pulse" />}
              {healthScore.trend === 'declining' && <TrendingDown className="w-4 h-4 text-red-500 animate-pulse" />}
              {healthScore.trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
            </div>
            <p className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              {getHealthLabel(healthScore.overall)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px h-20 bg-slate-200 dark:bg-slate-700" />

        {/* Domain Breakdown */}
        <div className="flex-1 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 w-full">
          {Object.entries(healthScore.domains).map(([domain, score]) => {
            const config = DOMAIN_CONFIG[domain];
            if (!config) return null;
            const numScore = typeof score === 'number' ? score : 0;
            return (
              <div
                key={domain}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-default"
                aria-label={`${config.label} health: ${Math.round(numScore)} out of 100`}
              >
                <span className="text-lg">{config.icon}</span>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${numScore}%`,
                      backgroundColor: getHealthColor(numScore),
                    }}
                  />
                </div>
                <span className="text-xs font-bold" style={{ color: getHealthColor(numScore) }}>
                  {Math.round(numScore)}
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate w-full text-center">
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
