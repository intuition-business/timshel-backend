import { NextFunction, Request, Response } from "express";
import RegisterService from "./services";
import { encryptPassword } from "../useCase/pass-hash";
import { adapter } from "./adapter";
import { sign } from "jsonwebtoken";
import { SECRET } from "../../config";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const services = new RegisterService();
    let result = null;
    const { password, password_confirmation } = req.body;
    const newPassword = await encryptPassword(password);
    const newConfirmationPassword = await encryptPassword(
      password_confirmation
    );
    const data = adapter({
      ...req.body,
      password: newPassword,
      password_confirmation: newConfirmationPassword,
    });
    const date = new Date();
    const response = { message: "", error: false, token: "", date };

    const existingEmailUser = await services.findByEmail(data.email);
    const existingPhoneUser = await services.findByPhonenumber(data.phone);

    if (existingEmailUser) {
      response.message = `El email ${data.email} ya esta registrado.`;
      response.error = true;
      res.status(400).json(response);
    }

    if (existingPhoneUser) {
      response.message = `El numero ${data.phone} ya esta registrado.`;
      response.error = true;
      res.status(400).json(response);
    }

    if (!existingPhoneUser && !existingEmailUser) {
      result = await services.create(data);
    }

    const userFound = {
      id: result?._id,
      email: result?.email,
      phone: result?.phone,
      name: result?.name,
    };
    const token = sign({ userFound }, SECRET, {
      expiresIn: 86400,
    });

    if (!result) {
      response.message = "algo salio mal, porfavor intenta mas tarde";
      response.error = true;
      res.status(400).json(response);
    }

    response.message = "registro exitoso";
    response.token = token;
    res.status(200).json(response);
  } catch (error) {
    console.log("Error: ", error);
    next(error);
  }
};
