// controller.ts for warm-ups
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterWarmUps } from "./adapter";
import { createWarmUpDto, getWarmUpDto, updateWarmUpDto, deleteWarmUpDto } from "./dto"; // Importamos los DTOs

interface WarmUp {
  id: number;
  name: string;
  description: string;
  video_url: string;
  video_thumbnail: string;
  duration_in_minutes: number;
}

// Crear un ejercicio de calentamiento
export const createWarmUp = async (req: Request, res: Response, next: NextFunction) => {
  const { name, description, video_url, video_thumbnail, duration_in_minutes } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Validación con DTO
    const { error: dtoError } = createWarmUpDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!name || !description || !video_url || !video_thumbnail || duration_in_minutes === undefined) {
      response.error = true;
      response.message = "Faltan campos requeridos: name, description, video_url, video_thumbnail, duration_in_minutes.";
      return res.status(400).json(response);
    }

    // Verificar si ya existe el warm-up por name (asumimos unique)
    const [existingWarmUp] = await pool.execute(
      "SELECT id FROM warm_ups WHERE name = ?",
      [name]
    );

    if ((existingWarmUp as any).length > 0) {
      response.error = true;
      response.message = `Ya existe un ejercicio de calentamiento con el nombre "${name}".`;
      return res.status(400).json(response);
    }

    const query = "INSERT INTO warm_ups (name, description, video_url, video_thumbnail, duration_in_minutes) VALUES (?, ?, ?, ?, ?)";
    const [result]: any = await pool.query(query, [name, description, video_url, video_thumbnail, duration_in_minutes]);

    if (result) {
      response.message = "Ejercicio de calentamiento creado exitosamente";
      return res.status(201).json({
        warm_up: { name, description, video_url, video_thumbnail, duration_in_minutes },
      });
    } else {
      response.error = true;
      response.message = "No se pudo guardar el ejercicio de calentamiento";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al crear el ejercicio de calentamiento:", error);
    next(error);
    return res.status(500).json({ message: "Error al crear el ejercicio de calentamiento." });
  }
};

// Obtener ejercicios de calentamiento (con soporte para query params length y random)
export const getWarmUps = async (req: Request, res: Response, next: NextFunction) => {
  const { length, random } = req.query; // length como número, random como booleano (true/false)

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: [] as WarmUp[] };

  try {
    // Validación con DTO para query params
    const { error: dtoError } = getWarmUpDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    let query = "SELECT id, name, description, video_url, video_thumbnail, duration_in_minutes FROM warm_ups";
    const params: any[] = [];

    // Si no hay params, trae todo ordenado por name ASC
    if (!length && !random) {
      query += " ORDER BY name ASC";
    } else {
      // Si length no se envía, trae todo
      const limit = length ? parseInt(length as string, 10) : undefined;

      if (random === "true") {
        // Trae aleatoriamente (ORDER BY RAND())
        query += " ORDER BY RAND()";
        if (limit) {
          query += " LIMIT ?";
          params.push(String(limit));  // ¡Fix: Convertir a string para evitar el error!
        }
      } else {
        // Si random=false o no, ordenado
        query += " ORDER BY name ASC";
        if (limit) {
          query += " LIMIT ?";
          params.push(String(limit));  // ¡Fix: Convertir a string para evitar el error!
        }
      }
    }

    // Opcional: Si params está vacío, usa pool.query en lugar de execute para mayor compatibilidad
    const [rows] = params.length > 0
      ? await pool.execute(query, params)
      : await pool.query(query);

    const warmUpRows = rows as Array<{
      id: number;
      name: string;
      description: string;
      video_url: string;
      video_thumbnail: string;
      duration_in_minutes: number;
    }>;

    if (warmUpRows.length > 0) {
      response.data = adapterWarmUps(warmUpRows);
      response.message = "Ejercicios de calentamiento obtenidos exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontraron ejercicios de calentamiento";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener los ejercicios de calentamiento:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los ejercicios de calentamiento." });
  }
};

// Actualizar un ejercicio de calentamiento
export const updateWarmUp = async (req: Request, res: Response, next: NextFunction) => {
  const { name, new_name, new_description, new_video_url, new_video_thumbnail, new_duration_in_minutes } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Validación con DTO
    const { error: dtoError } = updateWarmUpDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!name) {
      response.error = true;
      response.message = "Falta el campo requerido: name para identificar el ejercicio de calentamiento a actualizar.";
      return res.status(400).json(response);
    }

    // Construir la consulta de actualización dinámicamente
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (new_name) {
      updateFields.push("name = ?");
      updateValues.push(new_name);
    }
    if (new_description) {
      updateFields.push("description = ?");
      updateValues.push(new_description);
    }
    if (new_video_url) {
      updateFields.push("video_url = ?");
      updateValues.push(new_video_url);
    }
    if (new_video_thumbnail) {
      updateFields.push("video_thumbnail = ?");
      updateValues.push(new_video_thumbnail);
    }
    if (new_duration_in_minutes !== undefined) {
      updateFields.push("duration_in_minutes = ?");
      updateValues.push(new_duration_in_minutes);
    }

    if (updateFields.length === 0) {
      response.error = true;
      response.message = "No se proporcionaron campos para actualizar.";
      return res.status(400).json(response);
    }

    const query = `UPDATE warm_ups SET ${updateFields.join(", ")} WHERE name = ?`;
    updateValues.push(name);

    const [result]: any = await pool.query(query, updateValues);

    if (result.affectedRows > 0) {
      response.message = "Ejercicio de calentamiento actualizado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontró el ejercicio de calentamiento para actualizar";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al actualizar el ejercicio de calentamiento:", error);
    next(error);
    return res.status(500).json({ message: "Error al actualizar el ejercicio de calentamiento." });
  }
};

// Eliminar un ejercicio de calentamiento
export const deleteWarmUp = async (req: Request, res: Response, next: NextFunction) => {
  const { name } = req.body;

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false };

  try {
    // Validación con DTO
    const { error: dtoError } = deleteWarmUpDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const [result] = await pool.execute(
      "DELETE FROM warm_ups WHERE name = ?",
      [name]
    );

    const deleteResult = result as import('mysql2').ResultSetHeader;

    if (deleteResult && deleteResult.affectedRows > 0) {
      response.message = "Ejercicio de calentamiento eliminado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo eliminar el ejercicio de calentamiento";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al eliminar el ejercicio de calentamiento:", error);
    next(error);
    return res.status(500).json({ message: "Error al eliminar el ejercicio de calentamiento." });
  }
};