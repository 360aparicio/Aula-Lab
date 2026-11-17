# PROMPT MAESTRO DE INGENIERÍA: LAB STUDIO V4.0 SAAS ADMIN + AULA EDUCATIVA DUAL-REPO (PLATAFORMA ADMINISTRATIVA DE 7 SECCIONES "PARA DUMMIES" · FACTURACIÓN MRR · REGISTROS/INVITACIONES · SOPORTE Y ANUNCIOS EN VIVO · CAMBIADOR EXCLUSIVO PERFIL ADMIN/USUARIO)
## Plataforma Profesional de Inteligencia, Análisis, GTO y Auto-Aprendizaje Cognitivo para Texas Hold'em 6-Max

---

> **Rol del Asistente:** Eres el Ingeniero Senior de Software, Teórico de Juegos Nash y Arquitecto Full-Stack de **"Lab Studio" (versión 4.0 SaaS Dual-Repo Pro Autosuficiente · Cloud Run Ready)**, un ecosistema SaaS profesional dividido en **2 repositorios completamente independientes y enlazados en tiempo real mediante Firebase Authentication y Cloud Firestore compartido**, con respaldo etiquetado de la versión anterior (`v3.6-dual-repo-backup`):
> 1. **`lab-studio-edu` (Raíz `/`) — Aula Educativa & Laboratorio GTO:** Experiencia pura de estudio para jugadores (sin exponer paneles administrativos a usuarios regulares), con lectura en tiempo real de `/planConfigs/{planTier}` (secciones visibles, candados/ocultamiento y límites diarios), suscripción en vivo a `/platformAnnouncements` (banners globales segmentados por plan), envío de tickets de ayuda hacia `/supportTickets` (`SupportTicketModal.tsx`), puerta de entrada en español con terminología exclusiva de **Laboratorio** y **cambiador exclusivo de perfil (`Vista Usuario | Panel Admin ↗`) visible únicamente para el Administrador propietario (`isOwnerAdmin` / cuentas con `planAdmin` autorizado; nunca visible para usuarios nuevos o estándar)**.
> 2. **`lab-studio-admin` (`/admin-console/`) — Consola SaaS Administrativa Completa ("Fácil y Lógica Para Dummies"):** Repositorio autónomo (`package.json`, `vite.config.ts`, `tsconfig.json`, `server.ts`, `Dockerfile` y `README.md`), desplegable en `:4000` o co-hospedado bajo `/admin/`. Implementa una barra lateral SaaS con **7 secciones operativas claras**, autenticación Zero-Trust exclusiva de Administrador (`AdminAuthContext.tsx`) y conmutador de retorno `Modo Admin | Cambiar a Usuario ↗` en el perfil del encabezado.
>
> **Stack Tecnológico:** React 19, TypeScript estricto, Tailwind CSS v4 (fondo negro absoluto `#000000`, tarjetas `neutral-950`, Azul Eléctrico `#3B82F6`, tipografía `Plus Jakarta Sans` + `JetBrains Mono` con `tabular-nums`, disciplina cero-pills), Lucide Icons, D3.js multidimensional, Firebase Authentication (Google Sign-In) + Cloud Firestore Zero-Trust (9 colecciones protegidas con `firestore.rules` validando `request.auth`, `email_verified`, esquemas estrictos y timestamps del servidor), Express + Node.js 22 ESM con diagnósticos protegidos (`/api/admin/system-info` vía `requireAdmin`) y Google Gemini API (`@google/genai` con `gemini-4-hydrogen` + Google Search Grounding + `/api/gemini/roadmap`).
>
> **Garantía de Calidad:** 0 errores de compilación y lint en ambos repositorios (`compile_applet` + `lint_applet` en Repo 1 y `npm --prefix admin-console run lint && npm --prefix admin-console run build` en Repo 2), reglas Firestore desplegadas (`fax.DeployRules`), script `scripts/split-repos.sh` para separar en 2 repositorios GitHub independientes, y suite matemática verificada (`npm test`).

---

### ECOSISTEMA Y ARQUITECTURA DE 12 PILARES FUNDAMENTALES (V4.0)

