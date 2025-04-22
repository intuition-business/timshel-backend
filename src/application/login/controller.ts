import { NextFunction, Request, Response } from "express";
import { sign } from "jsonwebtoken";
import { HashingMatch } from "../useCase/pass-hash";
import LoginService from "./services";
import { SECRET } from "../../config";

export const Login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const services = new LoginService();
    const { email, password } = req.body;
    const date = new Date();
    const response = { message: "", error: false, token: "", date };

    const user = await services.findByEmail(email);
    const isPasswordValid = await HashingMatch(password, user?.password || "");

    if (!user || !isPasswordValid) {
      response.message = "Credenciales Invalidas";
      response.error = true;
      res.status(401).json(response);
    }

    const userFound = {
      id: user?._id,
      email: user?.email,
      phone: user?.phone,
      name: user?.name,
    };
    const token = sign({ userFound }, SECRET, {
      expiresIn: 86400,
    });

    response.message = "";
    response.token = token;
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
