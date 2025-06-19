import { NextFunction, Request, Response } from "express";
const fs = require("fs").promises;
import path from "path";
import { readFiles } from "./useCase/readFiles";
import { getOpenAI } from "../../infrastructure/openIA";
import { adapter } from "./useCase/adapter";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";

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

export const getGeneratedRoutinesIa = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;
  const filePath = path.join(
    __dirname,
    `data/${userId}/plan_entrenamiento.json`
  );
  try {
    const data = await fs.readFile(filePath, "utf8");
    res.json(JSON.parse(data)); // Express automáticamente establece el Content-Type a application/json y envía el JSON
  } catch (error) {
    console.error("Error al leer el archivo JSON:", error);
    //res.status(500).send("Error interno del servidor al leer el archivo JSON.");
    next(error);
  }
};

export const generateRoutinesIa = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { body, headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    const personData = adapter(body);
    const prompt = await readFiles(personData);
    const { response, error } = await getOpenAI(prompt);

    if (response) {
      const userDirPath = path.join(__dirname, `data/${userId}`);

      await fs.mkdir(userDirPath, { recursive: true });

      const pathFilePrompt = path.join(userDirPath, "plan_entrenamiento.json");
      const parsed = JSON.parse(response.choices[0].message.content || "");

      await fs.writeFile(
        pathFilePrompt,
        JSON.stringify(parsed, null, 2),
        "utf-8"
      );

      res.json({
        response: response.choices[0].message.content,
        error: false,
        message: "Ok",
      });
      return;
    }

    res.json({
      response: "",
      error: true,
      message:
        "Ocurrio un error al procesar los datos. Por favor intente hacerlo mas tarde.",
    });
  } catch (error) {
    next(error);
  }
};
