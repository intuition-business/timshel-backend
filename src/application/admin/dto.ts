// dto.ts for users (nuevo para usuarios, similar al ejemplo de trainers)
import Joi from "joi";

// Definición de validaciones para los campos de usuarios (ajusta según tu tabla 'usuarios')
const id = Joi.number().required().messages({
  'number.base': 'El ID debe ser un número',
  'any.required': 'El ID es requerido'
});

const name = Joi.string().trim().optional().messages({
  'string.base': 'El nombre debe ser un string'
});

const email = Joi.string().email().trim().optional().messages({
  'string.base': 'El email debe ser un string',
  'string.email': 'El email debe ser válido'
});

const phone = Joi.string().trim().optional().messages({
  'string.base': 'El teléfono debe ser un string'
});

// Para query params en list (similar a getTrainersListDto)
export const getUsersListDto = Joi.object({
  length: Joi.number().optional().messages({
    'number.base': 'El length debe ser un número'
  }),
  random: Joi.boolean().optional().messages({
    'boolean.base': 'El random debe ser un booleano (true/false)'
  }),
  with_trainer: Joi.boolean().optional().messages({
    'boolean.base': 'with_trainer debe ser un booleano (true/false)'
  })
});