#!/usr/bin/env bash
# tests/integration/api.test.sh
# Pruebas de integracion de la API REST - LICENSE-MANAGER
# Uso: bash tests/integration/api.test.sh [BASE_URL]
# Ejemplo: bash tests/integration/api.test.sh http://localhost:3500/api

set -euo pipefail

BASE_URL="${1:-http://localhost:3000/api}"
PASSED=0
FAILED=0
TOTAL=0

# Token y machineId para pruebas de success path
TEST_TOKEN="aaaabbbbccccddddeeeeffffaaaabbbb"
TEST_MACHINE_ID="test-machine-integration-01"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ------------------------------------------------------------------
# Pre-requisitos
# ------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${RED}ERROR${NC}: DATABASE_URL no esta definida."
  echo "  Uso: DATABASE_URL=postgresql://... bash tests/integration/api.test.sh"
  exit 1
fi

if [ ! -f "dist/config/config.js" ]; then
  echo -e "${RED}ERROR${NC}: dist/ no existe. Ejecuta 'npm run build' primero."
  exit 1
fi

# ------------------------------------------------------------------
# Helpers de asercion
# ------------------------------------------------------------------

assert_status() {
  local test_name="$1"
  local expected_status="$2"
  local actual_status="$3"
  local response_body="$4"
  TOTAL=$((TOTAL + 1))

  if [ "$actual_status" -eq "$expected_status" ]; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}PASS${NC} [$actual_status] $test_name"
  else
    FAILED=$((FAILED + 1))
    echo -e "${RED}FAIL${NC} [$actual_status != $expected_status] $test_name"
    echo "  Response: $response_body"
  fi
}

assert_json_field() {
  local test_name="$1"
  local field="$2"
  local expected="$3"
  local json="$4"
  TOTAL=$((TOTAL + 1))

  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field','__MISSING__'))" 2>/dev/null || echo "__ERROR__")

  if [ "$actual" = "$expected" ]; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}PASS${NC} $test_name ($field=$actual)"
  else
    FAILED=$((FAILED + 1))
    echo -e "${RED}FAIL${NC} $test_name ($field: expected=$expected, got=$actual)"
  fi
}

assert_json_has_field() {
  local test_name="$1"
  local field="$2"
  local json="$3"
  TOTAL=$((TOTAL + 1))
  local value
  value=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('__MISSING__' if '$field' not in d else d['$field'])" 2>/dev/null || echo "__ERROR__")
  if [ "$value" != "__MISSING__" ] && [ "$value" != "__ERROR__" ]; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}PASS${NC} $test_name ($field present)"
  else
    FAILED=$((FAILED + 1))
    echo -e "${RED}FAIL${NC} $test_name ($field missing)"
  fi
}

# ------------------------------------------------------------------
# Teardown: limpiar token de prueba al salir (siempre)
# ------------------------------------------------------------------
cleanup() {
  node -e "
  const { PrismaClient } = require('./dist/generated/prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  async function cleanup() {
    await prisma.token.deleteMany({ where: { token: '$TEST_TOKEN' } });
    await prisma.\$disconnect();
  }
  cleanup().catch(() => {});
  " 2>/dev/null
}
trap cleanup EXIT

# ------------------------------------------------------------------
# Setup: crear token de prueba en PostgreSQL
# ------------------------------------------------------------------
echo -e "${YELLOW}--- SETUP: Creando token de prueba en PostgreSQL ---${NC}"
SETUP_RESULT=$(node -e "
const { PrismaClient } = require('./dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
async function setup() {
  // Limpiar token de prueba previo si existe
  await prisma.token.deleteMany({ where: { token: '$TEST_TOKEN' } });
  // Crear token fresco con expiracion a 2 meses
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 2);
  await prisma.token.create({
    data: {
      token: '$TEST_TOKEN',
      email: 'test@integration.local',
      name: 'Integration Test',
      phone: '1234567890',
      createdAt: new Date(),
      expiresAt: expiresAt,
      isRedeemed: false
    }
  });
  await prisma.\$disconnect();
  console.log('OK');
}
setup().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)

if [ "$SETUP_RESULT" != "OK" ]; then
  echo -e "${RED}ERROR${NC}: No se pudo crear el token de prueba en PostgreSQL."
  echo "  Detalle: $SETUP_RESULT"
  exit 1
fi
echo -e "${GREEN}OK${NC} Token de prueba creado."
echo ""

echo "============================================"
echo " Pruebas de Integracion - LICENSE-MANAGER"
echo " Base URL: $BASE_URL"
echo "============================================"
echo ""

# ------------------------------------------------------------------
# 1. GET /status - Health check
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 1. GET /status ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/status")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /status returns 200" 200 "$HTTP_CODE" "$BODY"
assert_json_field "GET /status has status field" "status" "API is running" "$BODY"
echo ""

# ------------------------------------------------------------------
# 2. GET /check-validity/:token - Token valido (200, valid=true)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 2. GET /check-validity - Token valido ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/check-validity/$TEST_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /check-validity token valido returns 200" 200 "$HTTP_CODE" "$BODY"
assert_json_field "Response has valid=True" "valid" "True" "$BODY"
assert_json_has_field "Response has expiresAt" "expiresAt" "$BODY"
echo ""

