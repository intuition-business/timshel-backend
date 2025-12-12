import Joi from "joi";

// Definimos el enum directamente aquí en el mismo archivo
enum MuscleGroup {
  Small = "musculos pequeños",
  Large = "musculos grandes"
}

// Validaciones existentes
const category = Joi.string().trim().optional().messages({
  'string.base': 'La categoría debe ser un string',
});

const exercise = Joi.string().trim().optional().messages({
  'string.base': 'El ejercicio debe ser un string',
});

const description = Joi.string().trim().optional().messages({
  'string.base': 'La descripción debe ser un string',
});

const new_video_url = Joi.string().trim().uri().optional().messages({
  'string.base': 'La URL del video debe ser un string',
  'string.uri': 'La URL del video debe ser válida'
});

const new_thumbnail_url = Joi.string().trim().uri().optional().messages({
  'string.base': 'La URL de la miniatura debe ser un string',
  'string.uri': 'La URL de la miniatura debe ser una URL válida'
});

const at_home = Joi.boolean().optional().allow(null).messages({
  'boolean.base': 'at_home debe ser un booleano o null'
});

const new_at_home = Joi.boolean().optional().allow(null).messages({
  'boolean.base': 'new_at_home debe ser un booleano o null'
});

// Validaciones para el grupo muscular usando el enum
const muscle_group = Joi.string()
  .valid(MuscleGroup.Small, MuscleGroup.Large)
  .optional()
  .messages({
    'any.only': `El grupo muscular debe ser "${MuscleGroup.Small}" o "${MuscleGroup.Large}"`,
    'string.base': 'El grupo muscular debe ser un string'
  });

const new_muscle_group = Joi.string()
  .valid(MuscleGroup.Small, MuscleGroup.Large)
  .optional()
  .messages({
    'any.only': `El nuevo grupo muscular debe ser "${MuscleGroup.Small}" o "${MuscleGroup.Large}"`,
    'string.base': 'El nuevo grupo muscular debe ser un string'
  });

// CREATE EXERCISE DTO
export const createExerciseDto = Joi.object({
  category,
  exercise,
  description,
  at_home,
  video_url: new_video_url,
  thumbnail_url: new_thumbnail_url,
  muscle_group, // ← Campo nuevo con validación por enum
  // Si lo quieres obligatorio: muscle_group: muscle_group.required()
});

// GET EXERCISE DTO (opcional: permitir filtrar por grupo muscular)
export const getExerciseDto = Joi.object({
  category: Joi.string().trim().optional(),
  muscle_group: Joi.string()
    .valid(MuscleGroup.Small, MuscleGroup.Large)
    .optional()
    .messages({
      'any.only': 'Filtro de grupo muscular inválido'
    })
});

// UPDATE EXERCISE DTO
export const updateExerciseDto = Joi.object({
  new_category: Joi.string().trim().optional(),
  new_exercise: Joi.string().trim().optional(),
  new_description: Joi.string().trim().optional(),
  new_video_url,
  new_thumbnail_url,
  new_at_home,
  new_muscle_group // ← Campo nuevo para actualización
});

// DELETE EXERCISE DTO (sin cambios)
export const deleteExerciseDto = Joi.object({
  category,
  exercise,
  video_url: new_video_url,
  thumbnail_url: new_thumbnail_url
});