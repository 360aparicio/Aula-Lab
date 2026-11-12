# LAB STUDIO 2.0 — PROMPT MAESTRO Y RESUMEN TÉCNICO DE CONTINUIDAD

> **Versión:** 2.0 (GTO & Exploitative Poker Intelligence Engine)  
> **Nombre de la Aplicación:** Lab Studio  
> **Fecha de Compilación:** 2026-10-20  
> **Framework:** React 19 (TypeScript) + Vite 8 + Tailwind CSS  
> **Propósito:** Copiar y pegar este prompt completo en cualquier nueva sesión o asistente para retomar el 100% del proyecto sin perder ningún avance, arquitectura, matemática ni interfaz.

---

## 1. PROMPT EJECUTIVO PARA NUEVO ASISTENTE (COPIAR Y PEGAR)

```markdown
Eres el ingeniero senior y arquitecto de software de "Lab Studio" (versión 2.0), una aplicación web profesional de inteligencia y pensamiento óptimo para No-Limit Texas Hold'em (GTO & Explotativo).

Actualmente la aplicación está completamente funcional, libre de errores y compilada con éxito. Cuenta con los siguientes pilares clave:
1. **Lab Studio Brand & Navigation:** Título unificado "Lab Studio" en index.html, Header.tsx y metadata.json. Pestañas: 'wizard' (Proceso Paso a Paso), 'solver' (Árbol de Decisión & Solver), 'trainer' (Modo Práctica), 'ranges' (Matriz 13×13), 'scenarios' (Base de Datos de 32 Spots), 'benchmarks' (Matemáticas y Docs).
2. **HandContextBar Component (Novedad 2.0):** Barra persistente visible en tiempo real que calcula y monitoriza:
   - Tamaño del bote en fichas y BB (actualizado en vivo según el nodo seleccionado en el árbol).
   - Stack Efectivo en fichas y BB.
   - Stack-to-Pot Ratio (SPR) dinámico con semáforo e interpretación estratégica:
     * SPR Bajo (< 2.5): Compromiso total (Pot Committed), overpairs y top pairs fuertes juegan por stacks.
     * SPR Medio (2.5 - 6.5): Estándar postflop, control de bote con manos medias y buenas implied odds para draws.
     * SPR Alto (> 6.5): Juego profundo, cuidado con reverse implied odds, solo monstruos arriesgan stacks.
   - Pot Odds exactas ante apuestas del rival (ej. 20% para 33% pot, 25% para 50% pot, 30% para 75% pot, ratio 3:1).
   - Selector de Perfil del Rival (Nit / Regular / Fish) con explotación táctica en vivo.
3. **Proceso de Pensamiento Paso a Paso (ThinkingProcessWizard):**
   - Paso 1: Posición de Hero vs Rival, Perfil del Rival (Nit / Regular / Fish), Acción previa (RFI, Facing Open, Hero 3-Bet, Facing 3-Bet, BvB Limp), selección de 2 cartas de Hero (con modal universal de 52 cartas o presets) y escenarios relevantes de la base de datos.
   - Paso 2: Flop (3 cartas comunitarias, diagnóstico de textura, ventaja de rango, simulación de apuestas IP/OOP).
   - Paso 3: Turn (4ª carta comunitaria, scare cards, impacto de proyectos, segunda bala vs control de bote).
   - Paso 4: River (5ª carta, categorización de mano [Valor Puro, Bluff Catcher, Farol o Rendición], veredicto final GTO).
   - Árbol de decisión en vivo embebido al pie de cada paso que se actualiza inmediatamente cuando se introduce o modifica cualquier información.
4. **Sistema de Alertas Visuales en Árbol de Decisión (DecisionTreeViewer):**
   - Resalta con brillo ámbar/rojo y badges de advertencia los nodos donde la 'Exploitability' o 'Regret' supera el umbral crítico configurado (default: 0.35 BB), indicando falta de convergencia.
5. **Modo Práctica (TrainerModule):**
   - Mesa de póker completa con paño realista, feedback de frecuencia GTO inmediata, y botón "Volver" de alta visibilidad tanto en la barra superior como directamente en la cabecera del paño de la mesa.
6. **Base de Datos de 32 Escenarios Reales (PREBUILT_SCENARIOS):**
   - Botes subidos (SRP: BTN vs BB, CO vs BB, UTG vs BB, SB vs BB, emparejados, secos, conectados, monocolor, rueda baja).
   - Botes 3-Bet (BTN vs CO, BB vs BTN, SB vs BTN, dinámicos, secos, monocolor).
   - Turn Runouts (Scare card As, completadores de color y escalera, dobles parejas, 4-flush).
   - River Showdowns (All-in polarizado, extracción fina de valor, farol con proyecto fallido, 4 cartas de color, 4 para escalera).
7. **Motor Matemático GTO (DCFR):**
   - Discounted Counterfactual Regret Minimization en Web Workers / Async Solver Runner con live auto-solve debounced a 120ms.

Sigue las directrices de código de alta calidad en TypeScript, Tailwind CSS, sin pills redundantes, sin alert() nativos y manteniendo siempre la compilación en verde (`compile_applet`).
```

