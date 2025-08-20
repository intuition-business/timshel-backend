import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterExercises } from "./adapter";
import { createExerciseDto, getExerciseDto, updateExerciseDto, deleteExerciseDto } from "./dto"; // Importamos los DTOs

interface Exercise {
  id: number;
  category: string;
  exercise: string;
  description: string;
}

// Ajustamos el código de creación del ejercicio
export const createExercise = async (req: Request, res: Response, next: NextFunction) => {
  const { category, exercise, description } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth, aunque para ejercicios globales podría no ser necesario

    // Validación con DTO (asumiendo que existe)
    const { error: dtoError } = createExerciseDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!category || !exercise || !description) {
      response.error = true;
      response.message = "Faltan campos requeridos: category, exercise, description.";
      return res.status(400).json(response);
    }

    // Verificar si ya existe el ejercicio
    const [existingExercise] = await pool.execute(
      "SELECT id FROM exercises WHERE category = ? AND exercise = ?",
      [category.toUpperCase(), exercise]
    );

    if ((existingExercise as any).length > 0) {
      response.error = true;
      response.message = `Ya existe un ejercicio con el nombre "${exercise}" en la categoría "${category}".`;
      return res.status(400).json(response);
    }

    const query = "INSERT INTO exercises (category, exercise, description) VALUES (?, ?, ?)";
    const [result]: any = await pool.query(query, [category.toUpperCase(), exercise, description]);

    if (result) {
      response.message = "Ejercicio creado exitosamente";
      return res.status(201).json({
        exercise: { category: category.toUpperCase(), exercise, description },
      });
    } else {
      response.error = true;
      response.message = "No se pudo guardar el ejercicio";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al crear el ejercicio:", error);
    next(error);
    return res.status(500).json({ message: "Error al crear el ejercicio." });
  }
};

export const getAllExercises = async (req: Request, res: Response, next: NextFunction) => {
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth

  const response = { message: "", error: false, data: [] as Exercise[] };

  try {
    // Validación con DTO si aplica (por ejemplo, para query params si hay filtros)
    const { error: dtoError } = getExerciseDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const [rows] = await pool.execute(
      "SELECT id, category, exercise, description FROM exercises ORDER BY category ASC, exercise ASC"
    );

    const exerciseRows = rows as Array<{
      id: number;
      category: string;
      exercise: string;
      description: string;
    }>;

    if (exerciseRows.length > 0) {
      response.data = adapterExercises(exerciseRows);
      response.message = "Ejercicios obtenidos exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontraron ejercicios";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener los ejercicios:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los ejercicios." });
  }
};

export const getExercisesByCategory = async (req: Request, res: Response, next: NextFunction) => {
  const { category } = req.query; // Asumimos que la categoría viene como query param, ej. ?category=PECHO

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth

  const response = { message: "", error: false, data: [] as Exercise[] };

  try {
    if (!category) {
      response.error = true;
      response.message = "Falta el parámetro requerido: category.";
      return res.status(400).json(response);
    }

    // Validación con DTO si aplica
    const { error: dtoError } = getExerciseDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const [rows] = await pool.execute(
      "SELECT id, category, exercise, description FROM exercises WHERE category = ? ORDER BY exercise ASC",
      [category.toString().toUpperCase()]
    );

    const exerciseRows = rows as Array<{
      id: number;
      category: string;
      exercise: string;
      description: string;
    }>;

    if (exerciseRows.length > 0) {
      response.data = adapterExercises(exerciseRows);
      response.message = `Ejercicios de la categoría ${category} obtenidos exitosamente`;
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = `No se encontraron ejercicios en la categoría ${category}`;
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener los ejercicios por categoría:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los ejercicios por categoría." });
  }
};

// Actualizar un ejercicio
export const updateExercise = async (req: Request, res: Response, next: NextFunction) => {
  const { category, exercise, new_description, new_category, new_exercise } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth

    // Validación con DTO
    const { error: dtoError } = updateExerciseDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!category || !exercise) {
      response.error = true;
      response.message = "Faltan campos requeridos: category y exercise para identificar el ejercicio a actualizar.";
      return res.status(400).json(response);
    }

    // Construir la consulta de actualización dinámicamente
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (new_description) {
      updateFields.push("description = ?");
      updateValues.push(new_description);
    }
    if (new_category) {
      updateFields.push("category = ?");
      updateValues.push(new_category.toUpperCase());
    }
    if (new_exercise) {
      updateFields.push("exercise = ?");
      updateValues.push(new_exercise);
    }

    if (updateFields.length === 0) {
      response.error = true;
      response.message = "No se proporcionaron campos para actualizar.";
      return res.status(400).json(response);
    }

    const query = `UPDATE exercises SET ${updateFields.join(", ")} WHERE category = ? AND exercise = ?`;
    updateValues.push(category.toUpperCase(), exercise);

    const [result]: any = await pool.query(query, updateValues);

    if (result.affectedRows > 0) {
      response.message = "Ejercicio actualizado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontró el ejercicio para actualizar";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al actualizar el ejercicio:", error);
    next(error);
    return res.status(500).json({ message: "Error al actualizar el ejercicio." });
  }
};

// Eliminar un ejercicio
export const deleteExercise = async (req: Request, res: Response, next: NextFunction) => {
  const { error: dtoError } = deleteExerciseDto.validate(req.body);
  if (dtoError) {
    return res.status(400).json({ error: true, message: dtoError.details[0].message });
  }

  const { category, exercise } = req.body;

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth

  const response = { message: "", error: false };

  try {
    const [result] = await pool.execute(
      "DELETE FROM exercises WHERE category = ? AND exercise = ?",
      [category.toUpperCase(), exercise]
    );

    const deleteResult = result as import('mysql2').ResultSetHeader;

    if (deleteResult && deleteResult.affectedRows > 0) {
      response.message = "Ejercicio eliminado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo eliminar el ejercicio";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al eliminar el ejercicio:", error);
    next(error);
    return res.status(500).json({ message: "Error al eliminar el ejercicio." });
  }
};