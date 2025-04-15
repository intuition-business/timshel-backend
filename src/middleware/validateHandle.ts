import boom from "@hapi/boom";
import { NextFunction, Request, Response } from "express";
import Joi from "joi";

export const validateHandler = (
  dto: Joi.ObjectSchema<any>,
  property: string
): ((req: any, res: Response, next: NextFunction) => void) => {
  return (req: any, res: Response, next: NextFunction) => {
    const data = req[property];
    const { error } = dto.validate(data, { abortEarly: false });
    if (error) next(boom.badRequest(error));
    next();
  };
};