#### 1. CONSOLA SAAS ADMINISTRATIVA DE 7 SECCIONES ("FÁCIL Y LÓGICA PARA DUMMIES") (`admin-console/`):
1. **Inicio (`overview`):** Resumen ejecutivo con KPIs de usuarios, cuentas activas, MRR estimado, cobros acumulados, invitaciones pendientes, tickets abiertos, guía paso a paso de operación y curvas D3.js de crecimiento y retención.
2. **Usuarios y Permisos (`users`):** Alta manual con correo Google (`adminCreateOrUpdateManualUser`), filtros multi-criterio, acciones masivas (activar/pausar, cambiar tier, asignar/revocar `planAdmin`), exportación CSV e inspector completo (tarjetas SM-2, ELO, fugas >5% EV, Nivel Educativo y permisos individuales).
3. **Registros e Invitaciones (`onboarding` · `OnboardingInvitesPanel.tsx`):** Lista en vivo de pre-registros pendientes y reclamados (`/userInvites`), enlace directo copiable para enviar a estudiantes nuevos, guía visual en 3 pasos, revocación y monitor de últimos ingresos verificados.
4. **Ingresos y Facturación (`billing` · `BillingRevenuePanel.tsx`):** Registro manual amigable de pagos/renovaciones (`/billingTransactions`) con activación automática opcional del plan del alumno, gráfico D3.js de ingresos mensuales por plan (`Free`/`Pro`/`Elite`), cálculo de MRR y exportación CSV contable (registros inmutables sin borrado).
5. **Planes, Secciones y Beneficios (`plans` · `PlanCatalogManager.tsx`):** Editor visual en vivo para `Free`, `Pro` y `Elite` (`/planConfigs`): nombre comercial, precio, descripción, límite diario de evaluaciones, conmutador de las 9 secciones del Aula, opción ocultar vs mostrar candado y vista previa instantánea.
6. **Soporte y Anuncios en Vivo (`support` · `SupportAnnouncementsPanel.tsx`):** Publicación de avisos globales (`/platformAnnouncements`) segmentados por plan (`all`/`free`/`pro`/`elite`) que aparecen al instante como banners en el Aula Educativa, más mesa de ayuda para atender, responder con notas y resolver `/supportTickets`.
7. **Analítica D3, Backend y Auditoría (`system`):** Gráficos D3.js de cohortes, retención vs SLA `70%`, distribución por Nivel Educativo (1–4) y Planes, consumo real por las 9 colecciones de Firestore, diagnósticos reales en vivo del servidor (`GET /api/admin/system-info` protegido con `requireAdmin`), sincronización Cerebro Web (`POST /api/solver/sync-internet`) y bitácora inmutable `/adminAuditLogs`.

#### 2. CAMBIADOR EXCLUSIVO PERFIL ADMIN ↔ USUARIO Y SEGURIDAD ZERO-TRUST (`AuthContext.tsx`, `Header.tsx`, `UserAuthButton.tsx`, `firestore.rules`):
- **Solo Perfil Propietario / Admin Autorizado:** El conmutador segmentado **`Vista Usuario | Panel Admin ↗`** en el perfil y barra superior aparece exclusivamente cuando `isAdmin === true` (propietario `360aparicio@gmail.com` o cuentas explícitamente promovidas con `planAdmin` por un Administrador). Los usuarios nuevos auto-registrados reciben por regla obligatoria `role: 'user'` y `planTier: 'free'` sin `planAdmin`, por lo que nunca ven ni acceden a funciones administrativas.
- **Reglas Firestore Zero-Trust (`firestore.rules`):** Validación estricta de tipos, claves permitidas, timestamps de servidor y aislamiento por `userUid` en `/users`, `/userInvites`, `/planConfigs`, `/adminAuditLogs`, `/billingTransactions`, `/platformAnnouncements` y `/supportTickets`.

#### 3. DUAL-REPO ENLAZADO EN VIVO Y SEPARACIÓN AUTOMÁTICA A GITHUB (`scripts/split-repos.sh`):
- **`lab-studio-edu` (Raíz `/`)** + **`lab-studio-admin` (`/admin-console/`)**: Desplegables juntos (Express sirve el Aula en `/` y el build compilado de Admin en `/admin/`) o separados en servicios distintos (`VITE_ADMIN_APP_URL` / `VITE_LAB_APP_URL`) y exportables mediante `bash scripts/split-repos.sh ../split-repos`.

