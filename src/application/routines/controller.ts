import { NextFunction, Request, Response } from "express";
const fs = require("fs").promises;
import path from "path";
import { readFiles } from "./useCase/readFiles";
import { getOpenAI } from "../../infrastructure/openIA";
import { adapter } from "./useCase/adapter";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import pool from "../../config/db";

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
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    const [rows]: any = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [userId]
    );
    const personData = adapter(rows?.[0]);
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
        response: "Documento generado.",
        error: false,
        message: "Documento generado.",
        path_file: pathFilePrompt,
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

export const getRoutinesSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    const [rows]: any = await pool.execute(
      "SELECT * FROM complete_rutina WHERE user_id = ?",
      [userId]
    );

    if (rows.length > 0) {
      const responseData = rows.map((item: any) => {
        return {
          fecha_rutina: item?.fecha_rutina,
          id: item?.id,
          rutina: JSON.parse(item?.rutina),
        };
      });

      res.status(200).json({
        error: false,
        message: "Rutinas guardadas",
        response: responseData,
      });
      return;
    }
    res.status(404).json({
      error: true,
      response: undefined,
      message: "No se encontro rutinas guardadas",
    });
  } catch (error) {
    next(error);
  }
};

export const routinesSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { headers, body } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;
    const { fecha_rutina, rutina } = body;
    const parsedRutina = JSON.stringify(rutina).trim();
    const [result] = await pool.execute(
      "INSERT INTO complete_rutina (fecha_rutina,rutina, user_id) VALUES (?, ?, ?)",
      [fecha_rutina, parsedRutina, userId]
    );

    if (result) {
      res.status(200).json({
        error: false,
        message: "Rutinas guardadas",
        response: result,
      });
    }
    res.status(404).json({
      error: true,
      response: undefined,
      message: "No se encontro rutinas guardadas",
    });
  } catch (error) {
    next(error);
  }
};
