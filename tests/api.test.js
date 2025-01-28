// api.test.js

const API_CONFIG = {
    BASE_URL: 'https://ike-license-manager-9b796c40a448.herokuapp.com',
    ENDPOINTS: {
      VALIDATE_TOKEN: '/api/validate',
      CHECK_VALIDITY: '/api/check-validity'
    },
    HEADERS: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  // Test tokens
  const TEST_TOKENS = {
    VALID: 'd73407d05de5223b08f49f3f1bc9c862',
    INVALID: 'invalid_token_here',
  };
  
  async function testTokenValidity(token) {
    try {
      console.log(`\nProbando validez del token: ${token}`);
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHECK_VALIDITY}/${token}`;
      console.log('URL:', url);
  
      const response = await fetch(url, {
        method: 'GET',
        headers: API_CONFIG.HEADERS
      });
  
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));
  
      const text = await response.text(); // Primero obtenemos el texto
      console.log('Respuesta cruda:', text);
  
      try {
        const result = JSON.parse(text); // Intentamos parsearlo como JSON
        console.log('Resultado parseado:', result);
        return result;
      } catch (parseError) {
        console.error('Error parseando JSON:', parseError);
        return false;
      }
    } catch (error) {
      console.error('Error en la petición:', error);
      return false;
    }
  }
  
  async function testTokenValidation(token, machineId = "test-machine") {
    try {
      console.log(`\nProbando validación completa del token: ${token}`);
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE_TOKEN}`, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          token,
          machineId,
          deviceInfo: "Test Device"
        })
      });
  
      const result = await response.json();
      console.log('Resultado:', result);
      return result;
    } catch (error) {
      console.error('Error en la validación:', error);
      return false;
    }
  }
  
  async function runAllTests() {
    console.log('Iniciando pruebas de API...\n');
    
    // Prueba 1: Token válido (vigencia)
    console.log('=== Prueba 1: Verificar vigencia de token válido ===');
    await testTokenValidity(TEST_TOKENS.VALID);
    
    // Prueba 2: Token inválido (vigencia)
    console.log('\n=== Prueba 2: Verificar vigencia de token inválido ===');
    await testTokenValidity(TEST_TOKENS.INVALID);
    
    // Prueba 3: Validación completa de token válido
    console.log('\n=== Prueba 3: Validación completa de token válido ===');
    await testTokenValidation(TEST_TOKENS.VALID);
    
    console.log('\nPruebas completadas.');
  }
  
  // Ejecutar todas las pruebas
  runAllTests();