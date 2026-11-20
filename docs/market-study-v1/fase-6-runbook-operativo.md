# FASE 6 — Runbook Operativo del Estudio de Mercado (30 Días · 300 Jugadores)

## 1. Pre-Lanzamiento (Día 0)
1. Verificar que `npm run lint:all`, `npm run build:all` y `npm test` pasan al 100%.
2. Confirmar que `firestore.rules` está desplegado en el proyecto Firebase activo.
3. Ingresar a **Allin Studio Admin (`/admin/`) → pestaña `Estudio 300`**:
   - Hacer clic en **"Inicializar Cupos (100/nivel)"** para crear `/studyCohorts/{fish, reg, nit}`.
   - Hacer clic en **"Activar Estudio (`market_study_v1` ON)"** cuando el piloto esté listo para recibir participantes.

## 2. Operación Durante los 30 Días
- **Monitoreo semanal (Días 7, 14, 21, 30):**
  - El banner de encuesta pendiente aparece automáticamente al participante activo en `src/App.tsx` cuando `elapsedDays >= 7 / 14 / 21 / 30`.
  - Desde `Admin → Estudio 300` se puede previsualizar y copiar el HTML del recordatorio por cohorte y hito para envío de seguimiento.
- **Calibración con Override:**
  - Si un jugador se inscribió en `fish` pero el equipo detecta perfil avanzado, ajustar su selector `Admin Override` en la tabla de participantes (`admin_override` prevalece sin corromper `cohortLevel`).
- **Solicitudes ARCO / Retiro:**
  - El usuario puede autogestionar su retiro desde el botón de estudio (`Pestaña Privacidad → Retirarme del estudio`). Las consultas adicionales se canalizan por `privacidad@allinstudio.edu`.

## 3. Cierre del Estudio (Día 30+)
1. Descargar reportes anonimizados **CSV** y **JSON** desde `Admin → Estudio 300`.
2. Evaluar métricas finales por perfil (`FISH`, `REG`, `NIT`):
   - **PMF (Sean Ellis):** meta `>= 40%` respuestas *"Muy decepcionado"*.
   - **NPS:** promedio neto por nivel cognitivo.
   - **Densidad Cognitiva:** proporción de respuestas `"Densidad adecuada"` frente a `"Muy simple"` o `"Sobrecargada"`.
3. Apagar `market_study_v1` (`Rollback Instantáneo (OFF)`) o promover la versión validada mediante migración controlada.
