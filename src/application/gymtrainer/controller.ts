// controller.ts for trainers
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterTrainers } from "./adapter";
import { createTrainerDto, getTrainerDto, updateTrainerDto, deleteTrainerDto, assignUserDto } from "./dto"; // Importamos los DTOs
import { OtpModel } from "../otp/model";


interface Trainer {
  id: number;
  name: string;
  email: string;
  phone: string;
  biography: string;
  experience_years: number;
  certifications: string;
  profile_photo: string;
}

// Crear un entrenador
export const createTrainer = async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, phone, biography, experience_years, certifications, profile_photo } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Validación con DTO
    const { error: dtoError } = createTrainerDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!name || !email || !phone) {
      response.error = true;
      response.message = "Faltan campos requeridos: name, email, phone.";
      return res.status(400).json(response);
    }

    // Verificar si ya existe el entrenador por email (asumimos unique)
    const [existingTrainer] = await pool.execute(
      "SELECT id FROM entrenadores WHERE email = ?",
      [email]
    );

    if ((existingTrainer as any).length > 0) {
      response.error = true;
      response.message = `Ya existe un entrenador con el email "${email}".`;
      return res.status(400).json(response);
    }

    const query = "INSERT INTO entrenadores (name, email, telefono, biografia, experiencia, certificaciones, foto_perfil) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const [result]: any = await pool.query(query, [name, email, phone, biography, experience_years, certifications, profile_photo]);

    if (result) {
      // Crear auth asociado con rol 'entrenador'
      const authData = {
        usuario_id: 0,
        entrenador_id: result.insertId,
        email: email,
        telefono: phone,
        id_apple: 0,
        tipo_login: email ? 'email' : 'phone',
        rol: 'entrenador'
      };
      await OtpModel.createAuth(authData);

      response.message = "Entrenador creado exitosamente";
      return res.status(201).json({
        trainer: { name, email, phone, biography, experience_years, certifications, profile_photo },
      });
    } else {
      response.error = true;
      response.message = "No se pudo guardar el entrenador";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al crear el entrenador:", error);
    next(error);
    return res.status(500).json({ message: "Error al crear el entrenador." });
  }
};

// Obtener entrenadores (con soporte para query params length y random)
export const getTrainers = async (req: Request, res: Response, next: NextFunction) => {
  const { length, random } = req.query; // length como número, random como booleano (true/false)

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: [] as Trainer[] };

  try {
    // Validación con DTO para query params (ajusta si necesitas uno específico para list)
    const { error: dtoError } = getTrainerDto.validate(req.query); // Reusa o crea uno para list si es necesario
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    let query = "SELECT id, name, email, telefono as phone, biografia as biography, experiencia as experience_years, certificaciones as certifications, foto_perfil as profile_photo FROM entrenadores";
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
          params.push(String(limit));  // Convertir a string para evitar errores
        }
      } else {
        // Si random=false o no, ordenado
        query += " ORDER BY name ASC";
        if (limit) {
          query += " LIMIT ?";
          params.push(String(limit));  // Convertir a string para evitar errores
        }
      }
    }

    // Opcional: Si params está vacío, usa pool.query en lugar de execute
    const [rows] = params.length > 0
      ? await pool.execute(query, params)
      : await pool.query(query);

    const trainerRows = rows as Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      biography: string;
      experience_years: number;
      certifications: string;
      profile_photo: string;
    }>;

    if (trainerRows.length > 0) {
      response.data = adapterTrainers(trainerRows);
      response.message = "Entrenadores obtenidos exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontraron entrenadores";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener los entrenadores:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los entrenadores." });
  }
};

// Actualizar un entrenador
export const updateTrainer = async (req: Request, res: Response, next: NextFunction) => {
  const { id, new_name, new_email, new_phone, new_biography, new_experience_years, new_certifications, new_profile_photo } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Validación con DTO
    const { error: dtoError } = updateTrainerDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!id) {
      response.error = true;
      response.message = "Falta el campo requerido: id para identificar el entrenador a actualizar.";
      return res.status(400).json(response);
    }

    // Construir la consulta de actualización dinámicamente
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (new_name) {
      updateFields.push("name = ?");
      updateValues.push(new_name);
    }
    if (new_email) {
      updateFields.push("email = ?");
      updateValues.push(new_email);
    }
    if (new_phone) {
      updateFields.push("telefono = ?");
      updateValues.push(new_phone);
    }
    if (new_biography) {
      updateFields.push("biografia = ?");
      updateValues.push(new_biography);
    }
    if (new_experience_years !== undefined) {
      updateFields.push("experiencia = ?");
      updateValues.push(new_experience_years);
    }
    if (new_certifications) {
      updateFields.push("certificaciones = ?");
      updateValues.push(new_certifications);
    }
    if (new_profile_photo) {
      updateFields.push("foto_perfil = ?");
      updateValues.push(new_profile_photo);
    }

    if (updateFields.length === 0) {
      response.error = true;
      response.message = "No se proporcionaron campos para actualizar.";
      return res.status(400).json(response);
    }

    const query = `UPDATE entrenadores SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);

    const [result]: any = await pool.query(query, updateValues);

    if (result.affectedRows > 0) {
      response.message = "Entrenador actualizado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontró el entrenador para actualizar";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al actualizar el entrenador:", error);
    next(error);
    return res.status(500).json({ message: "Error al actualizar el entrenador." });
  }
};

// Eliminar un entrenador
export const deleteTrainer = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.body;

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false };

  try {
    // Validación con DTO
    const { error: dtoError } = deleteTrainerDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const [result] = await pool.execute(
      "DELETE FROM entrenadores WHERE id = ?",
      [id]
    );

    const deleteResult = result as import('mysql2').ResultSetHeader;

    if (deleteResult && deleteResult.affectedRows > 0) {
      // Opcional: Eliminar auth asociado si es necesario
      await pool.execute("DELETE FROM auth WHERE entrenador_id = ?", [id]);

      response.message = "Entrenador eliminado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo eliminar el entrenador";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al eliminar el entrenador:", error);
    next(error);
    return res.status(500).json({ message: "Error al eliminar el entrenador." });
  }
};

// Asignar usuario a entrenador
export const assignUser = async (req: Request, res: Response, next: NextFunction) => {
  const { trainerId, userId } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const adminId = (<any>(<unknown>decode)).userId; // Asume admin

    // Validación con DTO
    const { error: dtoError } = assignUserDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const date = new Date();
    const [result] = await pool.execute(
      "INSERT INTO asignaciones (usuario_id, entrenador_id, fecha_asignacion) VALUES (?, ?, ?)",
      [userId, trainerId, date]
    );

    if ((result as any).affectedRows > 0) {
      response.message = "Usuario asignado exitosamente al entrenador";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo asignar el usuario";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al asignar usuario:", error);
    next(error);
    return res.status(500).json({ message: "Error al asignar usuario." });
  }
};