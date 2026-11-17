/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Allin Studio Admin (allin-studio-admin) — Standalone Express + Vite Server.
 * Puede ejecutarse de forma completamente independiente en puerto 4000 o Cloud Run.
 */

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { optionalAuth, requireAdmin, type AuthenticatedRequest } from './src/server/authMiddleware.ts';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import {
  getSolverMetaState,
  mergeInternetSolverUpdates,
  type SolverMetaRule,
  type SolverSourceCitation
} from './src/server/solverMetaStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 4000;
const isProduction = process.env.NODE_ENV === 'production';

async function startAdminServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'allin-studio-admin',
      timestamp: Date.now()
    });
  });

  // Authenticated Admin Runtime Diagnostics
  app.get('/api/admin/system-info', requireAdmin, (req: AuthenticatedRequest, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const geminiConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      service: 'allin-studio-admin',
      adminEmail: req.user?.email || null,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMB: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
      env: isProduction ? 'production' : 'development',
      geminiConfigured,
      firebaseProjectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      timestamp: Date.now()
    });
  });

  app.get('/api/solver/meta', optionalAuth, (_req, res) => {
    res.json(getSolverMetaState());
  });

  app.post('/api/solver/sync-internet', requireAdmin, async (req, res) => {
    const topic =
      typeof req.body?.topic === 'string' && req.body.topic.trim()
        ? req.body.topic.trim().slice(0, 140)
        : 'No Limit Holdem 6-max Nash equilibrium C-bet sizing frequencies 3-bet pots exploitative population tendencies 2025';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY no está configurada en el servidor Admin para búsquedas en vivo.'
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      const prompt = `Eres el Arquitecto de Teoría de Juegos Nash de Allin School (motor Lab Studio para No-Limit Hold'em 6-Max).
Consulta en internet la información estratégica más actual sobre: "${topic}".
Resume las 3 conclusiones técnicas más importantes aplicadas a NL2–NL100 en español claro y directo.

Devuelve ÚNICAMENTE un bloque JSON válido con esta estructura exacta (sin texto adicional fuera del JSON):
{
  "summary": "Resumen ejecutivo de 2 frases sobre las tendencias estratégicas actuales de equilibrio 6-Max.",
  "rules": [
    {
      "topic": "Nombre corto del spot o tendencia",
      "street": "preflop" | "flop" | "turn" | "river",
      "texture": "Seco (Dry)" | "Coordinado (Wet)" | "Monótono (Monotone)" | "Emparejado (Paired)" | "Botes 3-Bet",
      "recommendedAction": "Acción exacta recomendada por equilibrio Nash",
      "sizingPctPot": 33,
      "gtoFrequencyPct": 75,
      "exploitativeAdjustment": "Cómo ajustar según el rival real (Nit, Recreacional, LAG)"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const citationsMap = new Map<string, SolverSourceCitation>();
      for (const chunk of chunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && title && !citationsMap.has(uri)) {
          citationsMap.set(uri, { title, url: uri });
        }
      }
      const citations = Array.from(citationsMap.values());

      const rawText = response.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      let parsedSummary = 'Sincronización completada con estrategias actuales de equilibrio Nash en internet.';
      let parsedRulesRaw: Array<Record<string, unknown>> = [];

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
            parsedSummary = parsed.summary.trim();
          }
          if (Array.isArray(parsed.rules)) {
            parsedRulesRaw = parsed.rules;
          }
        } catch {
          parsedSummary = rawText.slice(0, 260);
        }
      } else if (rawText.trim()) {
        parsedSummary = rawText.slice(0, 260);
      }

      const newRules: SolverMetaRule[] = parsedRulesRaw.slice(0, 4).map((r, idx) => {
        const streetVal =
          typeof r.street === 'string' && ['preflop', 'flop', 'turn', 'river'].includes(r.street)
            ? (r.street as SolverMetaRule['street'])
            : 'flop';
        return {
          id: `meta-web-${Date.now()}-${idx}`,
          topic: typeof r.topic === 'string' ? r.topic.slice(0, 120) : `Tendencia Lab Studio #${idx + 1}`,
          street: streetVal,
          texture: typeof r.texture === 'string' ? r.texture.slice(0, 50) : 'Seco (Dry)',
          recommendedAction: typeof r.recommendedAction === 'string' ? r.recommendedAction.slice(0, 90) : 'Bet 33% Pot',
          sizingPctPot: typeof r.sizingPctPot === 'number' ? Math.max(0, Math.min(200, Math.round(r.sizingPctPot))) : 33,
          gtoFrequencyPct: typeof r.gtoFrequencyPct === 'number' ? Math.max(5, Math.min(100, Math.round(r.gtoFrequencyPct))) : 70,
          exploitativeAdjustment: typeof r.exploitativeAdjustment === 'string' ? r.exploitativeAdjustment.slice(0, 260) : 'Ajusta según perfil del oponente.',
          sourceOrigin: 'internet_solver',
          confidence: 92,
          updatedAt: Date.now(),
          citations: citations.slice(0, 3)
        };
      });

      const updatedState = mergeInternetSolverUpdates({
        summary: parsedSummary,
        newRules,
        citations
      });

      res.json(updatedState);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al sincronizar con internet';
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Allin Studio Admin Console listening on http://0.0.0.0:${PORT}`);
  });
}

startAdminServer().catch((err) => {
  console.error('Failed to start Admin Console server:', err);
  process.exit(1);
});
