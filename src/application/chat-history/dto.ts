// src/application/chat/dto.ts
import Joi from "joi";

export const getConversationsDto = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  page: Joi.number().integer().min(1).default(1)
});

export const getMessagesDto = Joi.object({
  receiverId: Joi.number().integer().positive().required().messages({
    "number.base": "receiverId debe ser un número",
    "any.required": "receiverId es requerido"
  }),
  limit: Joi.number().integer().min(1).max(100).default(30),
  page: Joi.number().integer().min(1).default(1)
});