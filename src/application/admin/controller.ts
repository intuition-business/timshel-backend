// controller.ts for users (nuevo controlador para admin - get all users with trainer info)
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterUsers } from "./adapter"; // Importa el adaptador para users
import { getUsersListDto } from "./dto"; // Importa el DTO para list

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  fecha_registro: Date;
  trainer_id: number | null;
  trainer_name: string | null;
}

// Obtener lista de usuarios (para admin, con trainer info)
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  const { length, random, with_trainer } = req.query; // length como número, random como booleano, with_trainer para incluir trainer

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const adminId = (<any>(<unknown>decode)).userId; // Asume admin autenticado

  const response = { message: "", error: false, data: [] as User[] };

  try {
    // Validación con DTO para query params
    const { error: dtoError } = getUsersListDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    let query = `
      SELECT 
        u.id,
        u.nombre AS name,
        auth.email,
        auth.telefono AS phone,
        u.fecha_registro,
        e.id AS trainer_id,
        e.name AS trainer_name
      FROM usuarios u
      LEFT JOIN auth ON u.id = auth.usuario_id
      LEFT JOIN asignaciones a ON u.id = a.usuario_id
      LEFT JOIN entrenadores e ON a.entrenador_id = e.id
    `;
    const params: any[] = [];

    // Si no hay params, trae todo ordenado por name ASC
    if (!length && !random) {
      query += " ORDER BY u.nombre ASC";
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
        query += " ORDER BY u.nombre ASC";
        if (limit) {
          query += " LIMIT ?";
          params.push(String(limit));  // Convertir a string para evitar errores
        }
      }
    }

    // Ejecuta la query
    const [rows] = params.length > 0
      ? await pool.execute(query, params)
      : await pool.query(query);

    const userRows = rows as Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      fecha_registro: Date;
      trainer_id: number | null;
      trainer_name: string | null;
    }>;

    if (userRows.length > 0) {
      response.data = adapterUsers(userRows);
      response.message = "Usuarios obtenidos exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontraron usuarios";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener los usuarios:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los usuarios." });
  }
};