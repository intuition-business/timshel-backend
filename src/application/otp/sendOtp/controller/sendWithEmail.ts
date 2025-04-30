import sendgrid from "@sendgrid/mail";
import { API_KEY_SENDGRID } from "../../../../config";

export const sendWithEmail = async (
  email: string,
  name: string,
  otp: number
) => {
  const date = new Date();
  sendgrid.setApiKey(API_KEY_SENDGRID);
  const response = { message: "", error: false, code: otp, date };

  try {
    const message = {
      to: email,
      from: "info@intuitionstudio.co",
      subject: `Hola, ${name}. Bienvenido a timshell.`,
      text: `Tu codigo es : ${otp}`,
      html: `<h4>Hola, ${name}. Tu codigo es : <b>${otp}</b></h4>`,
    };

    const data = await sendgrid.send(message);

    if (!data[0].statusCode) {
      response.error = true;
      response.message = "Ocurrio un error";
    }
    response.message = "Email enviado";
    return response;
  } catch (error: any) {
    response.error = true;
    response.message = error.message;
    return response;
  }
};
