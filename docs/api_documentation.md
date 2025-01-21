# IKE License Manager - API Documentation

## Overview

IKE License Manager is a robust software licensing system that provides token generation, validation, and management capabilities through a REST API. This documentation provides detailed information about available endpoints, request/response formats, and integration examples.

## Base URL

```
https://ike-license-manager-9b796c40a448.herokuapp.com/api
```

## Authentication

Currently, the API does not require authentication. However, implementing API keys or JWT authentication is recommended for production use.

## Endpoints

### 1. Check API Status

Verifies if the API is active and functioning correctly.

**Request**
- Method: `GET`
- Endpoint: `/status`

**Response**

```json
{
  "message": "API funcionando correctamente"
}
```

### 2. Validate and Activate Token

Validates a token and activates it by linking it to a specific device.

**Request**
- Method: `POST`
- Endpoint: `/validate`
- Content-Type: `application/json`

**Request Body**
```json
{
  "token": "ad1c6c6f6f881d8637306efa48922ff4",
  "machineId": "machine-12345",
  "deviceInfo": "iPhone 14 Pro, iOS 17"  // Optional
}
```

**Successful Response** (200 OK)
```json
{
  "success": true,
  "message": "Token validado y activado correctamente",
  "expiresAt": "2025-02-19T14:42:55.275Z"
}
```

**Error Responses**

Missing Parameters (400 Bad Request)
```json
{
  "success": false,
  "message": "Token y machineId son requeridos"
}
```

Token Not Found (404 Not Found)
```json
{
  "success": false,
  "message": "Token no encontrado"
}
```

Already Redeemed Token (400 Bad Request)
```json
{
  "success": false,
  "message": "Token ya canjeado"
}
```

### 3. List All Tokens

Retrieves a list of all registered tokens and their current status.

**Request**
- Method: `GET`
- Endpoint: `/tokens`

**Response**
```json
{
  "success": true,
  "data": [
    {
      "token": "ad1c6c6f6f881d8637306efa48922ff4",
      "status": "redeemed",
      "machineId": "machine-12345",
      "deviceInfo": "iPhone 14 Pro, iOS 17"
    },
    {
      "token": "ad59e4c476e47ed21180e0d540564b7c",
      "status": "unredeemed",
      "machineId": null,
      "deviceInfo": null
    }
  ]
}
```

## Integration Examples

### JavaScript (Node.js with Axios)

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://ike-license-manager-9b796c40a448.herokuapp.com/api';

// Check API Status
async function checkApiStatus() {
  try {
    const response = await axios.get(`${API_BASE_URL}/status`);
    console.log('API Status:', response.data);
  } catch (error) {
    console.error('Error checking API status:', error.response?.data || error.message);
  }
}

// Validate Token
async function validateToken(token, machineId, deviceInfo) {
  try {
    const response = await axios.post(`${API_BASE_URL}/validate`, {
      token,
      machineId,
      deviceInfo
    });
    console.log('Token validation result:', response.data);
    return response.data;
  } catch (error) {
    console.error('Token validation error:', error.response?.data || error.message);
    throw error;
  }
}

// List All Tokens
async function listTokens() {
  try {
    const response = await axios.get(`${API_BASE_URL}/tokens`);
    console.log('Token list:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error listing tokens:', error.response?.data || error.message);
    throw error;
  }
}
```

### Python (with requests)

```python
import requests

API_BASE_URL = 'https://ike-license-manager-9b796c40a448.herokuapp.com/api'

def check_api_status():
    try:
        response = requests.get(f'{API_BASE_URL}/status')
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error checking API status: {e}')
        return None

def validate_token(token, machine_id, device_info=None):
    try:
        payload = {
            'token': token,
            'machineId': machine_id,
            'deviceInfo': device_info
        }
        response = requests.post(f'{API_BASE_URL}/validate', json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error validating token: {e}')
        return None

def list_tokens():
    try:
        response = requests.get(f'{API_BASE_URL}/tokens')
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error listing tokens: {e}')
        return None
```

## Best Practices

1. **Error Handling**
   - Always implement proper error handling in your client applications
   - Check for HTTP status codes and handle them appropriately
   - Parse response data carefully to handle unexpected formats

2. **Security Considerations**
   - Store sensitive data (tokens, machine IDs) securely
   - Implement SSL/TLS for all API communications
   - Consider implementing rate limiting in your client applications

3. **Performance**
   - Implement caching where appropriate
   - Handle network timeouts gracefully
   - Consider implementing retry logic for failed requests

## Data Model

The token model includes the following fields:

```javascript
{
  token: String,          // Unique token identifier
  email: String,          // User's email
  name: String,           // User's name
  phone: String,          // User's phone number
  createdAt: Date,        // Token creation date
  expiresAt: Date,        // Token expiration date
  isRedeemed: Boolean,    // Redemption status
  redeemedAt: Date,       // Redemption date
  machineId: String,      // Linked machine identifier
  redemptionDetails: {
    ip: String,           // IP address used for redemption
    deviceInfo: String,   // Device information
    timestamp: Date       // Redemption timestamp
  }
}
```

## Support

For additional support or to report issues, please contact the development team or refer to the project documentation in the repository.