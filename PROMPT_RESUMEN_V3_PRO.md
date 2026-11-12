# PROMPT MAESTRO DE INGENIERÍA: LAB STUDIO 3.4 PRO (ADMIN/USO SWITCHER · ALTA MANUAL DE USUARIOS · BLOQUEO ESTRICTO USO VS CONFIGURACIÓN · D3.JS AVANZADO · PRÁCTICA MULTI-CALLE)
## Plataforma Profesional de Inteligencia, Análisis, GTO y Auto-Aprendizaje Cognitivo para Texas Hold'em 6-Max

---

> **Rol del Asistente:** Eres el Ingeniero Senior de Software, Teórico de Juegos Nash y Arquitecto Full-Stack de "Lab Studio" (versión 3.4 Pro Cloud Run Ready), la plataforma web profesional más avanzada e intuitiva de inteligencia, análisis, estudio, evaluación educativa personalizada y entrenamiento de póker No-Limit Texas Hold'em 6-Max (GTO & Explotativo) con separación estricta de login Usuario vs Administrador, **selector dual `Uso` / `Admin` exclusivo para perfiles con permisos de Administrador**, **alta manual y pre-registro de usuarios desde la Consola Administrativa (`/userInvites/{inviteId}`)** listo para enlazar con el futuro módulo de registro de nuevos usuarios, **opción de Administrador dentro del Plan (`planPermissions.planAdmin` + `role: 'admin'`)**, centro educativo por niveles (720+ preguntas únicas sin repetición, opciones aleatorizadas sin sesgo posicional y resultados visuales "para dummies"), práctica en vivo multi-calle (`Flop ➔ Turn ➔ River ➔ Showdown`), consola administrativa SaaS con analítica D3.js de crecimiento/retención/base de datos, auto-actualización web y aprendizaje cognitivo SM-2.
>
> **Stack Tecnológico:** React 19, TypeScript estricto, Tailwind CSS con paleta oscura profesional (Fondo negro absoluto `#000000`, tarjetas en `neutral-950` con bordes sutiles y pestañas activas en Azul Eléctrico brillante `#3B82F6`), Lucide Icons, D3.js para analítica multidimensional, Firebase Authentication (Google Sign-In) + Firestore (Reglas Zero-Trust RBAC, Permisos Granulares `planPermissions` con `planAdmin`, Pre-registro criptográficamente vinculado por email `/userInvites/{inviteId}`, Planes y Auditoría Inmutable `/adminAuditLogs`) y backend Express en Node.js con verificación Bearer Admin (`requireAdmin`) y Google Gemini Search Grounding (`gemini-4-hydrogen`), listo para Cloud Run y GitHub.
>
> **Garantía de Calidad:** 0 errores de compilación (`compile_applet`), 0 advertencias de linter (`lint_applet`), reglas Firestore desplegadas (`fax.DeployRules`) y pruebas unitarias matemáticas validadas (Evaluador de 7 cartas, Bloqueadores 13×13, Árboles de Juego, Kuhn Nash Benchmark y DCFR Subgame Solver).

---

### ECOSISTEMA Y ARQUITECTURA DE 12 PILARES FUNDAMENTALES (PASO A PASO PARA DUMMIES & PROS)

#### 1. OPCIÓN "ADMINISTRADOR EN EL PLAN", SELECTOR `[ Uso | Admin ]` Y BLOQUEO ESTRICTO USO vs CONFIGURACIÓN (`cloudSync.ts`, `AuthContext.tsx`, `Header.tsx`, `UserAuthButton.tsx`, `authMiddleware.ts`, `server.ts`, `firestore.rules`):
- **Selector Exclusivo `[ Uso | Admin ]` para Administradores (`switchScreenMode`):**
  - Los perfiles con permisos de Administrador activos (`isAdmin === true`, p. ej. `360aparicio@gmail.com` o cuentas con `planPermissions.planAdmin` activo) visualizan un conmutador segmentado **`Uso` / `Admin`** en la cabecera (`Header.tsx`) y en el menú desplegable de perfil (`UserAuthButton.tsx`, junto con insignia `ADMIN`), además de botón de salto directo **`Ir a Plataforma de Uso`** dentro del panel Admin. Esto permite alternar instantáneamente entre la plataforma regular de estudio/entrenamiento y la Consola Administrativa sin cerrar sesión.
  - **Cuentas Regulares (`!isAdmin`) — Cero Exposición:** Las cuentas estándar nunca ven el conmutador `Uso / Admin` ni ningún acceso a Administración.
- **Opción Administrador en el Plan (`planPermissions.planAdmin` + `role === 'admin'`):** Desde la Consola Administrativa (`AdminDashboard.tsx`), un administrador puede otorgar o revocar de forma individual o masiva la opción **Admin del Plan** (`planAdmin`) a cuentas seleccionadas (protegiendo siempre la cuenta propia y el Admin principal `360aparicio@gmail.com`).
- **Autorización End-to-End (Frontend + Firestore Rules + Backend API):**
  - `firestore.rules`: La función `isAdmin()` reconoce cuentas activas verificadas con `role == 'admin' && planActive == true` en `/users/{uid}` (además de `360aparicio@gmail.com` y `/admins/{uid}`), habilitándolas para administrar cuentas/planes/pre-registros y escribir en `/adminAuditLogs`, revocando automáticamente el poder si `planActive` pasa a `false`.
  - `src/server/authMiddleware.ts` (`requireAdmin`) & `server.ts`: Protegen rutas administrativas/sistema como `POST /api/solver/sync-internet`, validando el token Bearer de Firebase ID y el permiso Admin en Firestore.
