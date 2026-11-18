#!/usr/bin/env bash
set -euo pipefail

# Exporta el ecosistema Allin Studio en 2 repositorios Git independientes y listos para GitHub:
#   1) allin-school-edu    (Allin School · Motor Lab Studio & TheTracker2)
#   2) allin-studio-admin  (Consola Administrativa SaaS Allin Studio Admin)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-${ROOT_DIR}/../split-repos}"
EDU_DIR="${OUT_DIR}/allin-school-edu"
ADMIN_DIR="${OUT_DIR}/allin-studio-admin"

echo "Exportando repositorios independientes en: ${OUT_DIR}"
rm -rf "${EDU_DIR}" "${ADMIN_DIR}"
mkdir -p "${EDU_DIR}" "${ADMIN_DIR}"

# 1. Repo Educativo (Allin School) - excluye carpeta admin-console, node_modules, dist y .git
tar -C "${ROOT_DIR}" \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.git' \
  --exclude='./admin-console' \
  -cf - . | tar -C "${EDU_DIR}" -xf -

# 2. Repo Administrativo Independiente (Allin Studio Admin) - copia admin-console + reglas compartidas
tar -C "${ROOT_DIR}/admin-console" \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.git' \
  -cf - . | tar -C "${ADMIN_DIR}" -xf -

cp -f "${ROOT_DIR}/firestore.rules" "${ADMIN_DIR}/firestore.rules"
cp -f "${ROOT_DIR}/firebase-blueprint.json" "${ADMIN_DIR}/firebase-blueprint.json"

init_repo() {
  local dir="$1"
  local name="$2"
  (
    cd "${dir}"
    git init -b main >/dev/null
    git config --global --add safe.directory "${dir}" >/dev/null 2>&1 || true
    git add -A
    git -c user.name="Allin Studio" -c user.email="360aparicio@gmail.com" commit -m "feat: initial standalone export for ${name}" >/dev/null || true
  )
}

init_repo "${EDU_DIR}" "allin-school-edu"
init_repo "${ADMIN_DIR}" "allin-studio-admin"

echo "✅ Repositorios generados con éxito:"
echo "   - Allin School (Edu):   ${EDU_DIR}"
echo "   - Allin Studio Admin:   ${ADMIN_DIR}"
echo ""
echo "Sube cada uno a su propio repositorio en GitHub:"
echo "  cd \"${EDU_DIR}\" && git remote add origin <URL_REPO_EDU> && git push -u origin main"
echo "  cd \"${ADMIN_DIR}\" && git remote add origin <URL_REPO_ADMIN> && git push -u origin main"
