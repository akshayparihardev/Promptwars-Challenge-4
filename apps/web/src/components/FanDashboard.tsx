import React, { useState, useEffect } from 'react';
import { AssistantChat } from './AssistantChat.js';
import type { Role } from '@aegis/shared';
import { t } from '../i18n/index.js';
import {
  MapPin, Utensils, Stethoscope, DoorOpen, Car, Megaphone,
  Users, Wifi, Calendar, AlertTriangle, Eye, Accessibility
} from 'lucide-react';

interface Props {
  language: string;
  activeRole: Role;
  accessibilityNeeds: string[];
  setAccessibilityNeeds: React.Dispatch<React.SetStateAction<string[]>>;
}

interface QuickAction {
  icon: React.ReactNode;
  label: Record<string, string>;
  query: Record<string, string>;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: <MapPin className="w-6 h-6" />,
    label: { en: 'Find Restrooms', es: 'Encontrar Aseos', fr: 'Trouver Toilettes' },
    query: { en: 'Where are the nearest restrooms?', es: '¿Dónde están los aseos más cercanos?', fr: 'Où sont les toilettes les plus proches?' },
    color: '#6366f1',
  },
  {
    icon: <Utensils className="w-6 h-6" />,
    label: { en: 'Food & Drinks', es: 'Comida y Bebida', fr: 'Restauration' },
    query: { en: 'Where can I get food and drinks?', es: '¿Dónde puedo conseguir comida?', fr: 'Où manger et boire?' },
    color: '#f59e0b',
  },
  {
    icon: <Stethoscope className="w-6 h-6" />,
    label: { en: 'Medical Help', es: 'Ayuda Médica', fr: 'Aide Médicale' },
    query: { en: 'I need medical help', es: 'Necesito ayuda médica', fr: 'J\'ai besoin d\'aide médicale' },
    color: '#ef4444',
  },
  {
    icon: <DoorOpen className="w-6 h-6" />,
    label: { en: 'Find My Gate', es: 'Mi Puerta', fr: 'Ma Porte' },
    query: { en: 'How do I find my gate and seat?', es: '¿Cómo encuentro mi puerta y asiento?', fr: 'Comment trouver ma porte et mon siège?' },
    color: '#10b981',
  },
  {
    icon: <Car className="w-6 h-6" />,
    label: { en: 'Parking & Transit', es: 'Transporte', fr: 'Transport' },
    query: { en: 'Parking and transportation info', es: 'Información de estacionamiento y transporte', fr: 'Infos stationnement et transport' },
    color: '#3b82f6',
  },
  {
    icon: <Megaphone className="w-6 h-6" />,
    label: { en: 'Report Issue', es: 'Reportar', fr: 'Signaler' },
    query: { en: 'I want to report a safety concern', es: 'Quiero reportar un problema de seguridad', fr: 'Je veux signaler un problème de sécurité' },
    color: '#f97316',
  },
];

