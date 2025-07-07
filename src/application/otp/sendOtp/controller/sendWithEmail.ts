import sendgrid from "@sendgrid/mail";
import { API_KEY_SENDGRID } from "../../../../config";

export const sendWithEmail = async (
  email: string,
  otp: number,
  name?: string
) => {
  const date = new Date();
  sendgrid.setApiKey(API_KEY_SENDGRID);
  const response = { message: "", error: false, code: otp, date };

  const message = {
    to: email,
    from: "urielmarciales@gmail.com",
    subject: `Hola ${name}. Bienvenido a timshel.`,
    text: `Tu codigo es : ${otp}`,
    html: `<h4>¡Hola ${name}!</h4>
<p>Gracias por tu interés en Timshel. Para asegurarnos de que eres tú, hemos enviado este código de verificación único.</p>
<p>Tu código es: <b>${otp}</b></p>
<p>Por favor, ingrésalo en nuestra APP para completar tu proceso. ¡Solo tomará un segundo!</p>
<p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
<p>¡Que tengas un excelente día!</p>
<p>Saludos,<br> ${name}</p>`,
  };

  try {
    const data = await sendgrid.send(message);
    if (!data[0]?.statusCode) {
      response.error = true;
      response.message = "Ocurrio un error";
    }
    response.message = "Email enviado";
    return response;
  } catch (error: any) {
    console.error("SendGrid error:", error.response?.body || error);
    response.error = true;
    response.message = error.message;
    return response;
  }
};
