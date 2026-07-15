// src/api/users/getUsers.ts
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterUsers, UserResponse } from "./adapter";
import { getUsersListDto } from "./dto";

interface GetUsersResponse {
  message: string;
  error: boolean;
  data: UserResponse[];
  current_page: number;
  total_users: number;
  total_pages: number;
}

export const assignTrainer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, entrenadorId, planId, createPeriod = false } = req.body;

    if (!userId || !entrenadorId) {
      return res.status(400).json({ error: true, message: "userId y entrenadorId son requeridos" });
    }

    // Verificar que el usuario existe
    const [userRows]: any = await pool.execute("SELECT id FROM auth WHERE id = ?", [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: true, message: "Usuario no encontrado" });
    }

    // Verificar que el entrenador existe
    const [trainerRows]: any = await pool.execute("SELECT id FROM entrenadores WHERE id = ?", [entrenadorId]);
    if (!trainerRows.length) {
      return res.status(404).json({ error: true, message: "Entrenador no encontrado" });
    }

    const resolvedPlanId = planId ?? 0;

    // Cancelar asignaciones activas previas
    await pool.execute(
      "UPDATE asignaciones SET status = 'cancelled' WHERE usuario_id = ? AND status = 'active'",
      [userId]
    );

    // Crear nueva asignación
    await pool.execute(
      "INSERT INTO asignaciones (usuario_id, entrenador_id, plan_id, fecha_asignacion, status) VALUES (?, ?, ?, ?, 'active')",
      [userId, entrenadorId, resolvedPlanId, new Date()]
    );

    // Actualizar auth
    await pool.execute(
      "UPDATE auth SET entrenador_id = ?, plan_id = COALESCE(?, plan_id) WHERE id = ?",
      [entrenadorId, planId ?? null, userId]
    );

    let periodCreated = false;
    if (createPeriod) {
      // Limpiar períodos anteriores del usuario
      await pool.execute("DELETE FROM user_routine WHERE user_id = ?", [userId]);

      // Crear período de 30 días desde hoy con días lunes, miércoles y viernes
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 29);

      const startStr = today.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const trainingDays = [1, 3, 5]; // Lunes, Miércoles, Viernes

      const rows: any[] = [];
      const cursor = new Date(today);
      while (cursor <= endDate) {
        const dow = cursor.getDay();
        if (trainingDays.includes(dow)) {
          rows.push([userId, dayNames[dow], cursor.toISOString().split('T')[0], startStr, endStr, 'pending']);
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      for (const row of rows) {
        await pool.execute(
          "INSERT INTO user_routine (user_id, day, date, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)",
          row
        );
      }

      periodCreated = true;
    }

    return res.status(200).json({
      error: false,
      message: `Usuario ${userId} asignado al entrenador ${entrenadorId}${periodCreated ? ' y período creado' : ''}`,
      data: { userId, entrenadorId, planId: resolvedPlanId, periodCreated }
    });
  } catch (error) {
    console.error("Error en assignTrainer:", error);
    return res.status(500).json({ error: true, message: "Error interno del servidor" });
  }
};

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 20, name = "", with_trainer, with_image, plan_id } = req.query;
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
    total_pages: 0,
  };

  try {
    const { error: dtoError } = getUsersListDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // === WHERE CONDITIONS ===
    const whereConditions: string[] = ["auth.rol = 'user'"];
    const params: any[] = [];

    if (name) {
      whereConditions.push(`f.name LIKE ?`);
      params.push(`%${name}%`);
    }

    if (with_trainer === 'true') {
      whereConditions.push(`a.entrenador_id IS NOT NULL`);
    }

    if (with_image === 'true') {
      whereConditions.push(`ui.image_path IS NOT NULL`);
    }

    if (plan_id) {
      whereConditions.push(`a.plan_id = ?`);
      params.push(parseInt(plan_id as string, 10));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // === CONTAR TOTAL ===
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM auth
      LEFT JOIN formulario f ON auth.id = f.usuario_id
      LEFT JOIN asignaciones a ON auth.id = a.usuario_id
      LEFT JOIN user_images ui ON auth.id = ui.user_id
      ${whereClause}
    `;

    const [countRows] = await pool.query(countQuery, params);
    const totalUsers = (countRows as any)[0].total;
    const totalPages = Math.ceil(totalUsers / limitNum);

    // === CONSULTA PRINCIPAL ===
    const query = `
      SELECT 
        auth.id,
        COALESCE(f.name, 'Usuario sin nombre') AS name,
        auth.email,
        auth.telefono AS phone,
        e.id AS trainer_id,
        e.name AS trainer_name,
        e.image AS trainer_image,
        ui.image_path AS user_image,
        a.plan_id,
        p.title AS plan_name,
        f.peso,
        f.estatura,
        f.edad,
        f.objetivo
      FROM auth
      LEFT JOIN formulario f ON auth.id = f.usuario_id
      LEFT JOIN asignaciones a ON auth.id = a.usuario_id AND a.status = 'active'
      LEFT JOIN entrenadores e ON a.entrenador_id = e.id
      LEFT JOIN planes p ON a.plan_id = p.id
      LEFT JOIN user_images ui ON auth.id = ui.user_id
      ${whereClause}
      GROUP BY auth.id, f.name, auth.email, auth.telefono, e.id, e.name, e.image, ui.image_path, a.plan_id, p.title, f.peso, f.estatura, f.edad, f.objetivo
      ORDER BY auth.id DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, limitNum, offset];
    const [rows] = await pool.query(query, queryParams);

    const userRows = rows as any[];

    response.current_page = pageNum;
    response.total_users = totalUsers;
    response.total_pages = totalPages;

    if (userRows.length > 0) {
      response.data = adapterUsers(userRows);
      response.message = "Usuarios obtenidos exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontraron usuarios con los filtros aplicados";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query;
    const currentYear = new Date().getFullYear();
    const from = date_from ? String(date_from) : `${currentYear}-01-01`;
    const to = date_to ? String(date_to) : `${currentYear}-12-31`;

    // auth no tiene created_at — usamos asignaciones.fecha_asignacion como proxy de incorporación
    const [[stats]]: any = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM auth WHERE rol = 'user') AS total,
        (SELECT COUNT(DISTINCT usuario_id) FROM asignaciones
         WHERE fecha_asignacion >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS nuevos,
        (SELECT COUNT(*) FROM auth a
         WHERE a.rol = 'user' AND a.plan_valid_until IS NOT NULL AND a.plan_valid_until >= CURDATE()) AS activos,
        (SELECT COUNT(*) FROM auth a
         WHERE a.rol = 'user'
         AND NOT EXISTS (SELECT 1 FROM asignaciones WHERE usuario_id = a.id AND status = 'active')) AS inactivos
    `);

    const [movimiento]: any = await pool.query(`
      SELECT DATE_FORMAT(fecha_asignacion, '%Y-%m') AS month, COUNT(DISTINCT usuario_id) AS count
      FROM asignaciones
      WHERE DATE(fecha_asignacion) BETWEEN ? AND ?
      GROUP BY month ORDER BY month ASC
    `, [from, to]);

    const [top_entrenadores]: any = await pool.query(`
      SELECT e.id, e.name, e.image, COUNT(a.usuario_id) AS user_count
      FROM entrenadores e
      JOIN asignaciones a ON e.id = a.entrenador_id AND a.status = 'active'
      GROUP BY e.id, e.name, e.image
      ORDER BY user_count DESC
      LIMIT 10
    `);

    const [ingresos]: any = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(amount) AS total
      FROM payments
      WHERE status = 'approved' AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY month ORDER BY month ASC
    `, [from, to]);

    const [planes]: any = await pool.query(`
      SELECT COALESCE(p.title, 'Sin plan') AS plan_name, COUNT(a.id) AS count
      FROM asignaciones a
      LEFT JOIN planes p ON a.plan_id = p.id
      WHERE a.status = 'active'
      GROUP BY a.plan_id, p.title
      ORDER BY count DESC
    `);

    return res.status(200).json({
      error: false,
      stats: {
        total: Number(stats.total),
        nuevos: Number(stats.nuevos),
        activos: Number(stats.activos),
        inactivos: Number(stats.inactivos),
        suspendidos: 0,
      },
      movimiento,
      top_entrenadores,
      ingresos,
      planes,
    });
  } catch (error) {
    console.error("Error en getDashboardStats:", error);
    return res.status(500).json({ error: true, message: "Error interno del servidor" });
  }
};

