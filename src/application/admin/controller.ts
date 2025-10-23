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

interface GetUsersResponse {
  message: string;
  error: boolean;
  data: User[];
  current_page: number;
  total_users: number;
  total_pages: number;
}
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 20, with_trainer } = req.query; // page y limit para paginación, default 1 y 20

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
    const { error: dtoError } = getUsersListDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10))); // Limita el límite entre 1 y 100
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM auth
      WHERE rol = 'user'
    `;
    const [countRows] = await pool.query(countQuery);
    const totalUsers = (countRows as any)[0].total;
    const totalPages = Math.ceil(totalUsers / limitNum);

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
      WHERE auth.rol = 'user'
      ORDER BY auth.id ASC
      LIMIT ? OFFSET ?
    `;
    const params: any[] = [limitNum, offset];

    const [rows] = await pool.execute(query, params);

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

    if (userRows.length > 0) {
      response.data = adapterUsers(userRows);
      response.message = "Usuarios obtenidos exitosamente";
      if (pageNum === 1 && userRows.length <= 20) {
        response.message += " (Estás en la primera página)";
      }
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
