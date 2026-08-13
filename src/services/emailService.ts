import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from '@getbrevo/brevo';
import { BREVO_API_KEY } from '../config';

const getApiInstance = () => {
  const apiInstance = new TransactionalEmailsApi();
  apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);
  return apiInstance;
};

export const sendTrainerNewUserNotification = async (params: {
  trainerEmail: string;
  trainerName: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  planTitle: string;
  planPrice: number;
}) => {
  const { trainerEmail, trainerName, userName, userEmail, userPhone, planTitle, planPrice } = params;

  const apiInstance = getApiInstance();
  const email = new SendSmtpEmail();

  const priceFormatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(planPrice);

  email.subject = `¡Nuevo usuario te eligió como entrenador en Timshell!`;
  email.sender = { name: 'Timshell', email: 'admin@timshell.co' };
  email.to = [{ email: trainerEmail, name: trainerName }];
  email.replyTo = { email: 'admin@timshell.co', name: 'Soporte Timshell' };

  email.htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Nuevo usuario en Timshell</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f0f0f;padding:28px 40px;text-align:center;">
              <img src="https://timshell.co/logo.png" alt="Timshell" width="180" style="display:block;margin:0 auto;max-width:180px;" />
            </td>
          </tr>
          <!-- Separador amarillo header -->
          <tr>
            <td style="background-color:#dff400;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:40px 40px 20px;">
              <p style="margin:0 0 8px;color:#dff400;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">¡Buenas noticias!</p>
              <h2 style="margin:0 0 24px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">
                Hola ${trainerName}, tienes un nuevo usuario
              </h2>
              <p style="margin:0 0 28px;color:#aaaaaa;font-size:15px;line-height:1.6;">
                <strong style="color:#ffffff;">${userName}</strong> acaba de adquirir el plan
                <strong style="color:#dff400;">${planTitle}</strong> y te eligió como su entrenador personal en Timshell.
              </p>

              <!-- Tarjeta usuario -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#242424;border-radius:12px;border-left:4px solid #dff400;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 6px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Información del usuario</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #333;">
                          <span style="color:#888;font-size:13px;">Nombre</span>
                          <span style="float:right;color:#ffffff;font-size:14px;font-weight:600;">${userName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #333;">
                          <span style="color:#888;font-size:13px;">Correo</span>
                          <span style="float:right;color:#ffffff;font-size:14px;">${userEmail}</span>
                        </td>
                      </tr>
                      ${userPhone ? `
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #333;">
                          <span style="color:#888;font-size:13px;">Teléfono</span>
                          <span style="float:right;color:#ffffff;font-size:14px;">${userPhone}</span>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #333;">
                          <span style="color:#888;font-size:13px;">Plan adquirido</span>
                          <span style="float:right;color:#dff400;font-size:14px;font-weight:700;">${planTitle}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;">
                          <span style="color:#888;font-size:13px;">Valor del plan</span>
                          <span style="float:right;color:#ffffff;font-size:14px;font-weight:600;">${priceFormatted} COP</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Qué hacer ahora -->
              <p style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:700;">¿Qué debes hacer ahora?</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                    <span style="color:#dff400;font-size:18px;margin-right:12px;">①</span>
                    <span style="color:#cccccc;font-size:14px;">Ingresa al panel de administración en <strong style="color:#ffffff;">timshell.co</strong></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                    <span style="color:#dff400;font-size:18px;margin-right:12px;">②</span>
                    <span style="color:#cccccc;font-size:14px;">Ve a la sección <strong style="color:#ffffff;">Mis usuarios</strong> y revisa el perfil de ${userName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                    <span style="color:#dff400;font-size:18px;margin-right:12px;">③</span>
                    <span style="color:#cccccc;font-size:14px;">Revisa la rutina generada automáticamente y personalízala si lo consideras necesario</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="color:#dff400;font-size:18px;margin-right:12px;">④</span>
                    <span style="color:#cccccc;font-size:14px;">Contáctate con tu nuevo usuario para coordinar el seguimiento</span>
                  </td>
                </tr>
              </table>

              <!-- Políticas -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e1e1e;border-radius:10px;border:1px solid #2e2e2e;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Recuerda — Compromisos del entrenador</p>
                    <ul style="margin:0;padding-left:18px;color:#aaaaaa;font-size:13px;line-height:1.9;">
                      <li>Responder al usuario en un plazo máximo de <strong style="color:#ffffff;">24 horas</strong>.</li>
                      <li>Personalizar y supervisar las rutinas generadas por la plataforma.</li>
                      <li>Brindar seguimiento continuo durante el periodo del plan.</li>
                      <li>Mantener una comunicación respetuosa y profesional en todo momento.</li>
                      <li>Cualquier inconveniente, escríbenos a <strong style="color:#dff400;">admin@timshell.co</strong></li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <a href="https://timshell.co" style="display:inline-block;background-color:#dff400;color:#0f0f0f;font-size:15px;font-weight:800;text-decoration:none;padding:14px 40px;border-radius:50px;letter-spacing:0.3px;">
                      Ir al panel de administración →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Separador amarillo footer -->
          <tr>
            <td style="background-color:#dff400;height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#555;font-size:12px;line-height:1.6;">
                Este mensaje fue generado automáticamente por Timshell.<br/>
                Si tienes alguna pregunta, escríbenos a
                <a href="mailto:admin@timshell.co" style="color:#dff400;text-decoration:none;">admin@timshell.co</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  email.textContent = `
Hola ${trainerName},

¡${userName} acaba de elegirte como su entrenador personal en Timshell!

Plan adquirido: ${planTitle} (${priceFormatted} COP)
Correo del usuario: ${userEmail}
${userPhone ? `Teléfono: ${userPhone}` : ''}

Qué hacer ahora:
1. Ingresa al panel en timshell.co
2. Ve a "Mis usuarios" y revisa el perfil de ${userName}
3. Revisa y personaliza la rutina generada
4. Contáctate con tu nuevo usuario

Recuerda responder al usuario en máximo 24 horas.

Saludos,
Timshell — admin@timshell.co
  `.trim();

  try {
    const data = await apiInstance.sendTransacEmail(email);
    if (!data.body.messageId) {
      console.error('[emailService] sendTrainerNewUserNotification: no messageId');
      return false;
    }
    return true;
  } catch (error: any) {
    console.error('[emailService] sendTrainerNewUserNotification error:', error.response?.body || error);
    return false;
  }
};
