import Joi from "joi";

const name = Joi.string().required();
const birthday = Joi.string().required();
const gender = Joi.string().required();
const weight = Joi.number().required();
const height = Joi.number().required();
const activity_factor = Joi.string().required();
const goal = Joi.string().required();
const weekly_availability = Joi.string().required();
const hours_per_day = Joi.number().required();
const injury = Joi.string().required();
const pathology = Joi.string().required();
const usually_breakfast = Joi.string().required();
const usually_lunch = Joi.string().required();
const usually_dinner = Joi.string().required();
const user_id = Joi.number();
// const age = Joi.number();
const allergy = Joi.string().required();
const illness = Joi.string().required();
const foods_not_consumed = Joi.string().required();
export const createFormsDto = Joi.object({
  user_id,
  height,
  // age,
  weight,
  gender,
  activity_factor,
  goal,
  hours_per_day,
  injury,
  pathology,
  foods_not_consumed,
  illness,
  allergy,
  usually_dinner,
  usually_lunch,
  usually_breakfast,
  weekly_availability,
  birthday,
  name,
});

export const getFormsDto = Joi.object({
  user_id,
});
