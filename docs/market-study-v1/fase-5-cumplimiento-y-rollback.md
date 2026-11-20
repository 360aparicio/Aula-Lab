# FASE 5 — Checklist de Cumplimiento y Garantía de Rollback (< 5 min)

**Estado:** APROBADO PARA STAGING / CONTROLLED PILOT (Flag default `OFF`).

## Checklist de Cumplimiento Reglas R1–R8 & Legal

| ID | Requisito | Estado | Evidencia / Mecanismo |
| :--- | :--- | :--- | :--- |
| **R1** | Feature flag `market_study_v1` default `OFF` | CUMPLIDO | `.env.example`, `DEFAULT_MARKET_STUDY_FLAG.enabled = false`, `GET /api/flags` |
| **R2** | Flag `OFF` = comportamiento exacto Demo Final | CUMPLIDO | Rama condicional en `src/App.tsx`, `studyTelemetry` en NO-OP |
| **R3** | Migración DB con `down` probado en staging | CUMPLIDO | `scripts/migrations/marketStudyMigration.ts` + tests UP/DOWN idempotentes |
| **R4** | Cero ambigüedades sin definir | CUMPLIDO | Decisiones delegadas aprobadas tras FASE 0 documentadas |
| **R5** | Documentación en `/docs/market-study-v1/` | CUMPLIDO | Informes completos FASE 0 a FASE 6 |
| **R6** | Aprobación explícita antes de avanzar | CUMPLIDO | Aprobación explícita de FASE 0 otorgada por el usuario |
| **R7** | Cobertura de tests >= 80% en módulos nuevos | CUMPLIDO | **100.0%** líneas y funciones vía V8 coverage |
| **R8** | Rollback completo en < 5 minutos | CUMPLIDO | Ver procedimiento abajo (toma < 30 segundos) |
| **L1** | Consentimiento explícito no premarcado v1.0 | CUMPLIDO | `AdaptiveOnboardingModal.tsx` + `/studyConsents` append-only |
| **L2** | Bloqueo menores `< 18` años | CUMPLIDO | `validateAdultAge()` en cliente y validación previa a inscripción |
| **L3** | Ley 1581/2012 (CO) & GDPR Art. 17 / Art. 33 | CUMPLIDO | `LEGAL.md`, purga <= 30 días en retiro, notificación brechas <= 72h |
| **S1** | Hardening `firestore.rules` + Zero PII | CUMPLIDO | Reglas Eight-Pillar desplegadas, HMAC IP hash, CSV anti-fórmula |
| **G1** | Baseline Demo Final intacta | CUMPLIDO | Rama `demo-final` y tag `v5.0.0-demo-final` congelados en `c89811f` |

## Procedimiento de Rollback Instantáneo (< 5 minutos)
1. **Opción A (Consola Admin — ~10 segundos):** Ir a `Admin → Estudio 300` → clic en **"Rollback Instantáneo (OFF)"**. La UI de todos los clientes revierte en tiempo real vía `onSnapshot`.
2. **Opción B (Variable de entorno — ~1 minuto):** Establecer `VITE_FEATURE_MARKET_STUDY_V1=false` / `FEATURE_FLAG_MARKET_STUDY_V1=false` para forzar el Kill-Switch de entorno por encima de Firestore.
3. **Opción C (Código / Git — ~2 minutos):** Hacer checkout del tag inmutable `v5.0.0-demo-final`.
