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
    main_goal,
    favorite_muscular_group,
    train_experience,
    training_place,
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
    phone,
    email,
  } = req.body;

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  let normalized_train_experience = train_experience;
  if (normalized_train_experience == null) normalized_train_experience = null;

  if (typeof normalized_train_experience === 'string') {
    try {
      const parsed = JSON.parse(normalized_train_experience);
      if (typeof parsed === 'string') {
        normalized_train_experience = parsed;
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        normalized_train_experience = parsed[0]; // Tomamos el primero si es array
      }
    } catch (e) {
      // No es JSON válido, usamos el string original
    }
  }

  if (typeof normalized_train_experience !== 'string') normalized_train_experience = null;
  else {
    const normalized = normalized_train_experience.toLowerCase().trim();
    const enumValues = ['basic', 'beginner', 'intermediate', 'advanced', 'expert'];
    normalized_train_experience = enumValues.includes(normalized) ? normalized : null;
  }

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
    const newAge =
      birthday && existingForm.length === 0
        ? calcularEdad(birthday)
        : existingForm?.[0]?.edad;
    if (existingForm.length > 0) {
      const formulario_id = (existingForm as any)[0].id;
      const updateResult: any = await UpdateForm({
        user_id: user_id || userId,
        height,
        age: newAge,
        weight,
        gender,
        activity_factor,
        main_goal,
        favorite_muscular_group,
        train_experience: normalized_train_experience,
        training_place,
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
        phone,
        email,
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
        main_goal,
        favorite_muscular_group,
        train_experience: normalized_train_experience,
        training_place,
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
        phone,
        email,
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
    res.status(400).json(response);
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
    response.message = `Formularios para el usuario con ID ${user_id || userId
      } obtenidos exitosamente`;
    res.status(200).json(response);
  } catch (error) {
    console.error(
      `Error al obtener los formularios del usuario con ID ${user_id || userId
      }:`,
      error
    );
    next(error);
    res.status(500).json({
      message: `Error al obtener los formularios del usuario con ID ${user_id || userId
        }`,
    });
  }
};