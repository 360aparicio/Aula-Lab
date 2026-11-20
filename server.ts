/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Allin School · Motor Lab Studio — Full-Stack Express Server + Vite Middleware + Gemini Grounding.
 * Ready for Cloud Run (serves Vite HMR-disabled dev middleware in dev, or dist/ in production) on Port 3000.
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { optionalAuth, requireAuth, requireAdmin, type AuthenticatedRequest } from './src/server/authMiddleware.ts';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { evaluateMarketStudyFlag } from './src/lib/study/featureFlags.ts';
import { buildMilestoneReminderEmailHtml } from './src/lib/study/milestoneScheduler.ts';
import {
  getSolverMetaState,
  mergeInternetSolverUpdates,
  recordCollectiveUserSample,
  type SolverMetaRule,
  type SolverSourceCitation
} from './src/server/solverMetaStore.ts';

const EPHEMERAL_CONSENT_HASH_SECRET = crypto.randomBytes(32).toString('hex');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck for Cloud Run & preview
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'allin-school-edu',
      educationalOnly: true,
      legalFramework: 'CAN Decisión 351/1993 · Colombia Ley 1581/2012 (Habeas Data)',
      timestamp: Date.now()
    });
  });

  // Authenticated Admin Runtime Diagnostics (shared with mounted /admin/ console)
  app.get('/api/admin/system-info', requireAdmin, (req: AuthenticatedRequest, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const geminiConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      service: 'allin-studio-unified',
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

  // Feature flags read-only endpoint (default OFF per Rule R1/R2)
  app.get('/api/flags', (_req, res) => {
    const flag = evaluateMarketStudyFlag({
      envFlagValue: process.env.FEATURE_FLAG_MARKET_STUDY_V1 ?? process.env.VITE_FEATURE_MARKET_STUDY_V1 ?? null
    });
    res.json({
      market_study_v1: {
        enabled: flag.enabled,
        cohortMaxPerLevel: flag.cohortMaxPerLevel,
        defaultOff: true
      },
      timestamp: Date.now()
    });
  });

  // Server-side irreversible HMAC-SHA256 IP hash + jurisdiction metadata for append-only legal consent
  app.post('/api/legal/consent-meta', requireAuth, (req: AuthenticatedRequest, res) => {
    const rawIp =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      '0.0.0.0';
    const secret = process.env.CONSENT_HASH_SECRET || EPHEMERAL_CONSENT_HASH_SECRET;
    const ipHash = crypto
      .createHmac('sha256', secret)
      .update(`${req.user?.uid || 'anon'}:${rawIp}`)
      .digest('hex')
      .slice(0, 48);

    const countryHeader =
      req.headers['cf-ipcountry'] ||
      req.headers['x-appengine-country'] ||
      req.headers['x-country-code'];
    const countryCode =
      typeof countryHeader === 'string' && /^[A-Za-z]{2,8}$/.test(countryHeader.trim())
        ? countryHeader.trim().toUpperCase()
        : 'INTL';
    const userAgent =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 200) : 'unknown';

    res.json({
      ipHash: `hmac_${ipHash}`,
      countryCode,
      userAgent,
      serverTimeMs: Date.now()
    });
  });

  // Safe HTML milestone reminder preview (Days 7/14/21/30)
  app.post('/api/study/reminder-preview', requireAuth, (req: AuthenticatedRequest, res) => {
    const rawMilestone = req.body?.milestone;
    const rawLevel = req.body?.level;
    const milestone =
      rawMilestone === 'day7' || rawMilestone === 'day14' || rawMilestone === 'day21' || rawMilestone === 'day30'
        ? rawMilestone
        : 'day7';
    const level = rawLevel === 'fish' || rawLevel === 'reg' || rawLevel === 'nit' ? rawLevel : 'reg';
    const displayName =
      typeof req.body?.displayName === 'string' ? req.body.displayName.slice(0, 80) : req.user?.name || 'Jugador';
    const appUrl = process.env.APP_URL && /^https?:\/\//i.test(process.env.APP_URL)
      ? process.env.APP_URL
      : 'https://allinstudio.edu';

    const html = buildMilestoneReminderEmailHtml({ displayName, level, milestone, appUrl });
    res.json({ milestone, level, html });
  });

  // Verify authenticated Firebase token
  app.get('/api/user/verify', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      uid: req.user?.uid,
      email: req.user?.email || null,
      emailVerified: req.user?.email_verified ?? false
    });
  });

  // Get unified Lab Studio Meta + Collective User Learning state
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

  // Live Internet + Lab Studio Equilibrium Sync via Gemini Google Search Grounding (Admin Only)
  app.post('/api/solver/sync-internet', requireAdmin, async (req, res) => {
    const topic = typeof req.body?.topic === 'string' && req.body.topic.trim()
      ? req.body.topic.trim().slice(0, 140)
      : 'No Limit Holdem 6-max Nash equilibrium C-bet sizing frequencies 3-bet pots exploitative population tendencies 2025';

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

  // Personalized Career Roadmap generated via Gemini AI (Authenticated Students)
  app.post('/api/gemini/roadmap', requireAuth, async (req: AuthenticatedRequest, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY no está configurada en el servidor para generar el plan de carrera.'
      });
      return;
    }

    const masteryScore = typeof req.body?.masteryScore === 'number' ? Math.round(req.body.masteryScore) : 75;
    const elo = typeof req.body?.elo === 'number' ? Math.round(req.body.elo) : 1200;
    const currentLevel = typeof req.body?.currentLevel === 'number' ? Math.round(req.body.currentLevel) : 1;
    const weakestCategory = typeof req.body?.weakestCategory === 'string'
      ? req.body.weakestCategory.slice(0, 80)
      : 'Botes 3-Bet y Defensa BB';
    const strongestCategory = typeof req.body?.strongestCategory === 'string'
      ? req.body.strongestCategory.slice(0, 80)
      : 'Flops Secos SRP';

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Actúa como Coach Senior de Allin School para póker No-Limit Texas Hold'em 6-Max (NL2 a NL100).
Crea un plan de estudio accionable y claro personalizado para este alumno:
- Dominio Equilibrio Nash actual: ${masteryScore}%
- ELO de entrenamiento: ${elo}
- Nivel educativo desbloqueado: Nivel ${currentLevel} de 4
- Mayor fortaleza detectada: ${strongestCategory}
- Fuga principal prioritaria: ${weakestCategory}

Responde en español claro con 3 pasos semanales prácticos usando las herramientas del aula (Paso a Paso, Práctica Multi-Calle, Mazo SM-2 y Evaluaciones).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING, description: 'Titular motivador y técnico de 1 frase.' },
              weeklyGoal: { type: Type.STRING, description: 'Objetivo concreto de ELO/EV para esta semana.' },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    action: { type: Type.STRING },
                    focusArea: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const parsed = JSON.parse((response.text ?? '{}').trim() || '{}');
      res.json({
        headline: typeof parsed.headline === 'string' ? parsed.headline : 'Plan de Ascenso Nash Personalizado · Allin School',
        weeklyGoal: typeof parsed.weeklyGoal === 'string' ? parsed.weeklyGoal : 'Reducir errores >3% EV mediante repaso diario SM-2.',
        steps: Array.isArray(parsed.steps) ? parsed.steps.slice(0, 4) : [],
        generatedAt: Date.now()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error generando el plan de carrera con Gemini AI.';
      res.status(500).json({ error: message });
    }
  });

  // AI Hand Review for imported TheTracker2 hands (Authenticated Students)
  app.post('/api/gemini/hand-review', requireAuth, async (req: AuthenticatedRequest, res) => {
    const heroPos = typeof req.body?.heroPos === 'string' ? req.body.heroPos.slice(0, 12) : 'BTN';
    const scenario = typeof req.body?.scenario === 'string' ? req.body.scenario.slice(0, 32) : 'SRP_IP';
    const heroCards = typeof req.body?.heroCards === 'string' ? req.body.heroCards.slice(0, 20) : 'AsKd';
    const board = typeof req.body?.board === 'string' ? req.body.board.slice(0, 40) : 'Ah 7d 2c';
    const netWonBB = typeof req.body?.netWonBB === 'number' ? req.body.netWonBB : 0;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.json({
        summary: `Revisión técnica TheTracker2 (${heroPos} · ${scenario}): Con ${heroCards} en board ${board || 'Preflop'} (${netWonBB} BB), revisa balance de C-Bet y Pot Odds antes de pagar barriles en river.`,
        leakDetected: netWonBB < -8 ? 'Posible exceso de agresión o hero-call fuera de rango en calles finales.' : 'Varianza normal; verifica frecuencias por posición.',
        correctLine: 'Prioriza sizings pequeños (33% pot) en texturas secas y check-control con manos de valor medio.',
        keyTakeaway: `${heroPos} ${heroCards} en ${board || 'Preflop'}: controla tamaño de bote según SPR y bloqueadores.`
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analiza brevemente en español claro (estilo didáctico de Allin School) esta mano 6-Max registrada en TheTracker2:
- Posición Hero: ${heroPos}
- Escenario: ${scenario}
- Cartas Hero: ${heroCards}
- Board: ${board || 'Preflop'}
- Resultado neto: ${netWonBB} BB`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              leakDetected: { type: Type.STRING },
              correctLine: { type: Type.STRING },
              keyTakeaway: { type: Type.STRING }
            }
          }
        }
      });

      const parsed = JSON.parse((response.text ?? '{}').trim() || '{}');
      res.json({
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Análisis completado.',
        leakDetected: typeof parsed.leakDetected === 'string' ? parsed.leakDetected : 'Revisa tus sizings de valor y defensa.',
        correctLine: typeof parsed.correctLine === 'string' ? parsed.correctLine : 'Línea de equilibrio Nash por posición.',
        keyTakeaway: typeof parsed.keyTakeaway === 'string' ? parsed.keyTakeaway : `${heroPos} · ${heroCards}: protege tu rango.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error analizando la mano con Gemini AI.';
      res.status(500).json({ error: message });
    }
  });

  // Mount Independent Admin Console bundle at /admin and /admin/ (linked dual-repo preview)
  const adminDistDir = path.resolve(__dirname, 'admin-console', 'dist');
  const adminAssetsDir = path.join(adminDistDir, 'assets');
  const sendAdminIndexHtml = (res: express.Response) => {
    const adminIndex = path.join(adminDistDir, 'index.html');
    if (!fs.existsSync(adminIndex)) {
      res.status(503).send(
        '<html><body style="background:#000;color:#e5e5e5;font-family:sans-serif;padding:40px"><h2>Allin Studio Admin Independiente</h2><p>Ejecuta <code>npm --prefix admin-console run build</code> o inicia el servidor Admin independiente en el puerto 4000.</p><a href="/" style="color:#3b82f6">Volver a Allin School</a></body></html>'
      );
      return;
    }
    try {
      let html = fs.readFileSync(adminIndex, 'utf8');
      if (!/<base\s/i.test(html)) {
        html = html.replace('<head>', '<head>\n    <base href="/admin/">');
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch {
      res.sendFile(adminIndex);
    }
  };

  app.get(['/admin', '/admin/', '/admin/index.html'], (_req, res) => {
    sendAdminIndexHtml(res);
  });
  app.use('/admin/assets', express.static(adminAssetsDir, { fallthrough: false }));
  app.use('/admin', express.static(adminDistDir, { index: false, redirect: false }));
  app.get('/admin/*', (_req, res) => {
    sendAdminIndexHtml(res);
  });

  // Mount Vite middleware in dev OR static dist in production for Educational Lab Repo
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
    console.log(`Allin School · Motor Lab Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
