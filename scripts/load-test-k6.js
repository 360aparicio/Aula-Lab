/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * k6 Load Test Script (FASE 4) — Estudio de Mercado 300 Usuarios Concurrentes.
 * Ejecutar contra staging:
 *   k6 run -e BASE_URL=http://localhost:3000 scripts/load-test-k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 100 }, // Cohorte 1: FISH
    { duration: '30s', target: 300 }, // 300 concurrentes: FISH + REG + NIT
    { duration: '15s', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],     // < 1% errores bajo carga 300 VUs
    http_req_duration: ['p(95)<200']    // P95 < 200ms en endpoints de bandera y salud
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health ok body': (r) => r.body && r.body.includes('"ok"')
  });

  const flagRes = http.get(`${BASE_URL}/api/flags`);
  check(flagRes, {
    'flags status 200': (r) => r.status === 200,
    'flags schema valid': (r) => r.body && r.body.includes('market_study_v1')
  });

  // Security check: endpoints protegidos deben rechazar peticiones anónimas con 401
  const unauthConsentMeta = http.post(`${BASE_URL}/api/legal/consent-meta`, '{}', {
    headers: { 'Content-Type': 'application/json' }
  });
  check(unauthConsentMeta, {
    'consent-meta requires auth (401)': (r) => r.status === 401
  });

  sleep(0.5);
}
