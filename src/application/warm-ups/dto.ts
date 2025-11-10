// src/warmups/dto.ts
import Joi from "joi";

const name = Joi.string().trim().min(3).max(100).required().messages({
  "string.base": "El nombre debe ser un texto",
  "any.required": "El nombre es requerido",
  "string.min": "El nombre debe tener al menos 3 caracteres",
  "string.max": "El nombre no puede exceder 100 caracteres",
});

const description = Joi.string().trim().min(10).max(500).required().messages({
  "string.base": "La descripción debe ser un texto",
  "any.required": "La descripción es requerida",
  "string.min": "La descripción debe tener al menos 10 caracteres",
});

const duration_in_minutes = Joi.number().integer().min(1).max(60).required().messages({
  "number.base": "La duración debe ser un número",
  "any.required": "La duración es requerida",
  "number.min": "La duración mínima es 1 minuto",
  "number.max": "La duración máxima es 60 minutos",
});

// =======================
// CREATE → TODOS REQUERIDOS
// =======================
export const createWarmUpDto = Joi.object({
  name,
  description,
  duration_in_minutes,
});

// =======================
// GET → QUERY PARAMS
// =======================
export const getWarmUpDto = Joi.object({
  length: Joi.number().integer().min(1).max(100).optional(),
  random: Joi.string().valid("true", "false").optional(),
});

// =======================
// UPDATE → TODOS OPCIONALES + PERMITE BODY VACÍO
// =======================
export const updateWarmUpDto = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional(),
  description: Joi.string().trim().min(10).max(500).optional(),
  duration_in_minutes: Joi.number().integer().min(1).max(60).optional(),
}).min(0); // ← CLAVE: permite body vacío si solo hay archivos

// =======================
// DELETE → solo ID en params (no en body)
// =======================
export const deleteWarmUpDto = Joi.object({
  id: Joi.number().integer().positive().required(),
});