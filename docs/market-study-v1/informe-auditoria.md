# FASE 0 — Informe de Auditoría Previa (`market_study_v1`)

**Fecha:** 2026-11-20  
**Rama de trabajo:** `feature/market-study-v1`  
**Línea base preservada (inmutable):** rama `demo-final` · tag `v5.0.0-demo-final` (commit `c89811f`)  
**Reglas aplicables:** R1 (`market_study_v1` default `OFF`), R2 (Flag `OFF` = 0 breaking changes), R3 (migraciones con `down`), R4 (preguntar antes de asumir), R5 (documentar en `/docs/market-study-v1/`), R6 (aprobación explícita antes de avanzar), R7 (cobertura tests `>= 80%` en módulos nuevos), R8 (reversión `< 5 min`).

---

## 1. Stack Detectado (Estado Real del Repositorio)

| Capa | Tecnología Detectada (Verificada) | Brecha frente a supuestos del estudio |
|---|---|---|
| **Frontend App Usuario (`/`)** | React `19.0.1`, TypeScript `~7.0.2`, Vite `8.3.0`, Tailwind CSS v4 (`@tailwindcss/vite` `4.3.3`), D3.js `7.9.0`, `lucide-react` `0.546.0`, `jszip` `3.10.2`, `motion` `12.23.24` | Sin suite E2E (Playwright/Cypress) ni `i18n` formal centralizado |
| **Frontend Admin (`/admin-console/`)** | SPA independiente React `19.0.1` + Vite `8.3.0` + Tailwind v4 + D3.js `7.9.0`, montada en `/admin/` vía Express (`server.ts:353-384`) y exportable con `scripts/split-repos.sh` | Sin panel específico para cohortes, cupos `100/100/100`, NPS o auditoría de consentimientos |
| **Backend / API** | Node.js `22` (`@types/node` `22.14.0`), Express `4.21.2` ESM (`server.ts`, puerto `3000`, `tsx server.ts` en dev, `NODE_ENV=production node server.ts` en prod), `@google/genai` `3.2.0` (`gemini-4-hydrogen`) | Sin endpoints `/api/flags`, `/api/study/*`, `/api/legal/*` ni sistema de colas/cron o proveedor SMTP |
| **Base de Datos & Persistencia** | **Cloud Firestore (Enterprise Edition)** (`projectId: gen-lang-client-0084003870`, `firestoreDatabaseId: ai-studio-labstudio-90e01f25-4fee-40f8-9a73-a1e58bfad4b7`) con 9 colecciones/subcolecciones validadas por `firestore.rules` + `localStorage` aislado por UID (`src/lib/userStorage.ts`) + caché efímero en `os.tmpdir()` (`src/server/solverMetaStore.ts`) | **No existe PostgreSQL, Drizzle ORM, Prisma ni migraciones SQL (`up/down`) en el repositorio actual.** |
| **Autenticación & RBAC** | Firebase Auth (`GoogleAuthProvider` popup + redirect en `src/lib/firebase.ts`), verificación server-side `firebase-admin` `14.5.1` (`verifyIdToken` en `src/server/authMiddleware.ts`), reglas Fail-Closed en `firestore.rules` y admin bootstrap `360aparicio@gmail.com` | Sin flujo Email/Password ni verificación de edad (`>= 18`) |
| **Hosting & Contenedores** | Cloud Run preview (`vite` con `DISABLE_HMR=true` en `vite.config.ts:17`). Existe `admin-console/Dockerfile` | **No existe `Dockerfile` en la raíz `/`** (solo en `/admin-console/`). No hay configuración IaC ni multi-staging |
| **CI/CD & Testing** | Script unitario personalizado `tsx tests/run_all.ts` (837 aserciones pasando en `v5.0.0-demo-final`), `tsc --noEmit` (`npm run lint:all`), motor auxiliar Rust en `poker-evaluator-rs/` | **No existe `.github/workflows/` (CI/CD)**, no hay framework de cobertura (`c8`/`vitest --coverage`), ni pruebas de carga (`k6`) o E2E |

