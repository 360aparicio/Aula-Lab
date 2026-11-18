# Allin Studio Admin · Consola Administrativa Independiente (`allin-studio-admin`)

Repositorio **100% independiente** del Aula Educativa **Allin School** (`allin-school-edu`), conectado en tiempo real mediante **Firebase Auth + Cloud Firestore** compartido.

## Capacidades Principales
1. **Planes, Secciones & Beneficios (`/planConfigs/{free|pro|elite}`):**
   - Control visual por plan (`Free`, `Pro`, `Elite`) para habilitar o bloquear las **9 secciones** del Aula Educativo (`Paso a Paso`, `Árbol & Lab`, `Práctica`, `Manual 6-Max`, `Academia D3`, `Meta & Web`, `Rangos`, `Spots`, `Mates`).
   - Alternancia entre **Ocultar pestañas bloqueadas** o **Mostrar con candado 🔒** para incentivar upgrades.
   - Editor en vivo de precios, límites diarios de evaluaciones y lista dinámica de **beneficios visibles** para el estudiante.
2. **Gestión de Usuarios, Alta Manual y Permisos RBAC (`/users` & `/userInvites`):**
   - Creación manual y pre-registro de cuentas con herencia automática en su primer inicio de sesión Google.
   - Activación/pausa instantánea, cambios de tier, asignación de **Admin del Plan** (`planAdmin`) y acciones masivas + exportación CSV.
3. **Analítica Ejecutiva D3.js & Uso de Firestore:**
   - Crecimiento a 6 meses, retención mensual % frente a SLA `70%`, conteo real de colecciones (`/users`, `/sm2Items`, `/mistakes`, `/planConfigs`, `/userInvites`, `/adminAuditLogs`) y telemetría global.
4. **Auditoría Inmutable (`/adminAuditLogs`) y Cerebro Web (`/api/solver/sync-internet`).**

## Enlace Bidireccional con el Aula Educativo
- Variable `VITE_LAB_APP_URL`: URL pública del Aula Educativo (por defecto `/` cuando se co-hospedan, o `https://tu-aula.run.app` en despliegue separado).
- En desarrollo independiente:
  ```bash
  npm install
  npm run dev   # http://localhost:4000
  ```
- Exportar este directorio como su propio repositorio Git independiente usando `/scripts/split-repos.sh` desde el repositorio raíz.
