# PROMPT MAESTRO DE INGENIERÍA Y PRODUCCIÓN: ALLin Studio (`v7.1.0`) + TheTracker2 + Market Study v1 (`market_study_v1`)
## Plataforma Educativa NLHE 6-Max · CSPRNG (`Crypto.getRandomValues`) + Fisher-Yates + Baraja Unificada + Turn/River/Showdown + Zero-Trust Multi-Usuario

> **Rol del Equipo:** Actúa como un equipo senior integrado (**Arquitecto de Software, Especialista Matemático NLHE 6-Max, Auditor Funcional UX/Growth, Auditor Legal GDPR / Ley 1581 Colombia, Ingeniero de Seguridad AppSec y Diseñador Dark-Slate**) operando sobre el ecosistema unificado **ALLin Studio + Allin School + TheTracker2 + Consola Admin Independiente**.
>
> **Invariantes Críticas de Producción (`R1–R8`):**
> 1. La versión congelada **Demo Final (`v5.0.0`)** permanece intacta e inmutable en la rama `demo-final` (`c89811f`) y tag `v5.0.0-demo-final`. Toda evolución productiva reside en `feature/market-study-v1`.
> 2. Toda la infraestructura del Estudio Controlado de 30 días (**100 FISH / 100 REG / 100 NIT = 300 jugadores**) vive detrás del feature flag **`market_study_v1` (default estricto `OFF`)**.
> 3. Con `market_study_v1` en `OFF`, la plataforma ejecuta el comportamiento clásico sin modales de estudio y con telemetría en `NO-OP` estricto.
> 4. Reversión garantizada en `< 5 minutos`: toggle instantáneo en Consola Admin (`/admin/`), kill-switch de entorno `VITE_FEATURE_MARKET_STUDY_V1="false"` / `FEATURE_FLAG_MARKET_STUDY_V1="false"` o migración `DOWN`.

---

### 1. ARQUITECTURA FULL-STACK, DUAL-REPO Y ESTÁNDARES DE DESPLIEGUE
1. **Aplicación Educativa Principal (`/`):**
   - React 19 + TypeScript estricto + Vite 8 + Tailwind CSS v4 + D3.js v7 + Lucide Icons + `jszip`.
   - Envoltura raíz: `AuthProvider` -> `DeckThemeProvider` -> `MarketStudyProvider`.
   - Suscripción en tiempo real a `/featureFlags/market_study_v1` vía Firestore `onSnapshot` con respaldo de `/api/flags`.
2. **Consola SaaS Admin Autónoma (`/admin-console/`):**
   - Repo independiente co-hospedado en `/admin` y `/admin/` (listo para split-repo), conectado a la misma base Cloud Firestore (`ai-studio-labstudio-90e01f25-4fee-40f8-9a73-a1e58bfad4b7`).
   - **8 módulos completos:** `Inicio`, `Usuarios`, `Registros e Ingresos`, `Ingresos y Pagos`, `Planes y Secciones`, `Soporte y Anuncios`, **`Estudio 300`** (`MarketStudyAdminPanel.tsx` + `adminStudyService.ts` con exportación CSV/JSON anonimizada) y `Analítica y Backend`.
3. **Servidor Express Node 22 ESM (`server.ts`):**
   - Ejecutable tanto en desarrollo (`npm run dev` -> `tsx server.ts`) como nativo en producción (`npm start` -> `NODE_ENV=production node server.ts`) en el puerto `3000` (`trust proxy = 1`, `express.json({ limit: '1mb' })`).
   - Endpoints clave:
     - `GET /api/health` y `GET /api/flags`
     - `GET /api/admin/system-info` (`requireAdmin`)
     - `POST /api/legal/consent-meta` (`requireAuth`, hash HMAC-SHA256 irreversible de IP sin almacenar IP en texto claro)
     - `POST /api/study/reminder-preview` (`requireAuth`, plantillas HTML escapadas contra XSS para días 7/14/21/30)
     - `GET /api/solver/meta` y `POST /api/solver/learn-from-users` (con `evLossPct` acotado `[0, 500]`)
     - `POST /api/solver/sync-internet` (`requireAdmin`), `POST /api/gemini/roadmap` y `POST /api/gemini/hand-review` (`requireAuth`).

---

### 2. ALEATORIEDAD REAL (CSPRNG), CERO REPETICIONES Y MOTOR MULTI-CALLE
1. **Semilla Dinámica y Barajado Sin Sesgo (`src/lib/random.ts` + `src/engine/handSimulator.ts`):**
   - Semilla dinámica de 128 bits generada directamente desde `Crypto.getRandomValues` (`generateDynamicCryptoSeed()`).
   - Índices aleatorios reales mediante *rejection sampling* uniforme (`pickTrueRandomDeckIndex()`, `cryptoRandomInt()`) eliminando sesgo de módulo y buffers secuenciales.
   - Historial anti-repetición persistente por usuario (`allin_sim_recent_hands_v1` de hasta 180 huellas recientes, más `allin_eval_seen_*` y `allin_academy_seen_*`).