// SVG stadium map component
function StadiumMap({ crowdedZones }: { crowdedZones: string[] }) {
  const zones = [
    { id: 'gate-a', label: 'Gate A', x: 250, y: 30, w: 100, h: 30 },
    { id: 'gate-b', label: 'Gate B', x: 430, y: 150, w: 30, h: 80 },
    { id: 'gate-c', label: 'Gate C', x: 250, y: 330, w: 100, h: 30 },
    { id: 'gate-d', label: 'Gate D', x: 40, y: 150, w: 30, h: 80 },
    { id: 'section-100', label: '100s', x: 150, y: 100, w: 80, h: 60 },
    { id: 'section-120', label: 'Food Court', x: 270, y: 100, w: 80, h: 40 },
    { id: 'section-102', label: 'Restrooms', x: 150, y: 210, w: 80, h: 40 },
    { id: 'section-108', label: 'Medical', x: 270, y: 210, w: 80, h: 40 },
    { id: 'field', label: '⚽ PITCH', x: 170, y: 150, w: 160, h: 70 },
  ];

  return (
    <svg viewBox="0 0 500 400" className="w-full h-full" aria-label="Stadium map">
      {/* Stadium outline */}
      <ellipse cx="250" cy="195" rx="220" ry="180" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-300 dark:text-slate-600" />
      <ellipse cx="250" cy="195" rx="180" ry="145" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5,5" className="text-slate-200 dark:text-slate-700" />
      
      {zones.map(zone => {
        const isCrowded = crowdedZones.includes(zone.id);
        const isField = zone.id === 'field';
        
        return (
          <g key={zone.id}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx={isField ? 8 : 4}
              fill={isField ? '#16a34a' : isCrowded ? '#fbbf24' : '#e2e8f0'}
              className={isField ? '' : 'dark:fill-slate-700'}
              stroke={isCrowded ? '#f59e0b' : 'none'}
              strokeWidth={isCrowded ? 2 : 0}
              opacity={0.8}
            />
            <text
              x={zone.x + zone.w / 2}
              y={zone.y + zone.h / 2 + 4}
              textAnchor="middle"
              fontSize={isField ? 14 : 9}
              fontWeight={isField ? 'bold' : 'normal'}
              fill={isField ? 'white' : '#475569'}
              className={isField ? '' : 'dark:fill-slate-300'}
            >
              {zone.label}
            </text>
            {isCrowded && (
              <text x={zone.x + zone.w - 2} y={zone.y + 10} fontSize={10}>⚠️</text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <rect x={370} y={320} width={12} height={12} rx={2} fill="#e2e8f0" />
      <text x={387} y={330} fontSize={9} fill="#64748b">Normal</text>
      <rect x={370} y={340} width={12} height={12} rx={2} fill="#fbbf24" stroke="#f59e0b" strokeWidth={1} />
      <text x={387} y={350} fontSize={9} fill="#64748b">Busy</text>
    </svg>
  );
}

// Live info cards
function LiveInfoBar({ language }: { language: string }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const labels: Record<string, Record<string, string>> = {
    venue: { en: 'MetLife Stadium', es: 'MetLife Stadium', fr: 'MetLife Stadium' },
    event: { en: 'FIFA World Cup 2026', es: 'Copa Mundial FIFA 2026', fr: 'Coupe du Monde FIFA 2026' },
    gates: { en: 'Gates: OPEN', es: 'Puertas: ABIERTAS', fr: 'Portes: OUVERTES' },
    wifi: { en: 'WiFi: FIFA_WC2026', es: 'WiFi: FIFA_WC2026', fr: 'WiFi: FIFA_WC2026' },
  };

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-300 truncate">{labels['event']![language] ?? labels['event']!['en']}</span>
      </div>
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <DoorOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-medium text-blue-700 dark:text-blue-300 truncate">{labels['gates']![language] ?? labels['gates']!['en']}</span>
      </div>
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
        <Wifi className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
        <span className="font-medium text-purple-700 dark:text-purple-300 truncate">{labels['wifi']![language] ?? labels['wifi']!['en']}</span>
      </div>
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="font-medium text-slate-600 dark:text-slate-300 truncate">{time.toLocaleTimeString(language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

export function FanDashboard({ language, activeRole, accessibilityNeeds, setAccessibilityNeeds }: Props) {
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [crowdedZones] = useState<string[]>(['gate-a', 'section-120']); // simulated

  const toggleNeed = (need: string) => {
    setAccessibilityNeeds(prev => 
      prev.includes(need) ? prev.filter(n => n !== need) : [...prev, need]
    );
  };

  const handleQuickAction = (action: QuickAction) => {
    const query = action.query[language] ?? action.query['en'] ?? '';
    setPendingQuery(query);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 animate-fade-in">
      {/* Hero Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wide uppercase">LIVE — Match Day</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
          {t('fanWelcome', language)}
        </h1>
        <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
          {t('fanSubtitle', language)} • MetLife Stadium, NJ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Quick Actions + Map + Accessibility */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Quick Action Cards */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-1">
              {language === 'es' ? 'Acciones Rápidas' : language === 'fr' ? 'Actions Rapides' : 'Quick Actions'}
            </h2>
            <div className="grid grid-cols-3 gap-2.5">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(action)}
                  className="group glass-card p-3 flex flex-col items-center gap-2 text-center hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-current"
                  style={{ '--hover-color': action.color } as React.CSSProperties}
                  aria-label={action.label[language] || action.label['en']}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110"
                    style={{ backgroundColor: action.color }}
                  >
                    {action.icon}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                    {action.label[language] || action.label['en']}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Info */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {language === 'es' ? 'Info en Vivo' : language === 'fr' ? 'Infos en Direct' : 'Live Info'}
            </h3>
            <LiveInfoBar language={language} />
          </div>

          {/* Stadium Map */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {language === 'es' ? 'Mapa del Estadio' : language === 'fr' ? 'Plan du Stade' : 'Stadium Map'}
            </h3>
            <div className="aspect-[5/4] text-slate-500 dark:text-slate-400">
              <StadiumMap crowdedZones={crowdedZones} />
            </div>
          </div>

          {/* Accessibility Preferences */}
          <div className="glass-card p-4 border-l-4 border-purple-500">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
              <Accessibility className="w-3.5 h-3.5" />
              {t('accessibilityNeeds', language)}
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={accessibilityNeeds.includes('wheelchair')}
                  onChange={() => toggleNeed('wheelchair')}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium">♿ {t('needWheelchair', language)}</span>
              </label>
              <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={accessibilityNeeds.includes('visual')}
                  onChange={() => toggleNeed('visual')}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium"><Eye className="w-3.5 h-3.5 inline mr-1" />{t('needVisual', language)}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Chat */}
        <div className="lg:col-span-7">
          <div className="h-[700px] lg:h-[calc(100vh-180px)] lg:sticky lg:top-[80px]">
            <AssistantChat 
              activeRole={activeRole} 
              recommendations={[]} 
              language={language}
              accessibilityNeeds={accessibilityNeeds}
              pendingQuery={pendingQuery}
              onQueryConsumed={() => setPendingQuery(null)}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
