// src/services/emailService.ts
import config from '../config/config';

// ---------------------------------------------------------------------------
// OAuth2 token cache (Microsoft Graph)
// ---------------------------------------------------------------------------

interface OAuthToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: OAuthToken | null = null;

function isEmailConfigured(): boolean {
  return !!(
    config.smtp.oauthClientId &&
    config.smtp.oauthTenantId &&
    config.smtp.oauthClientSecret &&
    config.smtp.fromEmail
  );
}

async function getGraphToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.smtp.oauthTenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.smtp.oauthClientId,
    client_secret: config.smtp.oauthClientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Graph OAuth2 token failed (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

// ---------------------------------------------------------------------------
// Envío via Microsoft Graph API
// ---------------------------------------------------------------------------

async function sendMailViaGraph(to: string, subject: string, htmlBody: string): Promise<void> {
  const token = await getGraphToken();

  const payload = {
    message: {
      subject,
      from: {
        emailAddress: {
          name: config.smtp.fromName,
          address: config.smtp.fromEmail,
        },
      },
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  };

  // Usar el usuario principal (user) si está definido, si no el fromEmail
  const sendAs = config.smtp.user || config.smtp.fromEmail;
  const url = `https://graph.microsoft.com/v1.0/users/${sendAs}/sendMail`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${errorText}`);
  }
}

// ---------------------------------------------------------------------------
// Verificación de conexión
// ---------------------------------------------------------------------------

export async function verifyConnection(): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('📧 Email no configurado — emails deshabilitados');
    return;
  }
  try {
    await getGraphToken();
    console.log('✅ Microsoft Graph configurado (email via', config.smtp.fromEmail + ')');
  } catch (error: unknown) {
    console.warn(
      '⚠️ No se pudo verificar Graph API:',
      error instanceof Error ? error.message : error,
    );
  }
}

// ---------------------------------------------------------------------------
// Template HTML
// ---------------------------------------------------------------------------

interface WelcomeEmailData {
  email: string;
  name: string;
  token: string;
  expiresAt: Date;
}

function buildWelcomeHtml(data: WelcomeEmailData): string {
  const expiryDate = data.expiresAt.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const downloadSection = config.softwareDownloadUrl
    ? `<tr>
        <td style="padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#f0f4ff;border-radius:8px;padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1a1a2e;">📥 Descarga e Instalación</p>
                <ol style="margin:0;padding-left:20px;color:#4a4a68;font-size:14px;line-height:1.8;">
                  <li>Descarga AutoMike según tu sistema operativo</li>
                  <li>Ejecuta el instalador y sigue las instrucciones</li>
                  <li>Al iniciar, ingresa tu token de licencia</li>
                  <li>¡Listo! Tu licencia quedará activada</li>
                </ol>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                  <tr>
                    <td align="center" style="padding:0 4px 0 0;" width="50%">
                      <a href="${config.softwareDownloadUrl}/windows" style="display:block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 8px;border-radius:6px;font-size:14px;font-weight:600;text-align:center;">Descarga para Windows</a>
                    </td>
                    <td align="center" style="padding:0 0 0 4px;" width="50%">
                      <a href="${config.softwareDownloadUrl}/mac" style="display:block;background:#1a1a2e;color:#ffffff;text-decoration:none;padding:12px 8px;border-radius:6px;font-size:14px;font-weight:600;text-align:center;">Descarga para Mac</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  const bankSection = config.bankAccountInfo
    ? `<tr>
        <td style="padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#fef9e7;border-radius:8px;padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1a1a2e;">💳 Método de Pago — Transferencia Bancaria</p>
                <pre style="margin:0;font-family:'Courier New',monospace;font-size:13px;color:#4a4a68;white-space:pre-wrap;line-height:1.7;">${config.bankAccountInfo}</pre>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">HAVANI</h1>
            <p style="margin:8px 0 0;color:#a0a0c0;font-size:13px;">Gestión de Licencias</p>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <p style="margin:0;font-size:16px;color:#1a1a2e;">Hola <strong>${data.name}</strong>,</p>
            <p style="margin:12px 0 0;font-size:14px;color:#4a4a68;line-height:1.6;">
              Tu licencia de <strong>AutoMike</strong> ha sido generada exitosamente. A continuación encontrarás tu token y toda la información necesaria.
            </p>
          </td>
        </tr>

        <!-- Token -->
        <tr>
          <td style="padding:8px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);background-color:#4f46e5;border-radius:10px;padding:24px;text-align:center;">
                  <p style="margin:0 0 8px;color:#e0d4ff;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Tu Token de Licencia</p>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:18px;color:#ffffff;letter-spacing:1px;word-break:break-all;">${data.token}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Info licencia -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8f0;border-radius:8px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e8e8f0;">
                  <span style="font-size:13px;color:#8888a0;">Costo mensual</span><br>
                  <strong style="font-size:15px;color:#1a1a2e;">$1,500 MXN</strong>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid #e8e8f0;">
                  <span style="font-size:13px;color:#8888a0;">Válido hasta</span><br>
                  <strong style="font-size:15px;color:#1a1a2e;">${expiryDate}</strong>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:16px 20px;">
                  <span style="font-size:13px;color:#8888a0;">Estado</span><br>
                  <strong style="font-size:15px;color:#22c55e;">🟢 Activa</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${downloadSection}
        ${bankSection}

        <!-- Notas importantes -->
        <tr>
          <td style="padding:0 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#fef2f2;border-radius:8px;padding:20px 24px;">
                  <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#991b1b;">⚠️ Notas Importantes</p>
                  <ul style="margin:0;padding-left:18px;color:#7f1d1d;font-size:13px;line-height:1.8;">
                    <li>Este token solo puede ser redimido <strong>una vez</strong></li>
                    <li>Solo puede usarse en <strong>un dispositivo</strong></li>
                    <li>No compartas tu token con terceros</li>
                    <li>El mal uso puede resultar en la cancelación de la licencia</li>
                  </ul>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8fc;padding:24px 32px;text-align:center;border-top:1px solid #e8e8f0;">
            <p style="margin:0;font-size:13px;color:#8888a0;">
              ¿Necesitas ayuda? Contáctanos en
              <a href="mailto:automike@havanitechnologies.com" style="color:#4f46e5;text-decoration:none;">automike@havanitechnologies.com</a>
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#b0b0c8;">&copy; ${new Date().getFullYear()} Havani. Todos los derechos reservados.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Envío de email de bienvenida
// ---------------------------------------------------------------------------

interface EmailResult {
  success: boolean;
  message: string;
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { success: false, message: 'Email no configurado' };
  }

  try {
    await sendMailViaGraph(
      data.email,
      'Tu Licencia de AutoMike — Token y Datos de Acceso',
      buildWelcomeHtml(data),
    );
    return { success: true, message: `Email enviado a ${data.email}` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error al enviar email:', msg);
    return { success: false, message: msg };
  }
}
