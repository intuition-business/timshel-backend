import { NextFunction, Request, Response } from "express";
import { SECRET } from "../../config";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import UserService from "../../services/UserService";

export const authWithGoogle = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.send(req.user);
  } catch (error) {
    console.log("Error : ", error);
    next(error);
  }
};

export const logoutWithGoogle = (
  req: Request<any>,
  res: Response,
  next: NextFunction
) => {
  try {
    req.logout((err) => {
      if (err) {
        console.log("Error al cerrar sesión:", err);
        return next(err);
      }
      res.send("Session cerrada con exito");
    });
  } catch (error) {
    console.log("Error : ", error);
    next(error);
  }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const authWithGoogleMobile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const date = new Date();
    const response = {
      message: "",
      error: false,
      date,
      status: 200,
      token: "",
    };

    const { idToken } = req.body;
    if (!idToken) {
      response.message = "idToken requerido";
      response.error = true;
      response.status = 400;
      return res.status(400).json(response);
    }

    const ticket = await client.verifyIdToken({
      idToken,
      //audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      response.message = "Email no obtenido";
      response.error = true;
      response.status = 401;
      return res.status(401).json(response);
    }

    const services = new UserService();
    let userData: any[] = await services.findByEmail(payload.email);

    let auth_id: string;
    let rol: string = "user";

    if (userData.length === 0) {
      const newUser = await services.createGoogleUser({
        email: payload.email,
        name: payload.name || "",
      });
      userData = [{ id: newUser.id, rol: "user" }];
    }

    auth_id = userData[0].id.toString();
    rol = userData[0].rol || "user";

    const jwtPayload = {
      userId: auth_id,
      email: payload.email,
      role: rol,
    };

    const token = jwt.sign(jwtPayload, SECRET);

    response.message = "Autenticado con éxito vía Google.";
    response.token = token;

    res.json({
      ...response,
      user_id: auth_id,
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch (error) {
    console.error("Error Google mobile:", error);
    next(error);
  }
};