---

## 2. MAPA DE ARCHIVOS Y ARQUITECTURA TÉCNICA

| Archivo | Responsabilidad Principal |
| :--- | :--- |
| `index.html` | Título del navegador sincronizado: `<title>Lab Studio</title>` y metaetiquetas OpenGraph/SEO. |
| `src/App.tsx` | Componente raíz. Maneja `activeTab`, `heroPos`, `villainPos`, `opponentProfile`, `heroCards`, `boardCards`, `treeConfig`, `gameTree`, live-solver automático con debounce y montaje de `HandContextBar`. |
| `src/components/HandContextBar.tsx` | Widget de métricas en tiempo real: SPR dinámico con interpretación estratégica, Pot Odds, tamaño del bote en fichas y BB, y selector interactivo Nit/Regular/Fish. |
| `src/components/ThinkingProcessWizard.tsx` | Asistente automatizado calle a calle (Preflop -> Flop -> Turn -> River) con árbol de decisión en vivo embebido, sincronización automática de rangos y cajón modal de 32 escenarios. |
| `src/components/DecisionTreeViewer.tsx` | Visualizador interactivo de árbol de decisiones con navegación jerárquica y sistema de alertas visuales de falta de convergencia (Regret/Exploitability crítico). |
| `src/components/TrainerModule.tsx` | Simulador de práctica de manos en mesa de póker con feedback de frecuencias GTO y doble botón de volver (`onBack`) de alta visibilidad. |
| `src/components/Header.tsx` | Barra de navegación superior con marca "Lab Studio", enlaces a pestañas (`wizard`, `solver`, `trainer`, `ranges`, `scenarios`, `benchmarks`) y botón de cálculo rápido. |
| `src/components/RangeMatrix13x13.tsx` | Editor interactivo de rangos ponderados preflop 13×13 para OOP e IP. |
| `src/components/NodeEvDistributionChart.tsx` | Gráfico D3 interactivo de distribución de EV por mano en el nodo seleccionado. |
| `src/components/StrategyMatrixView.tsx` | Mapa de calor 13×13 de frecuencias de acción para el nodo activo. |
| `src/components/ScenarioManager.tsx` | Gestor de base de datos de escenarios con importación/exportación JSON. |
| `src/engine/preflopMatchups.ts` | Motor de rangos preflop dinámicos según posición, acción previa y perfil del rival (`OPPONENT_PROFILES: nit, regular, fish`). |
| `src/trainer/prebuiltScenarios.ts` | Base de datos de 32 escenarios precalculados de situaciones reales. |
| `src/engine/dcfr.ts` | Algoritmo DCFR (Discounted Counterfactual Regret Minimization) para cálculo de estrategias de equilibrio de Nash. |
| `src/engine/gameTree.ts` | Constructor de árboles de decisión postflop (acciones, subidas, all-ins, showdowns, pot tracking). |
| `src/engine/cards.ts` & `evaluator.ts` | Representación de cartas de 52 barajas y evaluador rápido de manos de 5 a 7 cartas. |
| `src/engine/solverRunner.ts` | Ejecutor asíncrono no bloqueante del solver con eventos de progreso y cancelación. |

---

## 3. FÓRMULAS Y LÓGICA MATEMÁTICA IMPLEMENTADA

### 3.1 Stack-to-Pot Ratio (SPR)
$$\text{SPR} = \frac{\text{Stack Efectivo}}{\text{Bote Actual}}$$
- **SPR < 2.5 (Bajo):** Estado comprometido. Overpairs y Top Pair Top Kicker juegan por todo el stack. No se permiten faroles especulativos con proyectos lentos.
- **2.5 ≤ SPR ≤ 6.5 (Medio):** Estándar de Single Raised Pots y botes 3-Bet profundos. Implied odds altas para proyectos de color y escalera.
- **SPR > 6.5 (Alto / Deep):** Juego muy profundo. Reverse Implied Odds entran en juego; manos de un solo par no comprometen stacks de 100BB+.

### 3.2 Pot Odds y Equity Requerida
$$\text{Pot Odds \%} = \frac{\text{Cantidad a Pagar}}{\text{Bote Total después de pagar}} \times 100$$
- Sizing de apuesta $33\%$ del bote $\rightarrow$ Requiere **$20.0\%$ de equity** (Ratio $4:1$).
- Sizing de apuesta $50\%$ del bote $\rightarrow$ Requiere **$25.0\%$ de equity** (Ratio $3:1$).
- Sizing de apuesta $75\%$ del bote $\rightarrow$ Requiere **$30.0\%$ de equity** (Ratio $2.33:1$).
- Sizing de apuesta $100\%$ del bote $\rightarrow$ Requiere **$33.3\%$ de equity** (Ratio $2:1$).

