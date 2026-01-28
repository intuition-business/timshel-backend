import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from '@getbrevo/brevo';

import { BREVO_API_KEY } from '../../../../config';

export const sendWithEmail = async (
  email: string,
  otp: number | string,
  name?: string
) => {
  const date = new Date();
  const response = { message: "", error: false, code: otp, date };

  const apiInstance = new TransactionalEmailsApi();

  apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = `Hola ${name}. Bienvenido a timshel.`;
  sendSmtpEmail.htmlContent = `<h4>¡Hola ${name}!</h4>
<p>Gracias por tu interés en Timshel. Para asegurarnos de que eres tú, hemos enviado este código de verificación único.</p>
<p>Tu código es: <b>${otp}</b></p>
<p>Por favor, ingrésalo en nuestra APP para completar tu proceso. ¡Solo tomará un segundo!</p>
<p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
<p>¡Que tengas un excelente día!</p>
<p>Saludos,<br> ${name}</p>`;
  sendSmtpEmail.textContent = `Tu código es: ${otp}`;

  // Actualiza la dirección de correo remitente y la dirección de respuesta
  sendSmtpEmail.sender = { name: 'Timshel', email: 'admin@timshell.co' };
  sendSmtpEmail.to = [{ email, name: name || 'Usuario' }];
  sendSmtpEmail.replyTo = { email: 'admin@timshell.co', name: 'Soporte Timshel' };

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    if (!data.body.messageId) {
      response.error = true;
      response.message = "Ocurrió un error";
    } else {
      response.message = "Email enviado";
    }
    return response;
  } catch (error: any) {
    console.error("Brevo error:", error.response?.body || error);
    response.error = true;
    response.message = error.message || "Error en el envío";
    return response;
  }
};
