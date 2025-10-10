import Joi from "joi";
const email = Joi.string().email({ tlds: { allow: false } });
const phonenumber = Joi.string();
const platform = Joi.string().valid("web", "mobile").optional();
const name = Joi.string().optional();
const otp = Joi.number().required();

export const sendOtpDto = Joi.object({
  phonenumber,
  platform,
  email,
  name,
});

export const validateOtpDto = Joi.object({
  email,
  phonenumber,
  otp,
});
