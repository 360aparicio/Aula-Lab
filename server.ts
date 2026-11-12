/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lab Studio V3.1 Pro — Full-Stack Express Server + Vite Middleware + Gemini Google Search Grounding.
 * Ready for Cloud Run (serves Vite HMR-disabled dev middleware in dev, or dist/ in production) on Port 3000.
 */

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { optionalAuth, requireAuth, type AuthenticatedRequest } from './src/server/authMiddleware.ts';
import {
  getSolverMetaState,
  mergeInternetSolverUpdates,
  recordCollectiveUserSample,
  type SolverMetaRule,
  type SolverSourceCitation
} from './src/server/solverMetaStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck for Cloud Run & preview
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'lab-studio-v31-pro',
      timestamp: Date.now()
    });
  });

  // Verify authenticated Firebase token
  app.get('/api/user/verify', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      uid: req.user?.uid,
      email: req.user?.email || null,
      emailVerified: req.user?.email_verified ?? false
    });
  });

  // Get unified Solver Meta + Collective User Learning state
  app.get('/api/solver/meta', optionalAuth, (_req, res) => {
    res.json(getSolverMetaState());
  });

  // Collective User Learning ingestion endpoint
  app.post('/api/solver/learn-from-users', optionalAuth, (req, res) => {
    const body = req.body || {};
    const texture = typeof body.texture === 'string' ? body.texture.slice(0, 60) : 'Seco (Dry)';
    const street = typeof body.street === 'string' ? body.street.slice(0, 20) : 'flop';
    const chosenAction = typeof body.chosenAction === 'string' ? body.chosenAction.slice(0, 80) : 'Desconocida';
    const bestAction = typeof body.bestAction === 'string' ? body.bestAction.slice(0, 80) : 'Bet 33% Pot';
    const evLossPct = typeof body.evLossPct === 'number' ? body.evLossPct : 0;

    const updated = recordCollectiveUserSample({
      texture,
      street,
      chosenAction,
      bestAction,
      evLossPct
    });

    res.json(updated);
  });

  // Live Internet + Modern Solver Sync via Gemini Google Search Grounding
  app.post('/api/solver/sync-internet', optionalAuth, async (req, res) => {
    const topic = typeof req.body?.topic === 'string' && req.body.topic.trim()
      ? req.body.topic.trim().slice(0, 140)
      : 'No Limit Holdem 6-max GTO solver C-bet sizing frequencies 3-bet pots exploitative population tendencies 2025';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY no está configurada en el entorno del servidor para búsquedas en vivo.'
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `Eres un experto teórico de póker No-Limit Hold'em 6-Max (GTO Wizard / PioSolver / MonkerSolver).
Consulta en internet la información más actual de solvers modernos sobre: "${topic}".
Resume las 3 conclusiones técnicas más importantes aplicadas a NL2–NL100 en español claro y directo ("para dummies y pros").

Devuelve ÚNICAMENTE un bloque JSON válido con esta estructura exacta (sin texto adicional fuera del JSON):
{
  "summary": "Resumen ejecutivo de 2 frases sobre las tendencias actuales de solvers online.",
  "rules": [
    {
      "topic": "Nombre corto del spot o tendencia",
      "street": "preflop" | "flop" | "turn" | "river",
      "texture": "Seco (Dry)" | "Coordinado (Wet)" | "Monótono (Monotone)" | "Emparejado (Paired)" | "Botes 3-Bet",
      "recommendedAction": "Acción exacta recomendada por solvers modernos",
      "sizingPctPot": 33,
      "gtoFrequencyPct": 75,
      "exploitativeAdjustment": "Cómo ajustar según el rival real (Nit, Fish/Calling Station, LAG)"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2
        }
      });

      // Extract grounded web citations
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

      // Parse structured rules cleanly from model output
      const rawText = response.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      let parsedSummary = 'Sincronización completada con estrategias actuales de solvers GTO en internet.';
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
        const streetVal = typeof r.street === 'string' && ['preflop', 'flop', 'turn', 'river'].includes(r.street)
          ? (r.street as SolverMetaRule['street'])
          : 'flop';
        return {
          id: `meta-web-${Date.now()}-${idx}`,
          topic: typeof r.topic === 'string' ? r.topic.slice(0, 120) : `Tendencia Solver #${idx + 1}`,
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

  // Mount Vite middleware in dev OR static dist in production
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
    console.log(`Lab Studio V3.1 Pro server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
