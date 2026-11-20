# FASE 3 — Telemetría, Feedback (Días 7/14/21/30) y Consola Admin

**Estado:** COMPLETADA Y VERIFICADA (App + Consola Admin Independiente).

## 1. Telemetría Tipada & Privacidad (`src/lib/study/telemetryClient.ts`)
- **Batching inteligente:** Acumula hasta 10 eventos o 15s antes de escribir en batch (`/studyEvents`) vía `flushStudyEventsBatch`.
- **Resiliencia Offline:** Persiste cola pendiente en `localStorage` aislado por UID (`readScopedItem` / `writeScopedItem`).
- **Sanitización anti-PII:** `sanitizeTelemetryMetadata()` elimina llaves sensibles (`email`, `mail`, `phone`, `token`, `password`, `secret`, `ip`, `address`, `name`).
- **Strict NO-OP:** Cuando `market_study_v1 === false` o no existe consentimiento activo, `track()` retorna `false` y vacía la cola local sin emitir tráfico alguno.

## 2. Encuestas Periódicas, Recordatorios y Retiro GDPR (`StudyFeedbackModal.tsx` & `milestoneScheduler.ts`)
- **Hitos programados:** Días **7, 14, 21 y 30** desde `enrolledAtMs` (`getDueStudyMilestone()`).
- **Métricas recopiladas:** NPS (`0–10`), Sean Ellis PMF (`very_disappointed | somewhat_disappointed | not_disappointed`), Satisfacción de nivel (`1–5`), Calibración de densidad (`too_simple | just_right | too_complex`) y comentario abierto.
- **Generador HTML de Recordatorios:** `buildMilestoneReminderEmailHtml()` y endpoint autenticado `POST /api/study/reminder-preview` con escape XSS estricto y rechazo de URLs no HTTP(S).
- **Derecho al Olvido (`withdrawFromMarketStudy`):** Confirmación explícita en 2 pasos (sin `window.confirm`), revocación de consentimiento, decremento atómico de cohorte, borrado inmediato de `/studyEvents` y `/studyFeedback` del usuario y vaciado de cola local.

## 3. Consola Admin (`admin-console/src/components/MarketStudyAdminPanel.tsx`)
- Módulo autocontenido (`admin-console/src/lib/adminStudyService.ts`) compatible con split-repo.
- Pestaña **Estudio 300** integrada en `AdminDashboard.tsx`:
  - Interruptor maestro `market_study_v1` ON / Rollback instantáneo OFF.
  - Botón de inicialización de cupos `100/100/100`.
  - Tarjetas por cohorte (Retención %, NPS, PMF Sean Ellis meta >= 40%, distribución de densidad, eventos).
  - Tabla de participantes con selector de `adminOverrideLevel`.
  - Descarga anonimizada **CSV** (anti-inyección de fórmulas `= + - @`) y **JSON** (UID seudonimizado `PART-XXXXXXXX`).
