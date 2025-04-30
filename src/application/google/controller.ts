import { NextFunction, Request, Response } from "express";

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
      // 'req.logout' ahora acepta un callback
      if (err) {
        console.log("Error al cerrar sesión:", err);
        return next(err);
      }
      // Opciones de respuesta después del logout
      // res.redirect('/'); // Redirigir a la página de inicio
      res.send("Session cerrada con exito");
      // res.status(200).json({ message: "Sesión cerrada exitosamente" });
    });
  } catch (error) {
    console.log("Error : ", error);
    next(error);
  }
};
