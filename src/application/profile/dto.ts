import Joi from "joi";
const user_id = Joi.number();


export const createFormsDto = Joi.object({
  user_id,
  image: Joi.string().required(),
});

export const getFormsDto = Joi.object({
  user_id,
});
