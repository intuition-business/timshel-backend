import { NextFunction, Request, Response } from "express";
const fs = require("fs").promises;
import path from "path";

export const getRoutines = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const filePath = path.join(__dirname, "training_plan.json");
  try {
    const data = await fs.readFile(filePath, "utf8");
    res.json(JSON.parse(data)); // Express automáticamente establece el Content-Type a application/json y envía el JSON
  } catch (error) {
    console.error("Error al leer el archivo JSON:", error);
    //res.status(500).send("Error interno del servidor al leer el archivo JSON.");
    next(error);
  }
};
