// src/api/users/dto.ts
import Joi from "joi";

export const getUsersListDto = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'La página debe ser un número entero',
      'number.min': 'La página debe ser al menos 1',
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.base': 'El límite debe ser un número entero',
      'number.min': 'El límite debe ser al menos 1',
      'number.max': 'El límite no puede exceder 100',
    }),

  name: Joi.string()
    .trim()
    .optional()
    .messages({
      'string.base': 'El nombre debe ser una cadena de texto',
    }),

  with_trainer: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'with_trainer debe ser true o false',
    }),

  with_image: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'with_image debe ser true o false',
    }),

  plan_id: Joi.number()
    .integer()
    .optional()
    .messages({
      'number.base': 'plan_id debe ser un número entero',
    }),
}).unknown(false); // Rechaza parámetros no permitidos