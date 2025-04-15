/* eslint-disable no-unused-vars */
import { ErrorRequestHandler } from "express";
export const logErrors: ErrorRequestHandler = (error, req, res, next): void => {
  console.error(error);
  next(error);
};

export const handleErrors: ErrorRequestHandler = (
  error,
  req,
  res,
  next
): void => {
  res.status(500).json({
    message: error.message,
    stack: error.stack,
  });
};

export const boomHandleErrors: ErrorRequestHandler = (
  error,
  req,
  res,
  next
): void => {
  if (error.isBoom) {
    const { payload, statusCode } = error.output;
    res.status(statusCode).json({
      ...payload,
    });
  } else {
    next(error);
  }
};

export const ormHandlerError: ErrorRequestHandler = (
  error,
  req,
  res,
  next
): void => {
  if (error.name === "MongooseError" || error.code === 11000) {
    res.status(409).json({
      statusCode: 409,
      name: error.name,
      message: error.message,
      stack: error.stack,
      error,
    });
  }
  next(error);
};
