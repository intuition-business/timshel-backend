import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";

import { SECRET } from "../config";
import OtpService from "../application/otp/services";

interface AuthenticatedRequest extends Request {
  userId?: string;
}

interface TokenInterface {
  userId: any;
  phone?: string;
  email?: string;
}

export const verifyToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const services = new OtpService();
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
    req.userId = (<TokenInterface>(<unknown>decode)).userId;
    const verifyUser = await services.findById(req.userId || "");
    console.log("VERIFY", verifyUser);
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