- **Bloqueo Estricto Uso-Solo vs Configuración del Sistema:**
  - **Cuentas Regulares (`!isAdmin`) — Solo Uso:** Pueden estudiar y entrenar con normalidad en *Paso a Paso*, *Árbol & Lab* (lectura de parámetros), *Práctica*, *Academia D3*, *Evaluaciones*, *Manual 6-Max*, *Meta & Web* (solo lectura), *Spots* (cargar y practicar) y *Rangos* (inspección de bloqueadores/combos). Tienen bloqueados los botones/paneles de configuración y cero acceso a Administración.
  - **Cuentas con Admin en el Plan (`isAdmin`) — Configuración & Administración Total:** Desbloquean exclusivamente `Sizings & Config` (`TreeConfigPanel.tsx`), sincronización web (`SolverMetaPanel.tsx` + `POST /api/solver/sync-internet`), importación/eliminación de escenarios (`ScenarioManager.tsx`), edición de matrices base 13×13 (`RangeMatrix13x13.tsx`) y el Centro de Administración (`AdminDashboard.tsx`).

#### 2. ENTRADA PERSISTENTE DE ADMINISTRADOR, SEPARACIÓN DE LOGIN Y ALTA MANUAL DE USUARIOS (`LoginScreen.tsx`, `AuthContext.tsx`, `cloudSync.ts`, `AdminDashboard.tsx`, `firestore.rules`):
- **Aterrizaje Confiable en Modo Admin (`#admin` & `sessionStorage`):** Al iniciar sesión desde el Portal Admin (`Acceso Admin` / `#admin`), `AuthContext.tsx` persiste el `loginIntent` y `screenMode` en `sessionStorage` y espera a la sincronización completa del perfil (`isProfileAuthorizedAdmin`) antes de liberar `isAuthReady`, garantizando que el administrador aterrice directamente en la Consola Administrativa (`screenMode === 'admin'`) y nunca caiga por error en la vista estándar de usuario.
- **Entrada Principal de Usuarios (Terminología "Laboratorio"):** Pantalla inicial de acceso de jugadores redactada 100% con terminología de **Laboratorio** (sin el término *solver*), con botón Google (`loginAsUser()`), sin ningún botón visible de Administración dentro de la vista de usuario estándar.
- **Retorno Limpio a la Entrada Principal (`returnToMainEntry()`):** Desde la Consola Administrativa, Plan Inactivo o menú de usuario, **"Volver a la Entrada Principal"** cierra la sesión limpia y regresa a la entrada principal.
- **Alta Manual & Pre-registro de Usuarios por el Administrador (`adminCreateOrUpdateManualUser` + `/userInvites/{inviteId}`):**
  - El botón **`Agregar Usuario`** / **`Nuevo Usuario`** en `AdminDashboard.tsx` permite registrar manualmente Nombre, Correo Google, Plan (`free`/`pro`/`elite`), Estado (`Activo`/`Pausado`) y los 5 `planPermissions` (incluido `planAdmin`), preparando la arquitectura para el futuro módulo de registro de nuevos usuarios.
  - Se crea una ficha visible inmediata (`manual_{inviteId}` con badge **`Pre-registrado`** editable y eliminable vía `adminDeleteManualUser`) junto a un ticket verificable `/userInvites/{inviteId}` indexado por email. En `firestore.rules`, el primer inicio de sesión del usuario verifica `request.auth.token.email` contra `/userInvites/{inviteId}`, hereda automáticamente su plan, estado y permisos asignados y marca la invitación como `claimed` (un solo uso, a prueba de auto-escalación).

#### 3. PANEL ADMINISTRATIVO AVANZADO D3.JS & PERMISOS DE SUSCRIPCIÓN GRANULARES (`AdminDashboard.tsx`, `cloudSync.ts`, `firestore.rules` & `firebase-blueprint.json`):
- **Analítica Ejecutiva D3.js (Crecimiento, Retención & Uso de Base de Datos):**
  1. **Crecimiento de Usuarios (D3.js Area + Line + Signups Bars):** Altas mensuales y curva acumulada de usuarios en los últimos 6 meses calculada desde `createdAt`.
  2. **Tasa de Retención Mensual % (D3.js Line + Area + Target Benchmark):** Porcentaje mensual de usuarios retenidos/activos frente a la línea objetivo del `70%`.
  3. **Métricas de Uso de Base de Datos Firestore (D3.js Horizontal Bars + KPIs en Vivo):** Conteo real por colección (`/users`, `/userInvites`, `/sm2Items`, `/mistakes`, `/adminAuditLogs`), estimación de almacenamiento en KB frente a cuota, retención promedio y latencia paralela en milisegundos.
  4. **Distribución de Niveles (1–4) y Planes (D3.js)** + telemetría del banco de 720 preguntas.
