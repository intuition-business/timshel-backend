// src/application/chat-history/dto.ts
import Joi from "joi";

export const getConversationsDto = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  page: Joi.number().integer().min(1).default(1),
});

export const getMessagesDto = Joi.object({
  receiverId: Joi.number().integer().positive().required(),
  limit: Joi.number().integer().min(1).max(100).default(30),
  page: Joi.number().integer().min(1).default(1),
});