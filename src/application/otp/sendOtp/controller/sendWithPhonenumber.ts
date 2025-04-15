import twilio from "twilio";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
} from "../../../../config";

export const sendWithPhonenumber = async (
  phonenumber: string,
  name: string,
  otp: string
) => {
  const date = new Date();

  const response = { message: "", error: false, code: "", date };

  try {
    const twilioNumber = TWILIO_NUMBER;
    const twilioData = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    const msgOptions = {
      from: twilioNumber,
      to: phonenumber,
      body: `Hola ${name}, bienvenido a Timshel, tu codigo es : ${otp}`,
    };
    const message = await twilioData.messages.create(msgOptions);
    console.log(message);
    if (message) {
      response.message = "mensaje enviado";
      response.code = otp;
    } else {
      response.error = true;
      response.message = "Algo salio mal. Intentalo mas tarde";
    }

    return response;
  } catch (error: any) {
    response.error = true;
    response.message = error.message;
    return response;
  }
};
