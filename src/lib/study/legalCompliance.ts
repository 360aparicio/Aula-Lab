/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo Legal del Estudio de Mercado (market_study_v1).
 * Cumplimiento integrado:
 * - Colombia: Ley Estatutaria 1581 de 2012 y Decreto 1377 de 2013 (Habeas Data)
 * - Propiedad Intelectual: Decisión Andina 351 de 1993
 * - Internacional / UE: GDPR (Art. 6(1)(a), Art. 7, Art. 13, Art. 17 Derecho al Olvido, Art. 33 Brechas 72h)
 */

export const CONSENT_VERSION = '1.0' as const;

export const LEGAL_CONTROLLER_NAME =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_LEGAL_CONTROLLER_NAME) ||
  'ALLin Studio S.A.S. (Titular de ALLin Studio & Allin School)';

export const LEGAL_DPO_EMAIL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_LEGAL_DPO_EMAIL) ||
  'privacidad@allinstudio.edu';

export const RETENTION_POLICY = {
  studyDurationDays: 30,
  eventsRetentionDays: 180, // 6 meses
  feedbackRetentionDays: 365, // 12 meses
  consentsRetentionYears: 5, // 5 años (obligación legal probatoria)
  withdrawalPurgeMaxDays: 30, // Derecho al olvido <= 30 días
  breachNotificationHours: 72 // GDPR Art. 33
} as const;

export interface AgeVerificationResult {
  valid: boolean;
  ageYears: number;
  reason?: string;
}

/**
 * Bloqueo estricto para menores de 18 años antes de ingresar al estudio o emitir telemetría.
 */
export function validateAdultAge(birthYear: number, referenceYear = new Date().getUTCFullYear()): AgeVerificationResult {
  if (!Number.isInteger(birthYear) || birthYear < 1920 || birthYear > referenceYear) {
    return {
      valid: false,
      ageYears: 0,
      reason: 'Ingresa un año de nacimiento válido (YYYY).'
    };
  }

  const ageYears = referenceYear - birthYear;
  if (ageYears < 18) {
    return {
      valid: false,
      ageYears,
      reason: 'El estudio de mercado y la plataforma están restringidos exclusivamente a personas mayores de 18 años.'
    };
  }

  return { valid: true, ageYears };
}

export function buildConsentDocId(uid: string, version: string = CONSENT_VERSION): string {
  const safeVersion = version.replace(/[^a-zA-Z0-9]/g, '_');
  return `${uid}_v${safeVersion}`;
}

export function computeExpiryMs(daysFromNow: number, nowMs = Date.now()): number {
  return nowMs + daysFromNow * 24 * 60 * 60 * 1000;
}

export const INFORMED_CONSENT_SECTIONS = [
  {
    id: 'controller',
    title: '1. Responsable del Tratamiento y DPO',
    body: `${LEGAL_CONTROLLER_NAME} actúa como Responsable del tratamiento de datos personales dentro del estudio controlado de 30 días sobre Allin School. Contacto oficial del Oficial de Protección de Datos (DPO): ${LEGAL_DPO_EMAIL}.`
  },
  {
    id: 'purpose',
    title: '2. Naturaleza Educativa & Finalidad del Estudio (GDPR Art. 6.1.a / Ley 1581)',
    body: 'ALLin Studio es software estrictamente educativo de teoría matemática NLHE 6-Max (NO operador de apuestas ni dinero real). Tus interacciones (eventos de uso agregados, perfil de densidad FISH/REG/NIT y encuestas NPS/PMF en los días 7, 14, 21 y 30) se tratan únicamente con tu consentimiento explícito para evaluar usabilidad y claridad didáctica.'
  },
  {
    id: 'transfers',
    title: '3. Datos Capturados, País/IP y Transferencias Internacionales',
    body: 'Para prevenir abuso de cupos y auditoría legal se registra marca temporal UTC, versión de consentimiento, agente de navegador, país aproximado y un hash criptográfico irreversible de IP (sin almacenar la IP en texto claro). La infraestructura se aloja en Google Cloud / Firebase bajo cláusulas contractuales estándar.'
  },
  {
    id: 'retention',
    title: '4. Plazos de Retención Diferenciada',
    body: `Eventos técnicos de uso: máximo ${RETENTION_POLICY.eventsRetentionDays} días (6 meses). Respuestas de encuestas/feedback: máximo ${RETENTION_POLICY.feedbackRetentionDays} días (12 meses). Registros probatorios de consentimiento/revocación: ${RETENTION_POLICY.consentsRetentionYears} años por mandato legal.`
  },
  {
    id: 'rights',
    title: '5. Derechos ARCO, Retiro Inmediato y Brechas (72h)',
    body: `Puedes ejercer acceso, rectificación o supresión escribiendo a ${LEGAL_DPO_EMAIL} o usando el botón "Retirarme del estudio" en cualquier momento. Tras el retiro, los datos del estudio se revocan de inmediato y se anonimizan/eliminan en cascada en un plazo máximo de ${RETENTION_POLICY.withdrawalPurgeMaxDays} días. Cualquier incidente de seguridad será notificado dentro de las ${RETENTION_POLICY.breachNotificationHours} horas siguientes.`
  }
] as const;
