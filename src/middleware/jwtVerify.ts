import { NextFunction, Request, Response } from "express";
import { IUser } from "../application/register/types";
import { verify } from "jsonwebtoken";

import { SECRET } from "../config";
import { RegisterModel } from "../application/register/model";

interface AuthenticatedRequest extends Request {
  userId?: string;
}

interface TokenInterface {
  userFound: IUser;
}

export const verifyToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const date = new Date();
  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    if (!token) {
      return res
        .status(403)
        .json({ message: "token esta vacio", error: true, date });
    }
    const decode = token && verify(`${token}`, SECRET);
    req.userId = (<TokenInterface>(<unknown>decode)).userFound._id;
    const verifyUser = await RegisterModel.findById(req.userId, {
      password: 0,
    });

    if (!verifyUser) {
      return res
        .status(404)
        .json({ message: "token invalido", error: true, date });
    }
    next();
  } catch (error) {
    return res.status(404).json({
      message: "Sin permisos",
      error: true,
      date,
      messageError: error,
    });
  }
};