2. **Bancos Educativos Sin Repeticiones (`src/engine/evaluationBank.ts` + `src/engine/academySpots.ts`):**
   - **720 preguntas en Evaluaciones** (`240` Modo Fijo + `240` Modo Por Niveles 1–4 + `240` Modo Variable Dinámico), seleccionadas priorizando no vistas en el ciclo actual/sesión, diversidad de categorías/conceptos y barajado **Fisher-Yates** tanto en el orden de preguntas como en las opciones.
   - **96 escenarios en Academia** (`ACADEMY_SCENARIO_BANK` + variantes), entregados mediante cola **Fisher-Yates** sin repetición intra-sesión, permutación de palos y opciones aleatorizadas.
3. **Juego y Análisis Completo Hasta Turn, River y Showdown (`src/engine/academyRunout.ts` + `TrainerModule.tsx` + `handSimulator.ts`):**
   - Siempre que ningún jugador foldee, toda mano en Academia (partiendo de Preflop, Flop o River) y en el Simulador avanza progresivamente por **Preflop -> Flop (3 cartas) -> Turn (4 cartas) -> River (5 cartas) -> Showdown de 7 cartas**.
   - Decisiones subóptimas no-fold registran su pérdida de EV y diagnóstico didáctico inmediato sin interrumpir el desarrollo completo de la mano ni el Showdown final.

---

### 3. DISEÑO SIMPLE, CLARO Y BARAJA GLOBAL SINCRONIZADA
1. **Lenguaje Visual Dark-Slate Editorial (`src/index.css`):**
   - Lienzo `#09090b`, tipografía dual `Plus Jakarta Sans` + `JetBrains Mono` con `.tabular-nums`, tarjetas limpias (`bg-neutral-900/55`, `border-neutral-800/80`, `shadow-sm shadow-black/30`), alta respirabilidad y jerarquía visual clara sin sobrecarga cognitiva.
2. **Baraja Unificada Personalizable (`src/lib/deckTheme.ts` + `DeckThemeContext.tsx` + `PlayingCard.tsx` + `UserSettingsModal.tsx`):**
   - Default global: **`classic_white` (Blanco Clásico 2 Colores)** compartido en Inicio, Mesa 6-Max en Vivo, Lab Studio, Wizard, Fundamentos, Academia, Evaluaciones y Replayer PT4/HM3.
   - 4 estilos intercambiables al instante en **Ajustes -> Baraja**: `classic_white`, `four_color_white`, `dark_pro`, `four_color_dark`, persistidos por `UID` localmente y en `users/{uid}.deckTheme`.

---

### 4. AISLAMIENTO PERSONALIZADO MULTI-USUARIO, SEGURIDAD ZERO-TRUST Y LEGALIDAD
1. **Aislamiento Total por `UID` (`src/lib/userStorage.ts` + `src/lib/cloudSync.ts`):**
   - Todo progreso local (ELO, XP, notas de exámenes, Reto 100 Manos, mazo SM-2, errores `>5% EV`, tarjetas personalizadas, TheTracker2 y Baraja) está prefijado por `UID` y sincronizado en Firestore (`hydrateLocalStateFromCloud` -> `runFullCloudSync`), evitando fugas entre cuentas en el mismo navegador.
2. **Reglas Firestore Endurecidas (`firestore.rules`):**
   - Default-deny global + esquema estricto de 8 pilares en todas las colecciones (`users`, `sm2Items`, `mistakes`, `userInvites`, `planConfigs`, `billingTransactions`, `platformAnnouncements`, `supportTickets`, `adminAuditLogs`, `featureFlags`, `studyCohorts`, `studyConsents`, `studyEnrollments`, `studyEvents`, `studyFeedback`).
   - Los propietarios no pueden auto-promover `planTier`, `role`, `planPermissions` ni cambiar su `status` de `waitlisted` a `active` fuera de la transacción atómica de cohorte (`studyEnrollments` solo permite conservar estado o pasar a `withdrawn`).
3. **Estudio de Mercado v1 (`market_study_v1`):**
   - **Cupos atómicos:** `allocateCohortSlotPure()` dentro de `runTransaction` garantiza máximo `100` activos por nivel; excedentes pasan a `waitlisted`.
   - **Densidad vs Permisos:** `FISH / REG / NIT` adapta únicamente densidad visual/didáctica (`admin_override > cohort_assignment > self_selected`), nunca permisos de suscripción.
   - **Cumplimiento Colombia Ley 1581/2012 & GDPR:** Mayoría de edad (`>= 18`), consentimiento v1.0 append-only con checkbox **no premarcado**, retención diferenciada (`180d` eventos / `365d` encuestas / `5 años` prueba legal), encuestas en días 7/14/21/30 (`NPS`, `Sean Ellis PMF`), retiro GDPR en cascada (`<= 30 días`) y exportación anonimizada.

---

### 5. CHECKLIST DE PRODUCCIÓN Y VERIFICACIÓN
- **Pruebas unitarias e integración (`npm test`):** Cobertura integral NLHE/DCFR, CSPRNG/Fisher-Yates, aislamiento por UID, Baraja + Runout Turn/River/Showdown y Market Study v1.
- **Compilación y tipado dual (`npm run lint:all` + `npm run build:all`):** Main app + Admin console sin errores TS ni warnings bloqueantes.
- **Arranque productivo nativo:** Validado con `NODE_ENV=production node server.ts` (`npm start`) y despliegue activo de `firestore.rules`.
