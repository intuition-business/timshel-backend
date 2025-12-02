import Joi from "joi";

const name = Joi.string();
const birthday = Joi.string();
const gender = Joi.string();
const weight = Joi.number();
const height = Joi.number();
const activity_factor = Joi.string();
const main_goal = Joi.string();

// Cambio 1: de string a array de strings
const favorite_muscular_group = Joi.array().items(Joi.string());

// Nuevo campo
const train_experience = Joi.string();

const training_place = Joi.string().valid("gym", "home", "outdoor");
const age = Joi.number();
const weekly_availability = Joi.string();
const hours_per_day = Joi.number();
const injury = Joi.string();
const pathology = Joi.string();
const usually_breakfast = Joi.string();
const usually_lunch = Joi.string();
const usually_dinner = Joi.string();
const user_id = Joi.number();
const allergy = Joi.string();
const illness = Joi.string();
const foods_not_consumed = Joi.string();

export const createFormsDto = Joi.object({
  user_id,
  height,
  weight,
  gender,
  activity_factor,
  main_goal,
  favorite_muscular_group,        // ahora acepta ["pecho", "espalda", ...]
  train_experience,               // nuevo campo agregado
  training_place,
  age,
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