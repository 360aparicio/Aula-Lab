#!/usr/bin/env bash
set -euo pipefail

# Exporta Lab Studio en 2 repositorios Git independientes y listos para GitHub:
#   1) lab-studio-edu   (Aula Educativa & Laboratorio GTO)
#   2) lab-studio-admin (Consola Administrativa SaaS Independiente)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-${ROOT_DIR}/../split-repos}"
EDU_DIR="${OUT_DIR}/lab-studio-edu"
ADMIN_DIR="${OUT_DIR}/lab-studio-admin"

echo "Exportando repositorios independientes en: ${OUT_DIR}"
rm -rf "${EDU_DIR}" "${ADMIN_DIR}"
mkdir -p "${EDU_DIR}" "${ADMIN_DIR}"

# 1. Repo Educativo (Aula/Lab) - excluye carpeta admin-console, node_modules, dist y .git
tar -C "${ROOT_DIR}" \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.git' \
  --exclude='./admin-console' \
  -cf - . | tar -C "${EDU_DIR}" -xf -

# 2. Repo Administrativo Independiente - copia admin-console + reglas compartidas
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
    git -c user.name="Lab Studio" -c user.email="360aparicio@gmail.com" commit -m "feat: initial standalone export for ${name}" >/dev/null || true
  )
}

init_repo "${EDU_DIR}" "lab-studio-edu"
init_repo "${ADMIN_DIR}" "lab-studio-admin"

echo "✅ Repositorios generados con éxito:"
echo "   - Aula Educativo:      ${EDU_DIR}"
echo "   - Consola Admin:       ${ADMIN_DIR}"
echo ""
echo "Sube cada uno a su propio repositorio en GitHub:"
echo "  cd \"${EDU_DIR}\" && git remote add origin <URL_REPO_EDU> && git push -u origin main"
echo "  cd \"${ADMIN_DIR}\" && git remote add origin <URL_REPO_ADMIN> && git push -u origin main"
