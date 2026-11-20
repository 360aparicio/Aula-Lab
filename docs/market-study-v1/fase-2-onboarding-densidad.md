# FASE 2 — Onboarding Adaptativo y Densidad Cognitiva (FISH / REG / NIT)

**Estado:** COMPLETADA Y VERIFICADA.

## 1. Principio Rector: Densidad de Información, NO Permisos
- La variable `planTier` (`free | pro | elite`) controla permisos de suscripción intactos.
- El nivel de estudio (`fish | reg | nit`) definido en `src/lib/study/levelConfig.ts` (`STUDY_LEVEL_CONFIGS`) controla exclusivamente la **densidad visual y cognitiva**:
  - **FISH (Novato · Simple):** Lenguaje claro, glosario contextual, prioriza Fundamentos Módulo 0 (`defaultTab: 'fundamentals'`), oculta métricas matemáticas avanzadas (`showAdvancedMath: false`), encabezado simplificado.
  - **REG (Intermedio · Balanceado):** Equilibrio entre Asistente Guiado (`defaultTab: 'wizard'`), Mesa 6-Max y TheTracker2, manteniendo tooltips de glosario.
  - **NIT (Avanzado · Analítico):** Máxima densidad desde el segundo 1 (`defaultTab: 'solver'`), árbol DCFR, EV%, SPR y matriz 13×13 sin relleno introductorio (`maxHintsVisible: 0`).

## 2. Jerarquía Estricta de Resolución de Nivel
Implementada y validada en `resolveEffectiveStudyLevel()`:
```
admin_override  >  cohort_assignment  >  self_selected
```
- Un administrador puede forzar `adminOverrideLevel` desde la Consola Admin sin alterar la cohorte estadística (`cohortLevel`) ni los permisos del plan del usuario.

## 3. Flujo del Onboarding Modal de 3 Pasos (`AdaptiveOnboardingModal.tsx`)
1. **Paso 1 — Legal y Edad (>= 18):** Año de nacimiento validado + 5 cláusulas del Consentimiento Informado v1.0 + checkbox explícito **no premarcado**.
2. **Paso 2 — Selección de Perfil FISH / REG / NIT:** Tarjetas visuales con descripción de densidad y cupos disponibles en tiempo real (`100 - currentCount`).
3. **Paso 3 — Confirmación y Asignación Atómica:** Ejecuta `acceptConsentAndEnrollStudy()` combinando registro append-only `/studyConsents` y transacción `/studyCohorts` + `/studyEnrollments`.
