import Joi from "joi";
const email = Joi.string().email({ tlds: { allow: false } });
const password = Joi.string();

export const loginDto = Joi.object({
  email,
  password,
});