---

## 2. Puntos de Entrada Actuales del Onboarding y Niveles

Todos los puntos exactos donde hoy se decide o renderiza la experiencia inicial y el perfil del jugador:

| Archivo | Líneas | Responsabilidad Actual |
|---|---|---|
| `src/App.tsx` | `79–99` | Gate principal de autenticación: pantalla de carga -> `<LoginScreen mode="login" />` -> `<LoginScreen mode="inactive" />` -> `<LabWorkspace key={user.uid} />`. |
| `src/App.tsx` | `105–108` | Inicializa `experienceLevel` desde `loadExperienceMode()` (default `'regular'`) y decide pestaña inicial (`'fundamentals'` si es `'beginner'`, de lo contrario `'wizard'`). |
| `src/App.tsx` | `121–160` | Gestiona `onboardingState`, `handleExperienceLevelChange`, `handleOnboardingGoal` (`learn_zero` -> `'beginner'`, `analyze_hands` -> `'recreational'`, `crush_stakes` -> `'pro'`), `handleDismissOnboarding`, `handleReopenOnboarding`. |
| `src/App.tsx` | `742–774` | Barra superior persistente **"Perfil de Estudio"** con botones directos para los 4 niveles actuales (`beginner`, `recreational`, `regular`, `pro`) y botón `"Guía 60s"`. |
| `src/App.tsx` | `776–782` | Renderiza `<Onboarding60sBanner>` si `!onboardingState.completed && !onboardingState.dismissed`. |
| `src/lib/experienceMode.ts` | `14–68` | Define el tipo `ExperienceLevel = 'beginner' \| 'recreational' \| 'regular' \| 'pro'` y `EXPERIENCE_LEVEL_META` (`showPlainLanguageHints`, `showGlossaryTooltips`, `prioritizeFundamentals`, `simplifyHeader`). |
| `src/lib/experienceMode.ts` | `70–91` | Persistencia local por UID (`EXP_MODE_KEY = 'lab_player_experience_mode_v1'`). **Nota:** hoy NO sincroniza con Firestore. |
| `src/lib/experienceMode.ts` | `220–261` | Persistencia local de la guía 60s (`ONBOARDING_KEY = 'lab_player_onboarding_60s_v1'`) y tipo `OnboardingGoal`. |
| `src/components/OnboardingAndLeaksBar.tsx` | `29–135` | Componente `<Onboarding60sBanner>` (3 tarjetas de objetivo que asignan nivel + pestaña). |
| `src/components/LoginScreen.tsx` | `71–149` / `151–340` | Puerta de entrada previa al workspace: acceso Google (popup/redirect) y vista de plan inactivo. |
| `src/components/Header.tsx` | `39, 49, 136–156, 169` | Reordena pestañas entre barra principal y menú `"Herramientas"` según `experienceLevel` (`beginner`/`recreational` vs `regular`/`pro`) y aplica locks por `planTier`. |
| `src/components/FundamentalsModule.tsx` | `20, 42, 207, 288` | Muestra etiqueta de `EXPERIENCE_LEVEL_META[experienceLevel]` y adapta introducción de Módulo 0. |
| `src/components/TrainerMode.tsx` | `34, 57, 84–88` | Activa `showSimpleTips = experienceLevel === 'beginner' \|\| experienceLevel === 'recreational'` en la Mesa 6-Max. |
| `admin-console/src/components/AdminDashboard.tsx` | `97, 152, 1636–1648` | Sección administrativa `"onboarding"` dedicada actualmente solo a invitaciones manuales (`userInvites`). |

---

## 3. Riesgos Legales Identificados (Ley 1581/2012 · GDPR · Decisión Andina 351/1993)

Estado actual auditado en `LEGAL.md`, `src/components/LegalNoticeModal.tsx`, `src/components/SupportTicketModal.tsx` y `firestore.rules`:

1. **Consentimiento informado ausente e inmutable sin registro:**
   - Hoy no existe modal bloqueante de consentimiento previo ni checkbox *opt-in* desmarcado por defecto.
   - No existe tabla/colección *append-only* que registre `consent_version`, `accepted_at` UTC, hash o IP, `user_agent` ni marca de revocación.