export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 20, plan_id, entrenador_id, date_from, date_to, status } = req.query;

  try {
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (plan_id) {
      whereConditions.push("pay.plan_id = ?");
      params.push(parseInt(plan_id as string, 10));
    }

    if (entrenador_id) {
      whereConditions.push("pay.entrenador_id = ?");
      params.push(parseInt(entrenador_id as string, 10));
    }

    if (status) {
      whereConditions.push("pay.status = ?");
      params.push(status);
    }

    if (date_from) {
      whereConditions.push("DATE(pay.created_at) >= ?");
      params.push(date_from);
    }

    if (date_to) {
      whereConditions.push("DATE(pay.created_at) <= ?");
      params.push(date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM payments pay
      LEFT JOIN planes p ON pay.plan_id = p.id
      LEFT JOIN entrenadores e ON pay.entrenador_id = e.id
      ${whereClause}
    `;
    const [countRows] = await pool.query(countQuery, params);
    const total = (countRows as any)[0].total;
    const totalPages = Math.ceil(total / limitNum);

    const query = `
      SELECT
        pay.id,
        pay.mercadopago_id,
        pay.user_id,
        COALESCE(f.name, a.email, 'Sin nombre') AS user_name,
        a.email AS user_email,
        pay.plan_id,
        p.title AS plan_name,
        pay.entrenador_id,
        e.name AS trainer_name,
        pay.amount,
        pay.net_amount,
        pay.fee_amount,
        pay.status,
        pay.payment_method_id,
        pay.payment_type_id,
        pay.currency_id,
        pay.payer_email,
        pay.period_start,
        pay.period_end,
        pay.approved_at,
        pay.created_at
      FROM payments pay
      LEFT JOIN auth a ON pay.user_id = a.id
      LEFT JOIN formulario f ON f.usuario_id = a.id
      LEFT JOIN planes p ON pay.plan_id = p.id
      LEFT JOIN entrenadores e ON pay.entrenador_id = e.id
      ${whereClause}
      ORDER BY pay.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [...params, limitNum, offset]);

    return res.status(200).json({
      error: false,
      message: "Pagos obtenidos exitosamente",
      data: rows,
      current_page: pageNum,
      total_payments: total,
      total_pages: totalPages,
    });
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    return res.status(500).json({ error: true, message: "Error interno del servidor" });
  }
};