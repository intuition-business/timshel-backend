import Joi from "joi";
const user_id = Joi.number();
const height = Joi.number().required();
const birth_date = Joi.number().required();
const weight = Joi.number().required();
const gender = Joi.string().required();
const activity_factor = Joi.string().required();
const goal = Joi.string().required();
const availability = Joi.string().required();
const hours_per_day = Joi.number().required();
const injury = Joi.string().required();
const pathology = Joi.string().required();
const food = Joi.string().required();
const meals_per_day = Joi.number().required();
const foods_not_consumed = Joi.string().required();
const illness = Joi.string().required();


export const createFormsDto = Joi.object({
  user_id,
  height,
  birth_date,
  weight,
  gender,
  activity_factor,
  goal,
  availability,
  hours_per_day,
  injury,
  pathology,
  food,
  meals_per_day,
  foods_not_consumed,
  illness,
});

export const getFormsDto = Joi.object({
  user_id,
});
