import Joi from "joi";

// Definición de validaciones para los campos
const id = Joi.number().required().messages({
    'number.base': 'El ID debe ser un número',
    'any.required': 'El ID es requerido'
});

const title = Joi.string().trim().required().messages({
    'string.base': 'El título debe ser un string',
    'any.required': 'El título es requerido'
});

const price_cop = Joi.number().positive().required().messages({
    'number.base': 'El precio en COP debe ser un número',
    'number.positive': 'El precio debe ser positivo',
    'any.required': 'El precio es requerido'
});

const description_items = Joi.array().items(Joi.string().trim()).required().messages({
    'array.base': 'Los items de descripción deben ser un array',
    'any.required': 'Los items de descripción son requeridos'
});

const new_title = Joi.string().trim().optional().messages({
    'string.base': 'El nuevo título debe ser un string'
});

const new_price_cop = Joi.number().positive().optional().messages({
    'number.base': 'El nuevo precio en COP debe ser un número',
    'number.positive': 'El nuevo precio debe ser positivo'
});

const new_description_items = Joi.array().items(Joi.string().trim()).optional().messages({
    'array.base': 'Los nuevos items de descripción deben ser un array'
});

export const createPlanDto = Joi.object({
    title,
    price_cop,
    description_items
});

export const getPlanDto = Joi.object({
    id
});

export const updatePlanDto = Joi.object({
    id,
    new_title,
    new_price_cop,
    new_description_items
}).or('new_title', 'new_price_cop', 'new_description_items').messages({
    'object.missing': 'Debe proporcionar al menos un campo para actualizar: new_title, new_price_cop o new_description_items'
});

export const deletePlanDto = Joi.object({
    id
});