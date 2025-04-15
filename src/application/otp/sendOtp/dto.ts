import Joi from "joi";
const email = Joi.string().email({ tlds: { allow: false } });
const phonenumber = Joi.string();
const name = Joi.string().required();

export const sendOtpDto = Joi.object({
  phonenumber,
  email,
  name,
});

export const validateOtpDtoEmail = Joi.object({
  email,
});

export const validateOtpDtoPhone = Joi.object({
  email,
});
