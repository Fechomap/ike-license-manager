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

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
# 2. POST /validate - Parametros faltantes (400)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 2. POST /validate - Params faltantes ---${NC}"
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
# 3. POST /validate - Formato invalido (400)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 3. POST /validate - Formato invalido ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/validate" \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123", "machineId": "x"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "POST /validate formato invalido returns 400" 400 "$HTTP_CODE" "$BODY"
assert_json_field "Response has errorCode INVALID_FORMAT" "errorCode" "INVALID_FORMAT" "$BODY"
echo ""

# ------------------------------------------------------------------
# 4. POST /validate - Token no encontrado
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 4. POST /validate - Token no encontrado ---${NC}"
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
# 5. GET /check-validity/:token - Formato invalido (400)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 5. GET /check-validity - Formato invalido ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/check-validity/not-a-valid-token")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /check-validity formato invalido returns 400" 400 "$HTTP_CODE" "$BODY"
assert_json_field "Response has valid=False" "valid" "False" "$BODY"
echo ""

# ------------------------------------------------------------------
# 6. GET /check-validity/:token - Token no encontrado (200)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 6. GET /check-validity - Token no encontrado ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/check-validity/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /check-validity token inexistente returns 200" 200 "$HTTP_CODE" "$BODY"
assert_json_field "Response has valid=False" "valid" "False" "$BODY"
assert_json_field "Response has message" "message" "Token no encontrado" "$BODY"
echo ""

# ------------------------------------------------------------------
# 7. GET /tokens - Sin JWT (401)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 7. GET /tokens - Sin JWT ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/tokens")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "GET /tokens sin JWT returns 401" 401 "$HTTP_CODE" "$BODY"
assert_json_field "Response has success=False" "success" "False" "$BODY"
echo ""

# ------------------------------------------------------------------
# 8. POST /login - Credenciales invalidas (403)
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 8. POST /login - Credenciales invalidas ---${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "clave_incorrecta"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "POST /login credenciales invalidas returns 403" 403 "$HTTP_CODE" "$BODY"
assert_json_field "Response has success=False" "success" "False" "$BODY"
echo ""

# ------------------------------------------------------------------
# 9. POST /login - Login exitoso + GET /tokens con JWT
# ------------------------------------------------------------------
echo -e "${YELLOW}--- 9. POST /login + GET /tokens con JWT ---${NC}"
ADMIN_KEY="${ADMIN_API_KEY:-}"
if [ -z "$ADMIN_KEY" ]; then
  echo -e "${YELLOW}SKIP${NC} ADMIN_API_KEY no definida en entorno. Definela para probar login+tokens."
  echo "  Uso: ADMIN_API_KEY=tu_clave bash tests/integration/api.test.sh"
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
