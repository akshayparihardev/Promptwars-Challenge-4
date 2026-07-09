// ============================================================
// Gemini LLM Adapter — Implements LlmReasoner port using
// Google Generative AI SDK. Prompt templates from config.
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { SituationHypothesisSchema, ImpactPredictionSchema, AlternativeSchema } from '@aegis/shared';
import type { SituationHypothesis, ImpactPrediction, Alternative, LanguageCode } from '@aegis/shared';
import type { LlmReasoner } from '../../domain/ports/index.js';
import type { AppConfig } from '../config/config-loader.js';

export class GeminiReasoner implements LlmReasoner {
  private readonly model;

  constructor(private readonly config: AppConfig) {
    const genAI = new GoogleGenerativeAI(config.env.geminiApiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async correlate(input: {
    signals: Array<{ id: string; domain: string; type: string; zone: string; severity: string; summary: string }>;
    stateSnapshot: string;
  }): Promise<SituationHypothesis[]> {
    const prompt = `${this.config.prompts.correlate}\n\n## Current Signals:\n${JSON.stringify(input.signals, null, 2)}\n\n## State Snapshot:\n${input.stateSnapshot}`;

    const raw = await this.callLlm(prompt);
    const parsed = z.array(SituationHypothesisSchema).safeParse(raw);

    if (!parsed.success) {
      console.warn('[GEMINI] Schema validation failed for correlate:', parsed.error.message);
      return [];
    }

    return parsed.data;
  }

  async predictImpact(input: {
    situations: SituationHypothesis[];
    stateSnapshot: string;
  }): Promise<ImpactPrediction[]> {
    const prompt = `${this.config.prompts.predictImpact}\n\n## Situations:\n${JSON.stringify(input.situations, null, 2)}\n\n## State Snapshot:\n${input.stateSnapshot}`;

    const raw = await this.callLlm(prompt);
    const parsed = z.array(ImpactPredictionSchema).safeParse(raw);

    if (!parsed.success) {
      console.warn('[GEMINI] Schema validation failed for predictImpact:', parsed.error.message);
      return [];
    }

    return parsed.data;
  }

  async generateAlternatives(input: {
    situation: SituationHypothesis;
    prediction: ImpactPrediction;
    allowedActions: string[];
  }): Promise<Alternative[]> {
    const prompt = `${this.config.prompts.generateAlternatives}\n\n## Situation:\n${JSON.stringify(input.situation, null, 2)}\n\n## Predicted Impact:\n${JSON.stringify(input.prediction, null, 2)}\n\n## Allowed Actions:\n${JSON.stringify(input.allowedActions)}`;

    const raw = await this.callLlm(prompt);
    const parsed = z.array(AlternativeSchema).safeParse(raw);

    if (!parsed.success) {
      console.warn('[GEMINI] Schema validation failed for alternatives:', parsed.error.message);
      return [];
    }

    return parsed.data;
  }

  async localize(text: string, targetLang: LanguageCode): Promise<string> {
    if (targetLang === 'en') return text;

    const prompt = `${this.config.prompts.localize}\n\nTarget language: ${targetLang}\nText to translate:\n${text}`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      console.warn('[GEMINI] Localization failed, returning original:', (err as Error).message);
      return `${text} [translation unavailable]`;
    }
  }

  private async callLlm(prompt: string): Promise<unknown> {
    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();

      // Extract JSON from response (may be wrapped in markdown code block)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
      const jsonStr = jsonMatch[1]?.trim() ?? text;

      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('[GEMINI] LLM call failed:', (err as Error).message);
      return [];
    }
  }
}
