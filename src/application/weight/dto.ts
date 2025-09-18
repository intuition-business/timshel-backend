import Joi from "joi";

// Definición de validaciones para el `user_id`
const user_id = Joi.number().required();

// Para el peso, debe ser un número positivo
const weight = Joi.number().positive().required();

// Custom validator for date in "DD/MM/YYYY" format
const validateDate = (value: string, helpers: Joi.CustomHelpers) => {
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(value)) {
        return helpers.error('any.invalid');
    }
    const [day, month, year] = value.split('/').map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime()) || dateObj.getMonth() + 1 !== month || dateObj.getDate() !== day) {
        return helpers.error('any.invalid');
    }
    return value; // Return the original string if valid
};

const date = Joi.string().custom(validateDate, 'custom date validation').required();

export const createWeightDto = Joi.object({
    weight,
    date,
});

export const getWeightsDto = Joi.object({
    // El `user_id` se obtiene del token JWT, pero puede ser útil para validación adicional si se pasa por la URL
    user_id: Joi.number().required(),
});

export const updateWeightDto = Joi.object({
    date,
    weight,
});

export const deleteWeightDto = Joi.object({
    date,
});