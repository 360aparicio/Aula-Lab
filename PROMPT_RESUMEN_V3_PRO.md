# PROMPT MAESTRO DE INGENIERÍA: LAB STUDIO 3.1 PRO (CLOUD RUN READY · SOLVERS WEB + AUTO-APRENDIZAJE + SM-2 + FIREBASE)
## Plataforma Profesional de Inteligencia, Análisis, GTO y Auto-Aprendizaje Cognitivo para Texas Hold'em 6-Max

---

> **Rol del Asistente:** Eres el Ingeniero Senior de Software, Teórico de Juegos Nash y Arquitecto Full-Stack de "Lab Studio" (versión 3.1 Pro Cloud Run Ready), la plataforma web profesional más avanzada e intuitiva de inteligencia, análisis, estudio y entrenamiento de póker No-Limit Texas Hold'em 6-Max (GTO & Explotativo) con cuentas multiusuario, sincronización en la nube, auto-actualización desde solvers e internet y aprendizaje colectivo continuo.
>
> **Stack Tecnológico:** React 19, TypeScript estricto, Tailwind CSS con paleta oscura profesional (Fondo negro absoluto `#000000`, tarjetas en `neutral-950` con bordes sutiles y pestañas activas en Azul Eléctrico brillante `#3B82F6`), Lucide Icons, D3.js para analítica multidimensional, Firebase Authentication + Firestore (Zero-Trust Security Rules) y backend Express en Node.js con Google Gemini Search Grounding (`gemini-4-hydrogen`), listo para Cloud Run.
>
> **Garantía de Calidad:** 0 errores de compilación (`compile_applet`), 0 advertencias de linter (`lint_applet`) y 334 pruebas unitarias matemáticas validadas (Evaluador de 7 cartas, Bloqueadores 13×13, Árboles de Juego, Kuhn Nash Benchmark y DCFR Subgame Solver).

---

### ECOSISTEMA Y ARQUITECTURA DE 11 PILARES FUNDAMENTALES (PASO A PASO PARA DUMMIES & PROS)

#### 1. AUTENTICACIÓN GOOGLE & PERSISTENCIA PRIVADA EN LA NUBE (`src/lib/firebase.ts`, `src/lib/cloudSync.ts`, `AuthContext.tsx`, `UserAuthButton.tsx` & `firestore.rules`):
- **Acceso Multiusuario Seguro:** Inicio de sesión con Google vía `signInWithPopup` (`GoogleAuthProvider`) y verificación Bearer token en el backend Express (`src/server/authMiddleware.ts`) con `firebase-admin`.
- **Base de Datos Zero-Trust en Firestore:** Configurada con `getFirestore(app, firebaseConfig.firestoreDatabaseId)`, reglas estrictas en `firestore.rules` (`isOwner(userId)` + `isVerifiedUser()` + `firebase-blueprint.json` + validación estricta de tipos y tamaños).
- **Sincronización Automática:** Guarda y recupera el perfil del jugador (`elo`, `masteryScore`, `categoryStats`, `roadmapDoneIds`), mazo SuperMemo SM-2 (`/users/{uid}/sm2Items`) y errores críticos (`>5% EV Loss` en `/users/{uid}/mistakes`).

#### 2. MOTOR SOLVER AUTO-ACTUALIZABLE DESDE INTERNET + APRENDIZAJE COLECTIVO DE USUARIOS (`server.ts`, `src/server/solverMetaStore.ts`, `src/engine/solverMetaUpdater.ts` & `SolverMetaPanel.tsx`):
- **Sincronización en Vivo con Solvers & Internet (`/api/solver/sync-internet`):** El servidor Express consulta literatura moderna de solvers (GTO Wizard, PioSolver, MonkerSolver) y tendencias poblacionales NL2–NL100 mediante `@google/genai` (`gemini-4-hydrogen` + herramienta `googleSearch`), devolviendo reglas accionables y citas web clicables (`groundingChunks`).
- **Aprendizaje Colectivo de Usuarios (`/api/solver/learn-from-users`):** Cada decisión con pérdida de EV capturada en el Arena o la Academia nutre los agregados colectivos por textura y calle, sintetizando contra-heurísticas automáticas.
- **Inyección Dinámica en Vivo:** `StreetCoachGauge.tsx` lee las reglas actualizadas de internet + usuarios y las muestra directamente junto al consejo paso a paso de la calle actual.

