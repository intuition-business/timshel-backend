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

interface GetUsersResponse {
  message: string;
  error: boolean;
  data: User[];
  current_page: number;
  total_users: number;
  total_pages: number;
}

// Obtener lista de usuarios (para admin, con trainer info)
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 20 } = req.query; // page y limit para paginación, default 1 y 20
  const { headers } = req;
  const token = headers["x-access-token"];

  let decode;
  try {
    decode = verify(`${token}`, SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
  }
  const adminId = (decode as any).userId; // Asume admin autenticado

  const response: GetUsersResponse = { message: "", error: false, data: [], current_page: 0, total_users: 0, total_pages: 0 };

  try {
    // Validación con DTO para query params
    const { error: dtoError } = getUsersListDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    // Paginación: Asegura que `page` y `limit` son valores válidos
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10))); // Limita el límite entre 1 y 100
    const offset = (pageNum - 1) * limitNum;

    // Verifica los valores de limitNum y offset
    console.log("limitNum:", limitNum, "offset:", offset);  // Verificación de parámetros

    // Consulta para contar el total de usuarios
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM auth
      WHERE rol = 'user' -- Asumiendo que solo users normales, ajusta si incluye otros
    `;
    const [countRows] = await pool.query(countQuery);
    const totalUsers = (countRows as any)[0].total;
    const totalPages = Math.ceil(totalUsers / limitNum);

    // Consulta principal para usuarios, ordenados por auth.id ASC
    let query = `
      SELECT 
        u.id,
        u.nombre AS name,
        auth.email,
        auth.telefono AS phone,
        u.fecha_registro,
        e.id AS trainer_id,
        e.name AS trainer_name
      FROM auth
      LEFT JOIN usuarios u ON auth.usuario_id = u.id
      LEFT JOIN asignaciones a ON auth.usuario_id = a.usuario_id
      LEFT JOIN entrenadores e ON a.entrenador_id = e.id
      WHERE auth.rol = 'user' -- Filtrar solo users
      ORDER BY auth.id ASC -- Ordenado del primero al último según auth
      LIMIT ${limitNum} OFFSET ${offset} -- Concatenamos los valores de LIMIT y OFFSET
    `;

    // Ejecuta la consulta sin parámetros (LIMIT y OFFSET se concatenan directamente)
    const [rows] = await pool.query(query);

    const userRows = rows as Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      fecha_registro: Date;
      trainer_id: number | null;
      trainer_name: string | null;
    }>;

    response.current_page = pageNum;
    response.total_users = totalUsers;
    response.total_pages = totalPages;

    // Enviar respuesta si hay datos
    if (userRows.length > 0) {
      response.data = adapterUsers(userRows);
      response.message = "Usuarios obtenidos exitosamente";
      if (pageNum === 1 && userRows.length <= 20) {
        response.message += " (Estás en la primera página)";
      }
      return res.status(200).json(response); // Asegúrate de que se envíe solo una vez
    } else {
      // Si no hay datos
      response.error = true;
      response.message = "No se encontraron usuarios";
      return res.status(404).json(response); // Asegúrate de que se envíe solo una vez
    }
  } catch (error) {
    // Manejo de errores
    console.error("Error al obtener los usuarios:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los usuarios." }); // Asegúrate de que no se envíe otra respuesta
  }
};
