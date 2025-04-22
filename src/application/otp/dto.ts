import Joi from "joi";
const email = Joi.string().email({ tlds: { allow: false } });
const phonenumber = Joi.string();
const name = Joi.string().required();
const otp = Joi.number().required();

export const sendOtpDto = Joi.object({
  phonenumber,
  email,
  name,
});

export const validateOtpDto = Joi.object({
  email,
  phonenumber,
  otp,
});
