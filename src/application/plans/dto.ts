import Joi from "joi";

const idParam = Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
        'number.base': 'El ID debe ser un número',
        'number.integer': 'El ID debe ser un número entero',
        'number.positive': 'El ID debe ser positivo',
        'any.required': 'El ID es requerido'
    });

const title = Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()
    .messages({
        'string.base': 'El título debe ser un string',
        'string.min': 'El título debe tener al menos 3 caracteres',
        'string.max': 'El título no puede exceder 100 caracteres',
        'any.required': 'El título es requerido'
    });

const price_cop = Joi.number()
    .min(0)
    .precision(2)
    .required()
    .messages({
        'number.base': 'El precio en COP debe ser un número',
        'number.min': 'El precio no puede ser negativo',
        'any.required': 'El precio es requerido'
    });

const description_items = Joi.array()
    .items(Joi.string().trim().min(1).max(200))
    .min(1)
    .required()
    .messages({
        'array.base': 'Los items de descripción deben ser un array',
        'array.min': 'Debe haber al menos 1 item de descripción',
        'any.required': 'Los items de descripción son requeridos'
    });

const description = Joi.string()
    .trim()
    .max(2000)
    .optional()
    .messages({
        'string.base': 'La descripción debe ser un string',
        'string.max': 'La descripción no puede exceder 2000 caracteres'
    });

const activo = Joi.boolean()
    .optional()
    .messages({
        'boolean.base': 'El estado activo debe ser true o false'
    });

const new_title = Joi.string()
    .trim()
    .min(3)
    .max(100)
    .optional()
    .messages({
        'string.base': 'El nuevo título debe ser un string',
        'string.min': 'El nuevo título debe tener al menos 3 caracteres',
        'string.max': 'El nuevo título no puede exceder 100 caracteres'
    });

const new_price_cop = Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .messages({
        'number.base': 'El nuevo precio en COP debe ser un número',
        'number.min': 'El nuevo precio no puede ser negativo'
    });

const new_description_items = Joi.array()
    .items(Joi.string().trim().min(1).max(200))
    .min(1)
    .optional()
    .messages({
        'array.base': 'Los nuevos items de descripción deben ser un array',
        'array.min': 'Debe haber al menos 1 item de descripción'
    });

const new_description = Joi.string()
    .trim()
    .max(2000)
    .optional()
    .messages({
        'string.base': 'La nueva descripción debe ser un string',
        'string.max': 'La nueva descripción no puede exceder 2000 caracteres'
    });

const new_activo = Joi.boolean()
    .optional()
    .messages({
        'boolean.base': 'El nuevo estado activo debe ser true o false'
    });

export const createPlanDto = Joi.object({
    title,
    price_cop,
    description_items,
    description,
    activo
}).unknown(false);

export const getPlanDto = Joi.object({
    id: idParam
}).unknown(false);

export const updatePlanDto = Joi.object({
    new_title,
    new_price_cop,
    new_description_items,
    new_description,
    new_activo
})
    .or('new_title', 'new_price_cop', 'new_description_items', 'new_description', 'new_activo')
    .messages({
        'object.missing': 'Debe proporcionar al menos un campo para actualizar'
    })
    .unknown(false);

export const deletePlanDto = Joi.object({}).unknown(false);