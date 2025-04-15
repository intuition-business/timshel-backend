import twilio from "twilio";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
} from "../../../../config";

export const sendWithEmail = async (
  phonenumber: string,
  name: string,
  otp: string
) => {
  const date = new Date();

  const response = { message: "", error: false, code: "", date };

  try {
    // const twilioNumber = TWILIO_NUMBER;
    //const twilioData = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    /* const msgOptions = {
      from: twilioNumber,
      to: phonenumber,
      body: `Hola ${name}, bienvenido a Timshel, tu codigo es : ${otp}`,
    }; */
    return response;
  } catch (error: any) {
    response.error = true;
    response.message = error.message;
    return response;
  }
};
