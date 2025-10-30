import Joi from "joi";

// Definición de validaciones para category, exercise y description
const category = Joi.string().trim().optional().messages({
  'string.base': 'La categoría debe ser un string',
  'any.required': 'La categoría es requerida'
});

const exercise = Joi.string().trim().optional().messages({
  'string.base': 'El ejercicio debe ser un string',
  'any.required': 'El ejercicio es requerido'
});

const description = Joi.string().trim().optional().messages({
  'string.base': 'La descripción debe ser un string',
  'any.required': 'La descripción es requerida'
});


const new_exercise = Joi.string().trim().optional().messages({
  'string.base': 'El nuevo ejercicio debe ser un string'
});

const new_description = Joi.string().trim().optional().messages({
  'string.base': 'La nueva descripción debe ser un string'
});
const new_video_url = Joi.string().trim().optional().messages({
  'string.base': 'La nueva URL del video debe ser un string'
});
const new_thumbnail_url = Joi.string().trim().optional().messages({
  'string.base': 'La nueva URL de la miniatura debe ser un string'
});
const at_home = Joi.boolean().optional().allow(null).messages({
  'boolean.base': 'at_home debe ser un booleano o null'
});

const new_at_home = Joi.boolean().optional().allow(null).messages({
  'boolean.base': 'new_at_home debe ser un booleano o null'
});

// Add this near the top with other validations
const exerciseId = Joi.number().integer().positive().required().messages({
  'number.base': 'exerciseId debe ser un número',
  'number.integer': 'exerciseId debe ser un entero',
  'number.positive': 'exerciseId debe ser positivo',
  'any.required': 'exerciseId es requerido'
});


export const createExerciseDto = Joi.object({
  category,
  exercise,
  description,
  at_home,
  video_url: new_video_url,
  thumbnail_url: new_thumbnail_url
});

export const getExerciseDto = Joi.object({
  // Para getAllExercises no se necesita nada, pero para getExercisesByCategory validamos category como query param opcional
  category: Joi.string().trim().optional().messages({
    'string.base': 'La categoría debe ser un string'
  })
});

// Then update the export
export const updateExerciseDto = Joi.object({
  new_category: Joi.string().trim().optional().messages({
    'string.base': 'La nueva categoría debe ser un string'
  }),
  new_exercise: Joi.string().trim().optional().messages({
    'string.base': 'El nuevo ejercicio debe ser un string'
  }),
  new_description: Joi.string().trim().optional().messages({
    'string.base': 'La nueva descripción debe ser un string'
  }),
  new_video_url: Joi.string().trim().optional().messages({
    'string.base': 'La nueva URL del video debe ser un string'
  }),
  new_thumbnail_url: Joi.string().trim().optional().messages({
    'string.base': 'La nueva URL de la miniatura debe ser un string'
  }),
  new_at_home: Joi.boolean().optional().allow(null).messages({
    'boolean.base': 'new_at_home debe ser un booleano o null'
  })
});

export const deleteExerciseDto = Joi.object({
  category,
  exercise,
  video_url: new_video_url,
  thumbnail_url: new_thumbnail_url
});