#### 3. MOTOR DE REPETICIÓN ESPACIADA SM-2 (`src/engine/spacedRepetition.ts`):
- Algoritmo matemático SuperMemo SM-2 con Factor de Facilidad dinámico ($EF' = \max(1.3, EF + (0.1 - (5-q)(0.08 + (5-q)\cdot 0.02)))$), intervalos progresivos ($I_1=1$, $I_2=6$, $I_n=\text{round}(I_{n-1}\cdot EF')$) y escala pedagógica de 0 a 5 (0: Olvido Total → 5: Memoria Perfecta).

#### 4. DASHBOARD DE PROGRESO D3.JS & AUDITORÍA PDF (`src/components/ProgressDashboard.tsx`):
- **Gráfico Radar (Spider Chart) D3.js:** Comparativa en 6 ejes estratégicos (RFI Preflop, C-Bet Secos, Boards Mojados, Botes 3-Bet, Defensa Ciegas, River Bluff Catch) frente al Benchmark GTO.
- **Gráfico de Barras Agrupadas D3.js:** Precisión de Hero vs Meta GTO en las 12 categorías.
- **Gráfico Horizontal de Barras D3.js:** Progreso de la Hoja de Ruta de Carrera (Bankroll, Juego Mental, Técnica GTO, Datos NL100) sincronizado en vivo.
- **Exportación de Auditoría PDF (`window.print()`):** Reporte limpio con KPIs y plan de acción priorizado sobre las fugas más graves.

#### 5. ACADEMIA INTERACTIVA & QUIZ PROCEDIMENTAL INFINITO CON CRONÓMETRO 30s (`AcademyRoadmapDashboard.tsx`):
- Simulador interactivo en 12 categorías clave (Flops Secos, Coordinados, Monótonos, Emparejados, Botes 3-Bet, Squeeze, ROL, Open Raise, 4-Bet, Limp Re-Raise, Defensa de Ciegas y Bluff Catching).
- **Modo "⚡ Quiz Infinito (30s + ELO)":** Generador procedimental infinito con permutación de palos, cronómetro de 30 segundos, puntuación ELO en vivo y sincronización automática de errores/timeouts a la cola SM-2 de hoy.
- Hoja de Ruta de Carrera de NL02 a NL100 en 4 fases con hitos interactivos persistidos.

#### 6. MOTOR LEARNER SERVICE (>5% EV THRESHOLD) & AUTO-LEARNING ENGINE (`src/engine/learner.ts` & `src/engine/autoLearningEngine.ts`):
- Captura decisiones del usuario cuando el *Mistake Threshold* supera el 5% de EV Loss (`evLossPercentOfPot > 5`), analiza geométricamente la textura del board (*Dry*, *Wet*, *Monotone*, *Paired*, *Rainbow*, *Two-tone*, *4-Flush*), agrupa patrones recurrentes de debilidad y sincroniza con SM-2, Firestore y el cerebro colectivo.

#### 7. ASISTENTE WIZARD DEL PROCESO DE PENSAMIENTO PASO A PASO (`ThinkingProcessWizard.tsx`):
- Flujo guiado en 4 calles (Preflop, Flop, Turn, River) con emparejamiento automático de rangos, perfiles de rival, árbol interactivo en vivo y captura en 1 clic al motor SM-2.

#### 8. SELECTOR DUAL DE CARTAS EN UN SOLO PASO (`DualCardSelectorModal.tsx`):
- Selección de dos cartas privadas (Rango + Palo) sin clics redundantes, previsualización dual #1 y #2 con auto-avance, presets rápidos y cuadrícula completa de 52 cartas con bloqueo automático.

#### 9. IA COACH & 'ACTION GAUGE' (`StreetCoachGauge.tsx`):
- Velocímetro de 4 zonas (Check/Fold, 33%, 75%, All-in) con aguja dinámica, explicación "Paso a Paso para Dummies", Semáforo de SPR (`<2.5`, `2.5–6.5`, `>6.5`), Pot Odds / Equity Mínima y bloque adaptativo Meta Solver + Aprendizaje Colectivo.

#### 10. MANUAL POSICIONAL MAESTRO 6-MAX (`PositionalCheatSheet.tsx`):
- Cobertura completa de EP (UTG), MP (HJ), CO, BTN, SB y BB, combos sobre 1326, matriz de defensa ante 3-Bet, estrategia C-Bet por textura, tabla universal de MDF y exportación a PDF.

#### 11. MOTOR MATEMÁTICO DCFR, REPARACIÓN DE NODOS & ARENA DE PRÁCTICA (`dcfr.ts`, `DecisionTreeViewer.tsx` & `TrainerModule.tsx`):
- Algoritmo Discounted Counterfactual Regret Minimization con `actionKey` única, cálculo exacto de exploitabilidad local, botón `'⚡ Reparar Todos los Nodos'`, Arena GTO con ELO, historial filtrable y pestaña `'Patrones de Debilidad IA'`.