2. **Falta de identificación del Responsable y DPO:**
   - `LEGAL.md:4` y `LegalNoticeModal.tsx:25-57` referencian únicamente la marca `"ALLin Studio"` sin `[razón social]`, NIT/identificación societaria ni correo dedicado `[email DPO]` (solo redirigen a tickets genéricos de soporte).
3. **Verificación de mayoría de edad (`< 18` años) inexistente:**
   - El acceso por Google Sign-In (`src/components/LoginScreen.tsx` + `src/lib/firebase.ts`) no solicita confirmación de edad (`>= 18` años) ni bloquea menores. Al tratarse de teoría matemática aplicada al póker y recolectar telemetría conductual/feedback en un estudio de mercado, el riesgo regulatorio con menores es **CRÍTICO**.
4. **Brechas de Jurisdicción y Transparencia (GDPR vs. Ley 1581 únicamente):**
   - `LegalNoticeModal.tsx:39, 56` y `LEGAL.md:19-23` declaran únicamente la Ley 1581 de 2012 (Colombia).
   - Para participantes en EE. UU./UE (GDPR Art. 6(1)(a), Art. 7, Art. 13, Art. 17, Art. 33) falta: base legal explícita de consentimiento libre y revocable, cláusula de transferencias internacionales de datos (Google Cloud/Firebase), aviso de captura de país/IP para métricas y compromiso de notificación de brechas en `<= 72 horas`.
5. **Ausencia de Retención Automática y Derecho al Olvido / Retiro en Cascada:**
   - No existen políticas TTL ni jobs automáticos para: feedback abierto (`12 meses`), eventos de uso (`6 meses`) y registro legal de consentimientos (`5 años`).
   - Hoy `firestore.rules:298` permite eliminar `users/{userId}` directamente, pero NO ejecuta borrado en cascada de subcolecciones (`sm2Items`, `mistakes`), `localStorage` ni anonimización/eliminación en 30 días de datos del estudio tras pulsar `"Retirarme del estudio"`.

---

## 4. Deuda Técnica que Bloquea `market_study_v1`

| ID | Severidad | Bloqueo Técnico Detectado | Impacto |
|---|---|---|---|
| **TD-1** | **CRÍTICA** | **Desajuste de motor de DB (Firestore vs. SQL especificado):** El sistema actual corre sobre Cloud Firestore y no tiene PostgreSQL/Drizzle ni migraciones `up/down`. Además, según la guía de integración Firebase del entorno, los proyectos Starter pueden restringir acceso `firebase-admin` IAM a Firestore en producción si no usan Cloud SQL o reglas cliente/transacciones seguras. | Bloquea diseño de FASE 1A (`study_cohorts`, `SELECT ... FOR UPDATE`, índices SQL, `up/down` migrations). |
| **TD-2** | **ALTA** | **Taxonomía incompatible de niveles (4 niveles vs. 3 niveles) y mezcla parcial con permisos:** Hoy existen 4 niveles (`beginner`, `recreational`, `regular`, `pro`) guardados solo en `localStorage`, mientras el estudio exige 3 niveles (`fish`, `reg`, `nit`) persistidos en perfil remoto, con prioridad `admin_override > cohort_assignment > self_selected` y control exclusivo sobre **densidad de UI** (nunca permisos). | Bloquea FASE 1B, FASE 2 y FASE 3 hasta definir el mapeo exacto. |
| **TD-3** | **ALTA** | **Lógica de densidad acoplada y sin capa de Feature Flags:** Los flags visuales (`showPlainLanguageHints`, `showSimpleTips`, orden de `Header`) están dispersos en `App.tsx`, `Header.tsx`, `TrainerMode.tsx` y `FundamentalsModule.tsx`, sin objeto centralizado `levelConfig` ni servicio/endpoint de feature flags (`DB + env`). | Impide aislar `market_study_v1 = OFF` limpiamente (Regla R1/R2) y dificulta revertir en `< 5 min` (R8). |
| **TD-4** | **MEDIA** | **Esquema estricto (`hasOnly`) en `firestore.rules` y `UserProfileDoc`:** `firestore.rules:87-91` y `280-283` rechazan cualquier campo nuevo en `users/{uid}` si no se actualizan simultáneamente `firestore.rules`, `firebase-blueprint.json` y `src/lib/cloudSync.ts`. | Cualquier campo nuevo (`study_level`, `cohort_id`, `consent_version`) fallaría en runtime con `permission-denied` si no se diseña como extensión aditiva retrocompatible con Flag OFF. |
| **TD-5** | **MEDIA** | **Sin transporte de Email/Push ni programador de recordatorios (Días 7/14/21/30):** No hay SMTP, Resend, SendGrid ni FCM integrado en `server.ts`. | Bloquea el envío de correos reales en FASE 3C (solo permitiría recordatorios in-app + plantillas si no hay proveedor). |
| **TD-6** | **MEDIA** | **Falta infraestructura de pruebas E2E, cobertura, carga y `Dockerfile` raíz:** Solo existe `tsx tests/run_all.ts` y `admin-console/Dockerfile`. Falta Playwright/Cypress, reportero de cobertura `>= 80%` (Regla R7), script `k6` (FASE 4C) y CI/CD. | Impide automatizar FASE 4 y verificar R7/R8 objetivamente. |