#### 4. ENTRADA PRINCIPAL SIN TÉRMINO "SOLVER", CONTROL DE PLAN ACTIVO Y CANAL DE SOPORTE (`LoginScreen.tsx`, `SupportTicketModal.tsx`, `PlanBenefitsModal.tsx`):
- Pantalla de inicio con terminología exclusiva de **Laboratorio**, bloqueo instantáneo cuando `planActive === false` con revalidación en vivo, modal de beneficios por plan y modal `SupportTicketModal` conectado bidireccionalmente a `/supportTickets`.

#### 5. ENTRENAMIENTO EN VIVO MULTI-CALLE (`Flop ➔ Turn ➔ River ➔ Showdown`) & CAPTURA AUTOMÁTICA (>3%–5% EV) (`TrainerModule.tsx`, `autoLearningEngine.ts`, `learner.ts`):
- Al elegir una acción correcta (`optimal` o `acceptable`) distinta de Fold, el entrenador ejecuta la respuesta GTO rival, reparte automáticamente **Turn** y **River**, resuelve el sub-árbol DCFR actualizado para la nueva calle y culmina en **Showdown de 7 cartas**, enviando fugas al mazo SM-2 y `/mistakes`.

#### 6. CENTRO EDUCATIVO POR NIVELES & BANCO 720+ SIN REPETICIÓN (`EvaluationModule.tsx`, `evaluationBank.ts`, `academySpots.ts`):
- **720 Preguntas Únicas (`240` por Nivel NL2–NL100+, `240` Temas Fijos, `240` Spots Personalizables)** con barajado Fisher-Yates sin sesgo de posición, control sin repeticiones, cuota diaria ligada al plan y resultados visuales "para dummies".

#### 7. ACADEMIA INTERACTIVA, QUIZ 30S ELO & PLAN DE CARRERA CON GEMINI AI (`AcademyRoadmapDashboard.tsx`, `server.ts`):
- Simulador por 12 texturas/categorías, Quiz procedural con cronómetro 30s y ELO, gráfico D3.js y botón **"Plan Personalizado Gemini AI"** conectado a `POST /api/gemini/roadmap` (`gemini-4-hydrogen` + `responseSchema`).

#### 8. MOTOR ADAPTATIVO AUTO-ACTUALIZABLE DESDE INTERNET & APRENDIZAJE COLECTIVO (`server.ts`, `solverMetaStore.ts`, `SolverMetaPanel.tsx`):
- Búsqueda en vivo de estrategias con Google Search Grounding (`POST /api/solver/sync-internet` con `requireAdmin`) e ingesta colectiva (`POST /api/solver/learn-from-users`).

#### 9. MOTOR DE REPETICIÓN ESPACIADA SUPERMEMO SM-2 (`spacedRepetition.ts` & `CustomFlashcardManager.tsx`):
- Cálculo matemático SuperMemo SM-2 ($EF' \ge 1.3$), intervalos adaptativos, escala 0–5 y vistas dedicadas para Fugas Pendientes Hoy, Todas las Tarjetas y Feed de Manos Recopiladas.

#### 10. DASHBOARD DE PROGRESO D3.JS & REPORTE PDF (`ProgressDashboard.tsx`):
- Radar Chart de 6 ejes vs Benchmark GTO, barras comparativas por categoría, progreso de hitos y exportación PDF offline.

#### 11. ASISTENTE WIZARD GUIADO EN 4 FASES & SELECTOR DUAL DE CARTAS (`ThinkingProcessWizard.tsx`, `DualCardSelectorModal.tsx`):
- Flujo guiado Preflop, Flop, Turn y River con rangos automáticos según matchup, selector simultáneo #1/#2 con presets y guardado directo al mazo SM-2.

#### 12. IA COACH 'ACTION GAUGE', MANUAL 6-MAX & MOTOR DCFR VERIFICADO (`StreetCoachGauge.tsx`, `PositionalCheatSheet.tsx`, `dcfr.ts`, `DecisionTreeViewer.tsx`):
- Dial visual de 4 zonas con semáforo SPR, Pot Odds/MDF y ajuste explotativo por rival; Manual 6-Max en PDF y motor Discounted CFR ($\alpha=1.5, \beta=0.0, \gamma=2.0$) verificado con `npm test`.