# ------------------------------------------------------------------
# 3. POST /validate - Token valido (200, success=true, valid=true)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 3. POST /validate - Token valido ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/validate" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TEST_TOKEN\", \"machineId\": \"$TEST_MACHINE_ID\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "POST /validate token valido returns 200" 200 "$HTTP_CODE" "$BODY"
assert_json_field "Response has success=True" "success" "True" "$BODY"
assert_json_field "Response has valid=True" "valid" "True" "$BODY"
assert_json_has_field "Response has expiresAt" "expiresAt" "$BODY"
echo ""

# ------------------------------------------------------------------
# 4. POST /validate - Parametros faltantes (400)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 4. POST /validate - Params faltantes ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/validate" \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "POST /validate sin params returns 400" 400 "$HTTP_CODE" "$BODY"
assert_json_field "Response has valid=False" "valid" "False" "$BODY"
assert_json_field "Response has errorCode" "errorCode" "MISSING_PARAMS" "$BODY"
echo ""

# ------------------------------------------------------------------
# 5. POST /validate - Formato invalido (400)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 5. POST /validate - Formato invalido ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/validate" \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123", "machineId": "x"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "POST /validate formato invalido returns 400" 400 "$HTTP_CODE" "$BODY"
assert_json_field "Response has errorCode INVALID_FORMAT" "errorCode" "INVALID_FORMAT" "$BODY"
echo ""

# ------------------------------------------------------------------
# 6. POST /validate - Token no encontrado
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 6. POST /validate - Token no encontrado ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/validate" \
  -H "Content-Type: application/json" \
  -d '{"token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0", "machineId": "test-machine-001"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "POST /validate token inexistente returns 200" 200 "$HTTP_CODE" "$BODY"
assert_json_field "Response has valid=False" "valid" "False" "$BODY"
assert_json_field "Response has errorCode TOKEN_NOT_FOUND" "errorCode" "TOKEN_NOT_FOUND" "$BODY"
echo ""

# ------------------------------------------------------------------
# 7. GET /check-validity/:token - Formato invalido (400)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 7. GET /check-validity - Formato invalido ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/check-validity/not-a-valid-token")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /check-validity formato invalido returns 400" 400 "$HTTP_CODE" "$BODY"
assert_json_field "Response has valid=False" "valid" "False" "$BODY"
echo ""

# ------------------------------------------------------------------
# 8. GET /check-validity/:token - Token no encontrado (200)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 8. GET /check-validity - Token no encontrado ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/check-validity/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /check-validity token inexistente returns 200" 200 "$HTTP_CODE" "$BODY"
assert_json_field "Response has valid=False" "valid" "False" "$BODY"
assert_json_field "Response has message" "message" "Token no encontrado" "$BODY"
echo ""

# ------------------------------------------------------------------
# 9. GET /tokens - Sin JWT (401)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 9. GET /tokens - Sin JWT ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/tokens")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /tokens sin JWT returns 401" 401 "$HTTP_CODE" "$BODY"
assert_json_field "Response has success=False" "success" "False" "$BODY"
echo ""

# ------------------------------------------------------------------
# 10. POST /login - Credenciales invalidas (403)
# ------------------------------------------------------------------
# Pre-check: verificar si estamos rate-limited en login
PRE_CHECK=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "__pre_check__"}')
PRE_STATUS=$(echo "$PRE_CHECK" | tail -1)
if [ "$PRE_STATUS" -eq 429 ]; then
  RETRY_AFTER=$(curl -sI -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d '{"adminKey": "__pre_check__"}' | grep -i 'retry-after' | tr -d '\r' | awk '{print $2}')
  WAIT=${RETRY_AFTER:-60}
  echo -e "${YELLOW}WARN${NC} Rate-limited en /login. Esperando ${WAIT}s..."
  sleep "$WAIT"
fi

echo -e "${YELLOW}--- 10. POST /login - Credenciales invalidas ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "clave_incorrecta"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "POST /login credenciales invalidas returns 403" 403 "$HTTP_CODE" "$BODY"
assert_json_field "Response has success=False" "success" "False" "$BODY"
echo ""

# ------------------------------------------------------------------
# 11. POST /login - Login exitoso + GET /tokens con JWT
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 11. POST /login + GET /tokens con JWT ---${NC}"
ADMIN_KEY="${ADMIN_API_KEY:-}"
if [ -z "$ADMIN_KEY" ]; then
  if [ "${CI:-}" = "true" ]; then
    echo -e "${RED}FAIL${NC} ADMIN_API_KEY requerida en CI"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
  else
    echo -e "${YELLOW}SKIP${NC} ADMIN_API_KEY no definida en entorno. Definela para probar login+tokens."
    echo "  Uso: ADMIN_API_KEY=tu_clave bash tests/integration/api.test.sh"
  fi
else
  # Login
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"adminKey\": \"$ADMIN_KEY\"}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  assert_status "POST /login exitoso returns 200" 200 "$HTTP_CODE" "$BODY"

  JWT=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

  if [ -n "$JWT" ]; then
    # GET /tokens con JWT
    RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/tokens" \
      -H "Authorization: Bearer $JWT")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    assert_status "GET /tokens con JWT returns 200" 200 "$HTTP_CODE" "$BODY"
    assert_json_field "Response has currentPage" "currentPage" "1" "$BODY"
  else
    echo -e "${RED}FAIL${NC} No se obtuvo JWT del login"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
  fi
fi
echo ""

# ------------------------------------------------------------------
# Resumen
# ------------------------------------------------------------------
echo "============================================"
echo -e " Resultados: ${GREEN}$PASSED pasaron${NC}, ${RED}$FAILED fallaron${NC}, $TOTAL total"
echo "============================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