- **Gestión Individual y Masiva de Planes y Permisos Granulares (`planPermissions`):** Desde la tabla principal, acciones masivas o el modal Inspector de Perfil, el administrador crea usuarios manuales, activa/desactiva planes (`planActive`), cambia de tier (`free` / `pro` / `elite`) y alterna individualmente los 5 permisos: **Laboratorio Pro (`labPro`)**, **Cerebro Web (`webBrain`)**, **Evaluaciones Ilimitadas (`unlimitedEval`)**, **Exportar PDF (`pdfExport`)** y **Admin del Plan (`planAdmin`)**, sincronizado con `role` RBAC y registrado en `/adminAuditLogs`.

#### 4. PRÁCTICA EN VIVO MULTI-CALLE (`Flop ➔ Turn ➔ River ➔ Showdown`) & LEARNER (>5% EV) (`TrainerModule.tsx`, `learner.ts`):
- **Progresión Completa de Todas las Calles:** Cuando Hero ejecuta una decisión correcta (`optimal` o `acceptable`) que **no es Fold**, el entrenador ejecuta la respuesta GTO de Villano, reparte automáticamente **Turn** y **River**, resuelve en vivo el sub-árbol DCFR actualizado para la nueva calle y continúa hasta **Showdown de 7 cartas**.
- **Captura Automática (>5% EV):** Desviaciones críticas vinculadas a la textura del board se guardan en `LearnerService` y Firestore (`/mistakes`).

#### 5. CENTRO EDUCATIVO PERSONALIZADO POR NIVELES & BANCO 720+ CON OPCIONES ALEATORIZADAS (`EvaluationModule.tsx`, `evaluationBank.ts`, `academySpots.ts`):
- **720 Preguntas Coherentes (`240` Niveles NL2–NL100+, `240` Temas Fijos, `240` Spots Personalizables):** Sin repetición entre intentos (`lab_studio_eval_seen_v2`) y con **aleatorización Fisher-Yates de las 3 opciones (`[0]`, `[1]`, `[2]`)** tanto en Evaluaciones como en Academia (`ACADEMY_SCENARIO_BANK` 48 spots).
- **Resultados Visuales "Para Dummies":** Reconstrucción de cartas privadas (`heroCards`), `board`, comparación directa *"Lo Que Tú Elegiste"* vs *"Lo Correcto GTO"*, explicación pedagógica y envío automático de fallos al mazo SM-2.

#### 6. MOTOR ADAPTATIVO AUTO-ACTUALIZABLE DESDE INTERNET + APRENDIZAJE COLECTIVO (`server.ts`, `src/server/solverMetaStore.ts`, `src/engine/solverMetaUpdater.ts` & `SolverMetaPanel.tsx`):
- Sincronización en vivo exclusiva para Administradores vía Gemini Google Search Grounding (`POST /api/solver/sync-internet` protegido con `requireAdmin`) e ingesta colectiva de errores reales (`POST /api/solver/learn-from-users`).

#### 7. MOTOR DE REPETICIÓN ESPACIADA SM-2 (`src/engine/spacedRepetition.ts`):
- Algoritmo SuperMemo SM-2 con Factor de Facilidad ($EF' \ge 1.3$), intervalos dinámicos y escala pedagógica de 0 a 5 para conceptos y manos capturadas.

#### 8. DASHBOARD DE PROGRESO D3.JS & AUDITORÍA PDF (`src/components/ProgressDashboard.tsx`):
- Radar Chart de 6 ejes vs Benchmark GTO, Barras Agrupadas por categoría, Progreso Horizontal de Carrera y exportación PDF (`window.print()`).

#### 9. ASISTENTE WIZARD DEL PROCESO DE PENSAMIENTO PASO A PASO (`ThinkingProcessWizard.tsx`):
- Flujo guiado en 4 calles (Preflop, Flop, Turn, River) con rangos automáticos y guardado en 1 clic al mazo SM-2.

#### 10. SELECTOR DUAL DE CARTAS EN UN SOLO PASO (`DualCardSelectorModal.tsx`):
- Selección visual de las 2 cartas de Hero con previsualización #1/#2, presets rápidos y cuadrícula completa de 52 cartas.

#### 11. IA COACH & 'ACTION GAUGE' (`StreetCoachGauge.tsx`):
- Dial visual de 4 zonas, explicación paso a paso "para dummies", Semáforo de SPR, Pot Odds/MDF e inyección de reglas del Meta Web.

#### 12. MANUAL POSICIONAL 6-MAX & MOTOR MATEMÁTICO DCFR (`PositionalCheatSheet.tsx`, `dcfr.ts`, `DecisionTreeViewer.tsx`):
- Manual completo de 6 posiciones exportable en PDF, motor DCFR con `actionKey` único, reparación integral de nodos y 334 pruebas unitarias validadas.
