import Joi from "joi";

// Definición de validaciones para el `user_id`
const user_id = Joi.number().required();

// Para los días de rutina, cada día debe ser un string de un día de la semana
const days_of_week = Joi.array().items(
  Joi.string().valid("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo").required()
).min(1).required(); // Al menos un día debe ser seleccionado

// Para el estado de la rutina, validamos si es "completado" o "pendiente"
const status = Joi.string().valid("completado", "pendiente").required();

export const createRoutineDto = Joi.object({
  selected_days: days_of_week,  // Días seleccionados para la rutina
});

export const getRoutineDto = Joi.object({
  user_id,  // ID del usuario para obtener la rutina
});

export const updateRoutineStatusDto = Joi.object({
  day: Joi.string().valid("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo").required(),  // Día de la semana
  date: Joi.date().required(),  // Fecha del día
  status,  // Estado del día ("completado" o "pendiente")
});

export const deleteRoutineDto = Joi.object({
  day: Joi.string().valid("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo").required(),  // Día a eliminar
  date: Joi.date().required(),  // Fecha del día a eliminar
});