---

## 5. Estimación Realista de Esfuerzo por Fase

| Fase | Alcance Principal | Esfuerzo Estimado | Riesgo Principal |
|---|---|---|---|
| **FASE 0** | Auditoría técnica/legal, snapshot inmutable `demo-final`, informe y alineación | **0.5 días** *(Completada)* | Ambigüedades de arquitectura (TD-1 / TD-2) |
| **FASE 1** | Feature flag `market_study_v1` (DB+Env), esquema/migraciones con `down` (cohortes 100/100/100, eventos, consentimientos, feedback), registro legal Ley 1581 + GDPR + Gate >=18, capa de servicio transaccional | **3.5 – 4.5 días** *(4.5 días si se provisiona Cloud SQL PostgreSQL + Drizzle; 3.5 días sobre Firestore)* | Transacción atómica de cupos + reglas Fail-Closed + rollback `down` |
| **FASE 2** | Onboarding adaptativo en 3 pasos, selector `FISH / REG / NIT` con prioridad `admin_override > cohort_assignment > self_selected`, arquitectura `levelConfig` por densidad sin tocar permisos ni Flag OFF | **3.0 – 3.5 días** | Mantener paridad visual absoluta con Flag OFF (R2) |
| **FASE 3** | Pipeline de eventos tipados (batching + offline queue), encuestas NPS/PMF días 7/14/21/30, recordatorios, Dashboard Admin de cohorte/retención/export CSV+JSON anonimizado | **3.5 – 4.5 días** | Canal de entrega de notificaciones (in-app vs. email) |
| **FASE 4** | Suite unitaria/integración (`>= 80%` cobertura en módulos nuevos), E2E (Playwright: 3 niveles + rollback Flag OFF + concurrencia cupo 100), prueba de carga `k6`, auditoría de regresión | **2.5 – 3.0 días** | Configuración Playwright/k6 en entorno Cloud Run |
| **FASE 5** | Verificación legal final, simulacro de Derecho al Olvido / Retiro en cascada, reporte DPIA/compliance y rollback drill `< 5 min` | **1.0 – 1.5 días** | Cierre de textos legales definitivos (Razón social / DPO) |
| **FASE 6** | Runbook operativo (`activar / monitorear / rollback`), smoke test en staging/prod y entrega de Prompt Maestro definitivo | **1.0 día** | Validación final pre-activación |
| **TOTAL** | **FASE 1 a FASE 6 (End-to-End)** | **14.5 – 18.0 días hábiles** | — |

---

## 6. Checklist de Cumplimiento Pre-Estudio (Alineado con FASE 5)

