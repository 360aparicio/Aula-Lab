/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * E2E Specification (Playwright-compatible) para Estudio de Mercado v1 (FASE 4).
 * Valida:
 * 1) Flag OFF = Experiencia Demo Final v5.0.0 exacta (cero banners o modales de estudio).
 * 2) Flag ON + Onboarding 3 pasos (Bloqueo < 18 años -> Consentimiento -> Cohorte FISH/REG/NIT).
 * 3) Respeto a cupo máximo 100/nivel (transición a waitlist sin error).
 * 4) Botón "Retirarme del estudio" (GDPR Art. 17) revoca telemetría inmediatamente.
 */

export interface E2EScenarioSpec {
  id: string;
  title: string;
  preconditions: string[];
  steps: string[];
  assertions: string[];
}

export const MARKET_STUDY_E2E_SCENARIOS: E2EScenarioSpec[] = [
  {
    id: 'E2E-01-FLAG-OFF-BASELINE',
    title: 'Regla R2: Flag market_study_v1 OFF mantiene comportamiento Demo Final exacto',
    preconditions: [
      'GET /api/flags devuelve enabled: false',
      'Firestore /featureFlags/market_study_v1 tiene enabled: false o ausente'
    ],
    steps: [
      'Abrir / en navegador autenticado',
      'Verificar barra superior de Perfil de Estudio'
    ],
    assertions: [
      'Se renderizan exactamente los 4 botones clásicos (Principiante, Recreativo, Regular, Pro)',
      'NO se muestra modal de consentimiento del estudio ni barra FISH/REG/NIT',
      'studyTelemetry no emite ninguna escritura a /studyEvents'
    ]
  },
  {
    id: 'E2E-02-MINOR-AGE-GATE',
    title: 'Bloqueo estricto de menores de 18 años antes del consentimiento y telemetría',
    preconditions: ['Flag market_study_v1 = true', 'Usuario autenticado sin enrollment'],
    steps: [
      'Abrir AdaptiveOnboardingModal',
      'Ingresar año de nacimiento correspondiente a 17 años',
      'Marcar checkbox de consentimiento e intentar continuar al Paso 2'
    ],
    assertions: [
      'El sistema bloquea avance y muestra alerta legal >= 18 años',
      'No se crea documento en /studyConsents ni /studyEnrollments'
    ]
  },
  {
    id: 'E2E-03-FISH-REG-NIT-ONBOARDING',
    title: 'Inscripción completa FISH/REG/NIT con actualización de densidad cognitiva sin cambiar permisos de plan',
    preconditions: ['Flag market_study_v1 = true', 'Cupos < 100 en cohorte destino'],
    steps: [
      'Paso 1: Ingresar año adulto y marcar checkbox explícito NO premarcado',
      'Paso 2: Seleccionar tarjeta NIT · Analítico',
      'Paso 3: Confirmar inscripción atómica'
    ],
    assertions: [
      'Se crea /studyConsents/{uid}_v1_0 con status="active" e ipHash HMAC-SHA256',
      'Se crea /studyEnrollments/{uid} con cohortLevel="nit" y status="active"',
      'planTier del usuario NO cambia (nivel determina densidad, no permisos)'
    ]
  },
  {
    id: 'E2E-04-WITHDRAWAL-GDPR',
    title: 'Retiro GDPR Art. 17 desde StudyFeedbackModal revoca consentimiento y limpia cola local',
    preconditions: ['Usuario activo en estudio con eventos locales en cola'],
    steps: [
      'Abrir modal de Estudio -> pestaña Privacidad',
      'Clic en "Retirarme del estudio" y confirmar paso 2'
    ],
    assertions: [
      'Consentimiento cambia a status="revoked"',
      'Enrollment pasa a status="withdrawn" con purgeScheduledAtMs <= 30 días',
      'Cupo de cohorte se decrementa en 1 atómicamente y cola local queda vacía'
    ]
  }
];
