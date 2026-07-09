// ============================================================
// RecommendationCard — Rich card with R/E/C/I, alternatives,
// prediction, health score impact, and approval controls.
// ============================================================

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Brain, Target, ArrowUpRight, ArrowDownRight, Lightbulb,
  TrendingUp, Clock, ShieldCheck
} from 'lucide-react';
import type { Recommendation, Role } from '@aegis/shared';
import { makeDecision } from '../api/client.js';



const DOMAIN_COLORS: Record<string, string> = {
  navigation: '#6366f1', crowd: '#f59e0b', transport: '#3b82f6',
  accessibility: '#8b5cf6', sustainability: '#10b981', multilingual: '#ec4899',
  operations: '#6b7280', medical: '#ef4444', security: '#f97316',
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#10b981';
  if (confidence >= 0.6) return '#fbbf24';
  return '#f97316';
}

interface Props {
  recommendation: Recommendation;
  activeRole: Role;
}

export function RecommendationCard({ recommendation: rec, activeRole }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const queryClient = useQueryClient();

  const canApprove = activeRole === 'organizer' || rec.targetRoles.includes(activeRole);
  const domainColor = DOMAIN_COLORS[rec.domain] ?? '#6b7280';

  const handleDecision = useCallback(async (outcome: 'approved' | 'rejected') => {
    setApproving(true);
    try {
      await makeDecision(rec.id, outcome, activeRole);
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['healthScore'] });
    } catch (err) {
      console.error('Decision failed:', err);
    } finally {
      setApproving(false);
    }
  }, [rec.id, activeRole, queryClient]);

  const timeSince = getTimeSince(rec.createdAt);

  return (
    <article
      className="glass-card overflow-hidden animate-slide-up"
      role="article"
      aria-labelledby={`rec-title-${rec.id}`}
    >
      {/* Top accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${domainColor}, ${domainColor}88)` }} />

      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {/* Domain Badge */}
              <span
                className="domain-badge text-white"
                style={{ backgroundColor: domainColor }}
              >
                {rec.domain}
              </span>
              {/* Source Badge */}
              <span className={`domain-badge ${rec.source === 'genai' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {rec.source === 'genai' ? '🤖 GenAI' : '⚙️ Rules'}
              </span>
              {/* Time */}
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {timeSince}
              </span>
            </div>
            <h3 id={`rec-title-${rec.id}`} className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {rec.title}
            </h3>
          </div>

          {/* Priority & Confidence */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Priority</span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200">
                {(rec.priority * 100).toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Explainability Panel (R/E/C/I) ──────────────────── */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Reason */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <dt className="flex items-center gap-1.5 text-xs font-bold text-aegis-600 dark:text-aegis-400 uppercase tracking-wider mb-1">
              <Brain className="w-3.5 h-3.5" /> Reason
            </dt>
            <dd className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{rec.reason}</dd>
          </div>

          {/* Evidence */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <dt className="flex items-center gap-1.5 text-xs font-bold text-aegis-600 dark:text-aegis-400 uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Evidence
            </dt>
            <dd className="text-sm text-slate-700 dark:text-slate-300">
              {rec.evidence.map((e, i) => (
                <span key={i} className="block text-xs py-0.5">
                  • {e.summary}
                </span>
              ))}
            </dd>
          </div>

          {/* Confidence */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <dt className="flex items-center gap-1.5 text-xs font-bold text-aegis-600 dark:text-aegis-400 uppercase tracking-wider mb-1">
              <Target className="w-3.5 h-3.5" /> Confidence
            </dt>
            <dd>
              <div className="flex items-center gap-3">
                <div className="confidence-bar flex-1" role="progressbar" aria-valuenow={Math.round(rec.confidence * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="confidence-fill"
                    style={{ width: `${rec.confidence * 100}%`, backgroundColor: getConfidenceColor(rec.confidence) }}
                  />
                </div>
                <span className="text-sm font-bold" style={{ color: getConfidenceColor(rec.confidence) }}>
                  {(rec.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </dd>
          </div>

          {/* Expected Impact */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <dt className="flex items-center gap-1.5 text-xs font-bold text-aegis-600 dark:text-aegis-400 uppercase tracking-wider mb-1">
              <TrendingUp className="w-3.5 h-3.5" /> Expected Impact
            </dt>
            <dd className="text-sm text-slate-700 dark:text-slate-300">
              <span>{rec.expectedImpact.description}</span>
              {rec.expectedImpact.estimatedMagnitude && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {rec.expectedImpact.direction === 'decrease' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  {rec.expectedImpact.estimatedMagnitude}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {/* Health Score Impact Bar */}
        {rec.prediction?.healthScoreImpact && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-aegis-50 to-emerald-50 dark:from-aegis-900/20 dark:to-emerald-900/20 border border-aegis-200/50 dark:border-aegis-700/30 mb-4">
            <Lightbulb className="w-5 h-5 text-aegis-500 shrink-0" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Approving is expected to change Health Score:{' '}
              <span className="font-bold">{rec.prediction.healthScoreImpact.current}</span>
              {' → '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {rec.prediction.healthScoreImpact.projected}
              </span>
              <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-bold">
                (+{rec.prediction.healthScoreImpact.delta})
              </span>
            </p>
          </div>
        )}

        {/* Expandable Section */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-aegis-600 dark:text-aegis-400 hover:text-aegis-700 dark:hover:text-aegis-300 transition-colors mb-4"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Hide Details' : `Show Alternatives (${rec.alternatives?.length ?? 0}) & Prediction`}
        </button>

        {expanded && (
          <div className="space-y-4 animate-slide-down mb-4">
            {/* Prediction */}
            {rec.prediction?.noActionOutcome && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30">
                <h4 className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  If No Action Taken
                </h4>
                <p className="text-sm text-red-600 dark:text-red-300">{rec.prediction.noActionOutcome}</p>
              </div>
            )}

            {/* Alternatives */}
            {rec.alternatives && rec.alternatives.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Alternatives Considered</h4>
                {rec.alternatives.map((alt, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-all ${
                      alt.isRecommended
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {alt.isRecommended && <span className="text-emerald-600 mr-1">★</span>}
                        {alt.option}
                      </span>
                      <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold" style={{ color: getConfidenceColor(alt.confidence) }}>
                        {(alt.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Pros: </span>
                        <span className="text-slate-600 dark:text-slate-400">{alt.pros}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-red-500">Cons: </span>
                        <span className="text-slate-600 dark:text-slate-400">{alt.cons}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Approval Controls ────────────────────────────────── */}
        {rec.status === 'proposed' && (
          <div className="flex items-center gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
            {canApprove ? (
              <>
                <button
                  onClick={() => handleDecision('approved')}
                  disabled={approving}
                  className="btn-success flex items-center gap-2"
                  aria-label={`Approve recommendation: ${rec.title}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {approving ? 'Processing...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleDecision('rejected')}
                  disabled={approving}
                  className="btn-danger flex items-center gap-2"
                  aria-label={`Reject recommendation: ${rec.title}`}
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Only {rec.targetRoles.join(', ')} or organizer can approve this recommendation.
              </p>
            )}

            <span className="ml-auto text-xs text-slate-400">
              For: {rec.targetRoles.join(', ')}
            </span>
          </div>
        )}

        {rec.status !== 'proposed' && (
          <div className="flex items-center gap-2 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              rec.status === 'approved' || rec.status === 'executed'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : rec.status === 'rejected'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              {rec.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
              {rec.status === 'rejected' && <XCircle className="w-3 h-3" />}
              {rec.status === 'executed' && <CheckCircle2 className="w-3 h-3" />}
              {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function getTimeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