| # | Requisito de Cumplimiento | Estado Actual | Criterio de Verificación para FASE 5 |
|---|---|---|---|
| 1 | **Feature Flag `market_study_v1` default `OFF`** (R1/R2) | Pendiente | Flag en `OFF` produce comportamiento idéntico a `v5.0.0-demo-final`; toggle reversible `< 5 min` (R8). |
| 2 | **Migraciones con `up` y `down` probados** (R3) | Pendiente | Script `down` ejecutado en staging restaurando esquema limpio sin pérdida de datos de producción. |
| 3 | **Identidad del Responsable y DPO** | Pendiente | `[razón social]` y `[email DPO]` visibles en Consentimiento v1.0, Política de Privacidad y footer legal. |
| 4 | **Consentimiento Informado Opt-In Previo** | Pendiente | Checkbox sin premarcar; bloqueo de registro de estudio hasta aceptación; bitácora *append-only* con `version`, `timestamp`, `ip/hash`, `user_agent`. |
| 5 | **Verificación de Edad (`>= 18` años)** | Pendiente | Bloqueo estricto para `< 18` años antes de crear registro de cohorte o recolectar telemetría. |
| 6 | **Jurisdicción Dual (Ley 1581/2012 + GDPR)** | Pendiente | Base legal Art. 6(1)(a), aviso de transferencia internacional, captura de país/IP, SLA brecha `<= 72h`. |
| 7 | **Derecho al Olvido / Botón `"Retirarme del estudio"`** | Pendiente | Revoca consentimiento, anonimiza/programa purga total en `<= 30 días` y limpia caches locales. |
| 8 | **Retención Diferenciada (12m / 6m / 5a)** | Pendiente | Política y job/TTL verificados: feedback `12m`, eventos `6m`, consentimientos legales `5 años`. |
| 9 | **Integridad de Cupos (100 FISH / 100 REG / 100 NIT)** | Pendiente | Test de concurrencia demuestra que 105 solicitudes simultáneas asignan exactamente 100 cupos y rechazan/enlistan 5. |
| 10 | **Cobertura `>= 80%` y Cero Regresión** (R7) | Pendiente | Reporte de cobertura `>= 80%` en módulos nuevos + `837+` tests existentes en verde + `k6` P95 `< 200ms`. |

---

## 7. Preguntas de Desambiguación Obligatorias (Regla R4)

Antes de iniciar **FASE 1**, se requiere confirmación explícita sobre estos 5 puntos:

1. **Motor de Base de Datos (`TD-1`):** ¿Mantener el estudio sobre **Cloud Firestore** (transacciones atómicas `runTransaction` + reglas *append-only* + script reversible) o provisionar **Cloud SQL PostgreSQL** con Drizzle ORM (`up/down` SQL, `ENUM`, `JSONB`, `SELECT ... FOR UPDATE`)?
2. **Datos Legales del Responsable (`FASE 1C`):** ¿Qué **razón social** y qué **correo oficial de DPO** deben estamparse en el Consentimiento Informado v1.0 y Política de Privacidad?
3. **Verificación de Menores (`< 18` años):** ¿Implementamos **bloqueo estricto `< 18` años** mediante fecha de nacimiento / declaración jurada antes de inscribirse (recomendado), o se requiere algún flujo de consentimiento parental?
4. **Mapeo de Niveles (`TD-2`):** Con `market_study_v1 = ON`, ¿sustituimos en UI los 4 perfiles actuales (`beginner / recreational / regular / pro`) por los 3 niveles del estudio (`FISH / REG / NIT`), o mapeamos los 4 internamente hacia los 3? Confirmar también que `NIT` aumenta la densidad técnica dentro de las secciones permitidas por su `planTier` (Free/Pro/Elite) sin saltarse reglas de suscripción.
5. **Canal de Recordatorios (Días 7 / 14 / 21 / 30):** ¿Basta con **notificaciones in-app + banner/modal programado + plantilla HTML de correo exportable**, o deseas integración activa con un proveedor externo (ej. Resend / SendGrid) usando API key en Secrets?
