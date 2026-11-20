# FASE 1 — Infraestructura del Estudio, Feature Flag y Cumplimiento Legal (`market_study_v1`)

**Estado:** COMPLETADA Y DESPLEGADA (`firestore.rules` desplegadas en vivo).
**Rama:** `feature/market-study-v1` (rama `demo-final` y tag `v5.0.0-demo-final` intactos en `c89811f`).

## 1. Feature Flag `market_study_v1` (Reglas R1, R2 y R8)
- **Evaluador determinista:** `src/lib/study/featureFlags.ts` (`evaluateMarketStudyFlag`).
- **Default estricto:** `enabled: false` (`OFF`).
- **Precedencia:** Kill-switch de entorno (`VITE_FEATURE_MARKET_STUDY_V1="false"` / `FEATURE_FLAG_MARKET_STUDY_V1="false"`) > documento Firestore `/featureFlags/market_study_v1` > default `false`.
- **Endpoint de estado:** `GET /api/flags` en `server.ts`.
- **Comportamiento OFF:** Idéntico al 100% a la Demo Final `v5.0.0` (4 perfiles clásicos, sin modales de consentimiento, telemetría en modo NO-OP).

## 2. Asignación Atómica de Cohortes (`100 FISH / 100 REG / 100 NIT`)
- **Motor puro + transaccional:** `src/lib/study/cohortAllocator.ts` (`allocateCohortSlotPure`) ejecutado dentro de `runTransaction` en Firestore (`src/lib/study/studyService.ts`).
- **Anti-overbooking:** Garantía atómica de `currentCount <= maxQuota` (100 cupos activos por nivel = 300 total).
- **Overflow controlado:** Cuando `currentCount === 100`, los nuevos solicitantes quedan en `status: 'waitlisted'` incrementando `waitlistCount` sin rechazos silenciosos ni desbordamiento.

## 3. Consentimiento Informado v1.0 & Bloqueo >= 18 Años
- **Módulo legal:** `src/lib/study/legalCompliance.ts`, `LEGAL.md`, `src/components/LegalNoticeModal.tsx`.
- **Responsable y DPO:** `ALLin Studio S.A.S.` (`privacidad@allinstudio.edu`, configurable vía `VITE_LEGAL_CONTROLLER_NAME` y `VITE_LEGAL_DPO_EMAIL`).
- **Marco normativo:** Ley Estatutaria 1581 de 2012 y Decreto 1377 de 2013 (Colombia), Decisión Andina 351 de 1993, GDPR Art. 6(1)(a), 7, 13, 17 (Derecho al Olvido <= 30 días) y 33 (notificación brechas <= 72h).
- **Gate >= 18 años:** `validateAdultAge()` bloquea estrictamente menores antes de crear consentimiento o emitir telemetría.
- **Metadata IP hasheada:** Endpoint `POST /api/legal/consent-meta` (autenticado vía Firebase ID Token) genera `ipHash` con HMAC-SHA256 + `countryCode` aproximado sin persistir IP en texto claro.
- **Registro append-only:** Colección `/studyConsents/{uid}_v1_0` permite `create` y `revoke`, prohíbe `delete` desde cliente para conservar trazabilidad probatoria por 5 años.

## 4. Migración Reversible UP / DOWN (Regla R3)
- **Script:** `scripts/migrations/marketStudyMigration.ts`.
- **UP:** Idempotente; inicializa `/featureFlags/market_study_v1` (`enabled: false`) y las 3 cohortes (`fish`, `reg`, `nit`) con `maxQuota: 100`.
- **DOWN:** Remueve limpiamente los documentos de esquema de estudio sin alterar perfiles existentes de Demo Final.
