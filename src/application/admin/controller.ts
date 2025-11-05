import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterUsers } from "./adapter";
import { getUsersListDto } from "./dto";

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  fecha_registro: Date;
  trainer_id: number | null;
  trainer_name: string | null;
  trainer_image: string | null;
  user_image: string | null;
  plan_id: number | null;
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
  const { page = 1, limit = 20, name = "" } = req.query;
  const { headers } = req;
  const token = headers["x-access-token"];

  let decode;
  try {
    decode = verify(`${token}`, SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
  }

  const response: GetUsersResponse = {
    message: "",
    error: false,
    data: [],
    current_page: 0,
    total_users: 0,
    total_pages: 0
  };

  try {
    // Validación DTO
    const { error: dtoError } = getUsersListDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Filtro por nombre
    const nameFilter = name ? `%${name}%` : null;

    // === CONTAR TOTAL DE USUARIOS ===
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM auth
      LEFT JOIN usuarios u ON auth.usuario_id = u.id
      WHERE auth.rol = 'user'
    `;
    const countParams: any[] = [];
    if (nameFilter) {
      countQuery += ` AND u.nombre LIKE ?`;
      countParams.push(nameFilter);
    }

    const [countRows] = await pool.query(countQuery, countParams);
    const totalUsers = (countRows as any)[0].total;
    const totalPages = Math.ceil(totalUsers / limitNum);

    // === CONSULTA PRINCIPAL CON TODOS LOS DATOS ===
    let query = `
      SELECT 
        u.id,
        u.nombre AS name,
        auth.email,
        auth.telefono AS phone,
        u.fecha_registro,
        e.id AS trainer_id,
        e.name AS trainer_name,
        e.image AS trainer_image,
        ui.image_path AS user_image,
        a.plan_id
      FROM auth
      LEFT JOIN usuarios u ON auth.usuario_id = u.id
      LEFT JOIN asignaciones a ON auth.usuario_id = a.usuario_id
      LEFT JOIN entrenadores e ON a.entrenador_id = e.id
      LEFT JOIN user_images ui ON u.id = ui.user_id
      WHERE auth.rol = 'user'
    `;

    const params: any[] = [];
    if (nameFilter) {
      query += ` AND u.nombre LIKE ?`;
      params.push(nameFilter);
    }

    query += `
      ORDER BY auth.id ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limitNum, offset);

    const [rows] = await pool.query(query, params);

    const userRows = rows as Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      fecha_registro: Date;
      trainer_id: number | null;
      trainer_name: string | null;
      trainer_image: string | null;
      user_image: string | null;
      plan_id: number | null;
    }>;

    response.current_page = pageNum;
    response.total_users = totalUsers;
    response.total_pages = totalPages;

    if (userRows.length > 0) {
      // Usa el adaptador si está preparado para los nuevos campos
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