### 3.3 Perfiles de Rival y Ajuste Explotativo
- **Nit (Roca):** VPIP 12-16%. Rango de apertura filtrado a top broadways y pares altos. Rara vez farolea turn y river. *Explotación:* Robar ciegas constantemente, C-bet barata a alta frecuencia, foldear manos medias ante sus apuestas grandes.
- **Regular (TAG / GTO):** Frecuencias balanceadas según teoría de juegos con blockers de nuts. *Explotación:* Jugar líneas óptimas GTO, protegiendo rangos de check y controlando el bote.
- **Fish (Calling Station):** VPIP 40%+. Rango amplio con cartas no conectadas y basura. Paga apuestas fuera de odds. *Explotación:* Maximizar sizings de valor ($75\%+$ pot o overbets), apostar por valor fino en las 3 calles y **nunca intentar faroles puros en el river**.

---

## 4. HISTORIAL DE BUGS CORREGIDOS Y VERIFICACIONES
- Corregida etiqueta de cierre `<nav>` en `Header.tsx` que impedía la compilación.
- Agregada definición de `handleUpdateRangesFromWizard` en `App.tsx` para evitar error de referencia en runtime.
- Establecida la pestaña por defecto en `'wizard'` para que el usuario siempre aterrice en el asistente paso a paso.
- Añadido doble botón "Volver" en `TrainerModule.tsx` (uno en el top bar y otro directamente en el felt verde de la mesa).
- Base de datos de escenarios expandida de 16 a **32 escenarios reales completos**.
- Sincronización automática de árbol de decisión (live solver con debounce a 120ms) al cambiar cartas, calles o posiciones.
- Corregida la importación de `HandAndPositionBar` y `BoardSelector` en `src/App.tsx` (resolviendo error TS2304).
- Añadido indicador interactivo **'Mistake Threshold' (>5% EV Loss)** en `TrainerModule.tsx`:
  * Monitor persistente en la cabecera del paño con semáforo en tiempo real (`⚪ Monitoreo Activo`, `🟢 Dentro de Tolerancia ≤5%`, `🔴 ¡UMBRAL SUPERADO! >5%`).
  * Banner de advertencia destacado cuando la acción elegida supera el umbral crítico (>5% de pérdida del bote respecto a la línea GTO óptima).
  * Filtro y badges dedicados en el historial de intentos: `Errores >5% EV`.
  * Integración en `ActionEvBarChart.tsx` con alerta visual en cada sizing que supere el 5% de EV Loss.
- **Reparación de Nodos Dañados y Alertas Críticas de Convergencia**:
  * Asignado `actionKey` único a cada acción (`CHECK`, `BET_33`, `BET_75`, `CALL`, `FOLD`, `RAISE_25`, `ALLIN`) en `buildGameTree` y `Action` interface.
  * Corregida la colisión de claves donde `BET_75` colisionaba con `BET_33` en `dcfr.ts`, `TrainerModule.tsx` y `DecisionTreeViewer.tsx`, resolviendo nodos huérfanos e inalcanzables.
  * **Corrección matemática de Alertas Críticas (Exploitability/Regret)**:
    - Se corrigió la fórmula de `localExploitability` en `src/engine/dcfr.ts`. Anteriormente promediaba el EV de todo el rango global, lo que generaba un falso positivo de 1.0 - 2.5 BB en manos polarizadas a pesar de estar en perfecto equilibrio de Nash. Ahora calcula la exploitabilidad real por set de información imperfecto: $\sum_c w_c \max_a (EV(c, a) - EV(c, \sigma)) / \sum w_c$.
    - Normalización de Regret acumulado dividido por las iteraciones ($R^T / T$), eliminando los valores inflados (15-30 BB) que disparaban falsas alarmas rojas en el 100% de los nodos.
    - Se añadió el botón de acción rápida **"⚡ Reparar Todos los Nodos"** en el banner de alertas de `DecisionTreeViewer.tsx` para forzar la convergencia y re-resolución instantánea de todo el árbol.
    - Aumento de iteraciones de auto-solve en segundo plano a 150 para una convergencia suave (< 80 ms).
  * 334 tests matemáticos y de motor ejecutados con 100% de éxito (0 fallos).
- Verificación completa con `lint_applet` (`tsc --noEmit` 0 errores) y `compile_applet` (compilación 100% exitosa).

---

*Guardado como Versión 2.0 para inicio rápido de sesiones y preservación total del proyecto Lab Studio.*
