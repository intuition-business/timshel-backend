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

const description = Joi.string().trim().optional().messages({
  'string.base': 'La descripción debe ser un string'
});

const goal = Joi.string().trim().optional().messages({
  'string.base': 'La meta debe ser un string'
});

const rating = Joi.number().min(0).max(5).optional().messages({
  'number.base': 'La calificación debe ser un número',
  'number.min': 'La calificación mínima es 0',
  'number.max': 'La calificación máxima es 5'
});

const experience_years = Joi.number().optional().messages({
  'number.base': 'Los años de experiencia deben ser un número'
});

const certifications = Joi.string().trim().optional().messages({
  'string.base': 'Las certificaciones deben ser un string'
});

const image = Joi.string().trim().optional().messages({
  'string.base': 'La imagen debe ser un string'
});

// Campos para actualización
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

const new_description = Joi.string().trim().optional().messages({
  'string.base': 'La nueva descripción debe ser un string'
});

const new_goal = Joi.string().trim().optional().messages({
  'string.base': 'La nueva meta debe ser un string'
});

const new_rating = Joi.number().min(0).max(5).optional().messages({
  'number.base': 'La nueva calificación debe ser un número',
  'number.min': 'La nueva calificación mínima es 0',
  'number.max': 'La nueva calificación máxima es 5'
});

const new_experience_years = Joi.number().optional().messages({
  'number.base': 'Los nuevos años de experiencia deben ser un número'
});

const new_certifications = Joi.string().trim().optional().messages({
  'string.base': 'Las nuevas certificaciones deben ser un string'
});

const new_image = Joi.string().trim().optional().messages({
  'string.base': 'La nueva imagen debe ser un string'
});

// ✅ DTO ANTIGUO (mantener para compatibilidad)
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

// ✅ NUEVO DTO para suscripción con plan (optimizado con unknown(true) para capturar errores)
export const assignUserWithPlanDto = Joi.object({
  trainer_id: Joi.number().required().messages({
    'number.base': 'El ID del entrenador debe ser un número',
    'any.required': 'El ID del entrenador es requerido'
  }),
  plan_id: Joi.number().required().messages({
    'number.base': 'El ID del plan debe ser un número',
    'any.required': 'El ID del plan es requerido'
  })
})
  .unknown(true) // ← Permite campos adicionales sin fallar, útil para depuración
  .messages({
    'object.missing': 'Deben proporcionarse trainer_id y plan_id'
  });

// DTOs existentes
export const createTrainerDto = Joi.object({
  name,
  email,
  phone,
  description,
  goal,
  rating,
  experience_years,
  certifications,
  image
});

export const getTrainerDto = Joi.object({
  id
});

export const updateTrainerDto = Joi.object({
  id,
  new_name,
  new_email,
  new_phone,
  new_description,
  new_goal,
  new_rating,
  new_experience_years,
  new_certifications,
  new_image
}).or('new_name', 'new_email', 'new_phone', 'new_description', 'new_goal', 'new_rating', 'new_experience_years', 'new_certifications', 'new_image').messages({
  'object.missing': 'Debe proporcionar al menos un campo para actualizar: new_name, new_email, new_phone, new_description, new_goal, new_rating, new_experience_years, new_certificaciones o new_image'
});

export const deleteTrainerDto = Joi.object({
  id
});

export const getTrainersListDto = Joi.object({
  name: Joi.string().optional().messages({
    'string.base': 'El nombre debe ser un string'
  }),
  length: Joi.number().optional().messages({
    'number.base': 'El length debe ser un número'
  }),
  random: Joi.boolean().optional().messages({
    'boolean.base': 'El random debe ser un booleano (true/false)'
  }),
  with_users: Joi.boolean().optional().messages({
    'boolean.base': 'with_users debe ser un booleano (true/false)'
  })
});