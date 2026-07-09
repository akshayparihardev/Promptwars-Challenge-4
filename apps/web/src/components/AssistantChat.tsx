import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Recommendation, Role, ChatResponse } from '@aegis/shared';
import { t } from '../i18n/index.js';

interface AssistantChatProps {
  activeRole: Role;
  recommendations: Recommendation[];
  language?: string;
  accessibilityNeeds?: string[];
  pendingQuery?: string | null;
  onQueryConsumed?: () => void;
}

// Simple markdown-like rendering for bold and newlines
function renderContent(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    );
    return (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {rendered}
      </React.Fragment>
    );
  });
}

export function AssistantChat({ activeRole, recommendations, language = 'en', accessibilityNeeds = [], pendingQuery, onQueryConsumed }: AssistantChatProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial greeting: fetch from chat API to get rich greeting
  useEffect(() => {
    const fetchGreeting = async () => {
      try {
        const response = await fetch('/api/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello', role: activeRole, language, accessibilityNeeds })
        });
        if (response.ok) {
          const data = await response.json() as ChatResponse;
          setMessages([{ id: 'welcome', role: 'assistant', content: data.answer, timestamp: new Date() }]);
        } else {
          setMessages([{ id: 'welcome', role: 'assistant', content: t('assistantGreeting', language), timestamp: new Date() }]);
        }
      } catch {
        setMessages([{ id: 'welcome', role: 'assistant', content: t('assistantGreeting', language), timestamp: new Date() }]);
      }
    };
    fetchGreeting();
  }, [language, activeRole]);

  // Core message sending function
  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isProcessing) return;

    setIsProcessing(true);

    setMessages(prev => [...prev, {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    try {
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          role: activeRole,
          language,
          accessibilityNeeds,
        })
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json() as ChatResponse;

      setMessages(prev => [...prev, {
        id: `msg_ast_${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: t('error', language),
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [activeRole, language, accessibilityNeeds, isProcessing]);

  // Handle pending query from quick actions
  useEffect(() => {
    if (pendingQuery && !isProcessing) {
      sendMessage(pendingQuery);
      onQueryConsumed?.();
    }
  }, [pendingQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(msg);
  };

  return (
    <div className="flex flex-col h-full glass-card overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="w-8 h-8 rounded-full bg-aegis-500/10 flex items-center justify-center">
          <Bot className="w-4.5 h-4.5 text-aegis-600 dark:text-aegis-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AEGIS StadiumMate</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'es' ? 'Asistente del Estadio' : language === 'fr' ? 'Assistant du Stade' : 'Stadium Assistant'} • <span className="capitalize">{activeRole}</span>
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'ml-auto flex-row-reverse max-w-[85%]' : 'max-w-[90%]'}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              msg.role === 'user' 
                ? 'bg-slate-200 dark:bg-slate-700' 
                : 'bg-aegis-500/10'
            }`}>
              {msg.role === 'user' 
                ? <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                : <Bot className="w-3.5 h-3.5 text-aegis-600 dark:text-aegis-400" />
              }
            </div>
            <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-aegis-500 text-white rounded-tr-sm shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm shadow-sm'
            }`}>
              {typeof msg.content === 'string' ? renderContent(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {/* Inline recommendation cards */}
        {recommendations.slice(0, 3).map(rec => (
           <div key={`chat-rec-${rec.id}`} className="flex gap-3 max-w-[95%]">
             <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500/10">
               <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
             </div>
             <div className="p-4 rounded-2xl rounded-tl-sm text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                     rec.priority >= 0.8 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                     rec.priority >= 0.5 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {rec.priority >= 0.8 ? 'CRITICAL' : rec.priority >= 0.5 ? 'HIGH' : 'LOW'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium capitalize">{rec.domain} Alert</span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{rec.title}</h4>
                <p className="text-slate-600 dark:text-slate-300 mb-3">{rec.reason}</p>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5" /> RECOMMENDED ACTION
                  </div>
                  <div className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                    {rec.recommendedAction.replace(/_/g, ' ')}
                  </div>
                </div>
             </div>
           </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3 max-w-[90%]">
            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-aegis-500/10">
              <Bot className="w-3.5 h-3.5 text-aegis-600 dark:text-aegis-400 animate-pulse" />
            </div>
            <div className="p-4 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-aegis-500 animate-spin" />
              <span className="text-sm text-slate-500">{t('processing', language)}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('askPlaceholder', language)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aegis-500/50 transition-all text-slate-900 dark:text-slate-100"
            disabled={isProcessing}
            aria-label="Message input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-1.5 p-1.5 rounded-lg bg-aegis-500 text-white hover:bg-aegis-600 disabled:opacity-50 disabled:hover:bg-aegis-500 transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
