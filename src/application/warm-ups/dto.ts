// dto.ts for warm-ups
import Joi from "joi";

// Definición de validaciones para los campos
const name = Joi.string().trim().required().messages({
  'string.base': 'El nombre debe ser un string',
  'any.required': 'El nombre es requerido'
});

const description = Joi.string().trim().required().messages({
  'string.base': 'La descripción debe ser un string',
  'any.required': 'La descripción es requerida'
});

const video_url = Joi.string().trim().required().messages({
  'string.base': 'La URL del video debe ser un string',
  'any.required': 'La URL del video es requerida'
});

const video_thumbnail = Joi.string().trim().required().messages({
  'string.base': 'La thumbnail del video debe ser un string',
  'any.required': 'La thumbnail del video es requerida'
});

const duration_in_minutes = Joi.number().required().messages({
  'number.base': 'La duración debe ser un número',
  'any.required': 'La duración es requerida'
});

const new_name = Joi.string().trim().optional().messages({
  'string.base': 'El nuevo nombre debe ser un string'
});

const new_description = Joi.string().trim().optional().messages({
  'string.base': 'La nueva descripción debe ser un string'
});

const new_video_url = Joi.string().trim().optional().messages({
  'string.base': 'La nueva URL del video debe ser un string'
});

const new_video_thumbnail = Joi.string().trim().optional().messages({
  'string.base': 'La nueva thumbnail del video debe ser un string'
});

const new_duration_in_minutes = Joi.number().optional().messages({
  'number.base': 'La nueva duración debe ser un número'
});

export const createWarmUpDto = Joi.object({
  name,
  description,
  video_url,
  video_thumbnail,
  duration_in_minutes
});

export const getWarmUpDto = Joi.object({
  length: Joi.number().optional().messages({
    'number.base': 'El length debe ser un número'
  }),
  random: Joi.boolean().optional().messages({
    'boolean.base': 'El random debe ser un booleano (true/false)'
  })
});

export const updateWarmUpDto = Joi.object({
  name,
  new_name,
  new_description,
  new_video_url,
  new_video_thumbnail,
  new_duration_in_minutes
}).or('new_name', 'new_description', 'new_video_url', 'new_video_thumbnail', 'new_duration_in_minutes').messages({
  'object.missing': 'Debe proporcionar al menos un campo para actualizar: new_name, new_description, new_video_url, new_video_thumbnail o new_duration_in_minutes'
});

export const deleteWarmUpDto = Joi.object({
  name
});