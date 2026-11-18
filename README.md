# Allin School — Lab Studio, TheTracker2 & Consola Allin Studio Admin

Plataforma profesional de **No-Limit Texas Hold'em 6-Max (Equilibrio Nash & Explotativo)** dividida en **2 repositorios independientes pero conectados en tiempo real vía Firebase Auth + Cloud Firestore compartido**:

## Arquitectura de 2 Repositorios Enlazados

| Repositorio | Ubicación | Propósito | URL / Puerto |
| :--- | :--- | :--- | :--- |
| **`allin-school-edu`** | Raíz `/` | Escuela & Motor **Lab Studio** (Paso a Paso, Práctica Multi-Calle, Manual 6-Max, Evaluaciones 720+, **TheTracker2 Pro** con Replayer calle-por-calle y respaldo ZIP/GZIP, SM-2, Dashboard D3.js y Plan de Carrera Gemini AI) | `http://localhost:3000` (`/`) |
| **`allin-studio-admin`** | `/admin-console/` | Consola Administrativa SaaS Independiente (Usuarios, Pre-registro `/userInvites`, **Planes / Secciones / Beneficios en vivo `/planConfigs`**, Analítica D3.js de Crecimiento/Retención/BD y Auditoría) | `/admin/` o standalone `http://localhost:4000` |

## Sincronización en Vivo entre Repositorios (`/planConfigs/{free|pro|elite}`)
- En `allin-studio-admin`, pestaña **Planes, Secciones & Beneficios**, el administrador configura qué módulos de las **9 secciones** de Allin School ve cada plan, si las pestañas bloqueadas se muestran con candado o se ocultan (`hideLockedSections`), el límite diario de evaluaciones y los beneficios comerciales.
- En `allin-school-edu`, cada estudiante conectado recibe los cambios al instante mediante Firestore `onSnapshot` (`AuthContext.tsx`), adaptando el menú superior (`Header.tsx`), las cuotas (`EvaluationModule.tsx`) y su modal de beneficios (`PlanBenefitsModal.tsx`).

## Comandos Rápidos

```bash
# 1. Instalar dependencias del Repo Educativo y del Repo Admin
npm install
npm --prefix admin-console install

# 2. Compilar ambos repositorios
npm run build:all

# 3. Verificar TypeScript y Pruebas Matemáticas (444+ tests)
npm run lint:all
npm test

# 4. Iniciar servidor unificado (Allin School en / y Allin Studio Admin compilado en /admin/)
npm run dev

# 5. (Opcional) Iniciar Allin Studio Admin de forma autónoma en puerto 4000
npm run dev:admin

# 6. Exportar a 2 repositorios Git separados listos para GitHub
bash scripts/split-repos.sh
```
