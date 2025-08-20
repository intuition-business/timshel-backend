import Joi from "joi";

// Definición de validaciones para category, exercise y description
const category = Joi.string().trim().required().messages({
  'string.base': 'La categoría debe ser un string',
  'any.required': 'La categoría es requerida'
});

const exercise = Joi.string().trim().required().messages({
  'string.base': 'El ejercicio debe ser un string',
  'any.required': 'El ejercicio es requerido'
});

const description = Joi.string().trim().required().messages({
  'string.base': 'La descripción debe ser un string',
  'any.required': 'La descripción es requerida'
});

const new_category = Joi.string().trim().optional().messages({
  'string.base': 'La nueva categoría debe ser un string'
});

const new_exercise = Joi.string().trim().optional().messages({
  'string.base': 'El nuevo ejercicio debe ser un string'
});

const new_description = Joi.string().trim().optional().messages({
  'string.base': 'La nueva descripción debe ser un string'
});

export const createExerciseDto = Joi.object({
  category,
  exercise,
  description
});

export const getExerciseDto = Joi.object({
  // Para getAllExercises no se necesita nada, pero para getExercisesByCategory validamos category como query param opcional
  category: Joi.string().trim().optional().messages({
    'string.base': 'La categoría debe ser un string'
  })
});

export const updateExerciseDto = Joi.object({
  category,
  exercise,
  new_category,
  new_exercise,
  new_description
}).or('new_category', 'new_exercise', 'new_description').messages({
  'object.missing': 'Debe proporcionar al menos un campo para actualizar: new_category, new_exercise o new_description'
});

export const deleteExerciseDto = Joi.object({
  category,
  exercise
});