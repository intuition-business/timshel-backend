import { NextFunction, Request, Response } from "express";
import pool from "../../config/db";
import { adapterForms } from "./adapter";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import calcularEdad from "./useCase/calcularEdad";
import { InsertForm } from "./useCase/insertForm";
import { UpdateForm } from "./useCase/updateForm";

export const createforms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const date = new Date();
  const response = { message: "", error: false, date, formulario_id: 0 };

  const {
    user_id,
    height,
    //age,
    weight,
    gender,
    activity_factor,
    goal,
    hours_per_day,
    injury,
    pathology,
    foods_not_consumed,
    illness,
    allergy,
    usually_dinner,
    usually_lunch,
    usually_breakfast,
    weekly_availability,
    birthday,
    name,
  } = req.body;

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;
  const newAge = birthday ? calcularEdad(birthday) : null;
  try {
    if (!pool) {
      response.error = true;
      response.message = "Error: Conexión a la base de datos no establecida.";
      res.status(500).json(response);
    }

    const [existingForm]: any = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [user_id || userId]
    );

    if (existingForm.length > 0) {
      const formulario_id = (existingForm as any)[0].id;
      const updateResult: any = await UpdateForm({
        user_id: user_id || userId,
        height,
        age: newAge,
        weight,
        gender,
        activity_factor,
        goal,
        hours_per_day,
        injury,
        pathology,
        foods_not_consumed,
        illness,
        allergy,
        usually_dinner,
        usually_lunch,
        usually_breakfast,
        weekly_availability,
        birthday,
        name,
      });

      if (updateResult.affectedRows > 0) {
        response.message = "Formulario actualizado exitosamente";
        response.formulario_id = formulario_id;
        res.status(200).json(response);
        return;
      } else {
        response.message = "No se pudo actualizar el formulario";
        response.error = true;
        res.status(400).json(response);
        return;
      }
    } else {
      const result: any = await InsertForm({
        user_id: user_id || userId,
        height,
        age: newAge,
        weight,
        gender,
        activity_factor,
        goal,
        hours_per_day,
        injury,
        pathology,
        foods_not_consumed,
        illness,
        allergy,
        usually_dinner,
        usually_lunch,
        usually_breakfast,
        weekly_availability,
        birthday,
        name,
      });

      if (result.insertId) {
        response.message = "Formulario creado exitosamente";
        response.formulario_id = (result as any).insertId;
        res.status(201).json(response);
        return;
      }
    }

    response.message = "Error al guardar el formulario en la base de datos";
    response.error = true;
    res.status(4000).json(response);
    return;
  } catch (error) {
    console.error("Error al insertar el formulario:", error);
    next(error);
    res
      .status(500)
      .json({ message: "Error al guardar el formulario en la base de datos" });
  }
};

export const getFormsByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user_id } = req.params;
  const response: any = { message: "", error: false, data: [] };
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;
  try {
    if (!pool) {
      response.error = true;
      response.message = "Error: Conexión a la base de datos no establecida.";
      res.status(500).json(response);
    }

    const [rows] = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [user_id || userId]
    );
    response.data = adapterForms(rows);
    response.message = `Formularios para el usuario con ID ${
      user_id || userId
    } obtenidos exitosamente`;
    res.status(200).json(response);
  } catch (error) {
    console.error(
      `Error al obtener los formularios del usuario con ID ${
        user_id || userId
      }:`,
      error
    );
    next(error);
    res.status(500).json({
      message: `Error al obtener los formularios del usuario con ID ${
        user_id || userId
      }`,
    });
  }
};
