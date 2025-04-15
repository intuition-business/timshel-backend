import Joi from "joi";

const email = Joi.string().email({ tlds: { allow: false } });
const password = Joi.string().min(8);
const phonenumber = Joi.string()
  .pattern(/^\+?[0-9]+$/)
  .min(7)
  .max(15);
const weight = Joi.number().positive();
const age = Joi.number().integer().min(1).max(150);
const gender = Joi.string();
const rol = Joi.number().integer().min(0);
const reason = Joi.string().min(3).max(255);
const otp_email = Joi.number().integer().min(100000).max(999999);
const otp_phone = Joi.number().integer().min(100000).max(999999);
const name = Joi.string().min(2).max(100);
const password_confirmation = Joi.string()
  .valid(Joi.ref("password"))

  .messages({ "any.only": "Las contraseñas deben coincidir" });

export const registerDto = Joi.object({
  name,
  email,
  password,
  password_confirmation,
  phone: phonenumber,
  weight,
  age,
  gender,
  rol,
  reason,
  otp_email,
  otp_phone,
});
