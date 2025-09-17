import Joi from "joi";

// Definición de validaciones para el `user_id`
const user_id = Joi.number().required();

// Para el peso, debe ser un número positivo
const weight = Joi.number().positive().required();

// Para la fecha, validamos como fecha
const date = Joi.date().required();

export const createWeightDto = Joi.object({
    weight,
    date,
});

export const getWeightsDto = Joi.object({
    // El `user_id` se obtiene del token JWT, pero puede ser útil para validación adicional si se pasa por la URL
    user_id: Joi.number().required(),
});

export const updateWeightDto = Joi.object({
    date,
    weight,
});

export const deleteWeightDto = Joi.object({
    date,
});