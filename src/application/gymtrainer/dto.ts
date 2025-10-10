// dto.ts for trainers
import Joi from "joi";

// Definición de validaciones para los campos
const id = Joi.number().required().messages({
  'number.base': 'El ID debe ser un número',
  'any.required': 'El ID es requerido'
});

const name = Joi.string().trim().required().messages({
  'string.base': 'El nombre debe ser un string',
  'any.required': 'El nombre es requerido'
});

const email = Joi.string().email().trim().required().messages({
  'string.base': 'El email debe ser un string',
  'string.email': 'El email debe ser válido',
  'any.required': 'El email es requerido'
});

const phone = Joi.string().trim().required().messages({
  'string.base': 'El teléfono debe ser un string',
  'any.required': 'El teléfono es requerido'
});

const biography = Joi.string().trim().optional().messages({
  'string.base': 'La biografía debe ser un string'
});

const experience_years = Joi.number().optional().messages({
  'number.base': 'Los años de experiencia deben ser un número'
});

const certifications = Joi.string().trim().optional().messages({
  'string.base': 'Las certificaciones deben ser un string'
});

const profile_photo = Joi.string().trim().optional().messages({
  'string.base': 'La foto de perfil debe ser un string'
});

const new_name = Joi.string().trim().optional().messages({
  'string.base': 'El nuevo nombre debe ser un string'
});

const new_email = Joi.string().email().trim().optional().messages({
  'string.base': 'El nuevo email debe ser un string',
  'string.email': 'El nuevo email debe ser válido'
});

const new_phone = Joi.string().trim().optional().messages({
  'string.base': 'El nuevo teléfono debe ser un string'
});

const new_biography = Joi.string().trim().optional().messages({
  'string.base': 'La nueva biografía debe ser un string'
});

const new_experience_years = Joi.number().optional().messages({
  'number.base': 'Los nuevos años de experiencia deben ser un número'
});

const new_certifications = Joi.string().trim().optional().messages({
  'string.base': 'Las nuevas certificaciones deben ser un string'
});

const new_profile_photo = Joi.string().trim().optional().messages({
  'string.base': 'La nueva foto de perfil debe ser un string'
});

export const createTrainerDto = Joi.object({
  name,
  email,
  phone,
  biography,
  experience_years,
  certifications,
  profile_photo
});

export const getTrainerDto = Joi.object({
  id
});

export const updateTrainerDto = Joi.object({
  id,
  new_name,
  new_email,
  new_phone,
  new_biography,
  new_experience_years,
  new_certifications,
  new_profile_photo
}).or('new_name', 'new_email', 'new_phone', 'new_biography', 'new_experience_years', 'new_certifications', 'new_profile_photo').messages({
  'object.missing': 'Debe proporcionar al menos un campo para actualizar: new_name, new_email, new_phone, new_biography, new_experience_years, new_certifications o new_profile_photo'
});

export const deleteTrainerDto = Joi.object({
  id
});

export const assignUserDto = Joi.object({
  trainerId: Joi.number().required().messages({
    'number.base': 'El ID del entrenador debe ser un número',
    'any.required': 'El ID del entrenador es requerido'
  }),
  userId: Joi.number().required().messages({
    'number.base': 'El ID del usuario debe ser un número',
    'any.required': 'El ID del usuario es requerido'
  })
});

export const getTrainersListDto = Joi.object({
  length: Joi.number().optional().messages({
    'number.base': 'El length debe ser un número'
  }),
  random: Joi.boolean().optional().messages({
    'boolean.base': 'El random debe ser un booleano (true/false)'
  })
});