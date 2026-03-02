// controller.ts for trainers
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterTrainers } from "./adapter";
import { createTrainerDto, getTrainerDto, updateTrainerDto, deleteTrainerDto, assignUserDto, getTrainersListDto, assignUserWithPlanDto } from "./dto"; // Importamos los DTOs
import { OtpModel } from "../otp/model";
import { sendWithEmail } from "../otp/sendOtp/controller/sendWithEmail";
import { sendWithPhonenumber } from "../otp/sendOtp/controller/sendWithPhonenumber";
import OtpService from "../otp/services";
import { generateOTPEmail } from "../otp/sendOtp/controller/generateOTP";
import { ICreateAuth } from "../otp/sendOtp/types";
import { sendOTP } from "../otp/sendOtp/controller/sendOTP";
import { deleteFromS3 } from "../../middleware/uploadWarmUpMedia";


interface Trainer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  goal: string;
  price: number;
  rating: number;
  experience_years: number;
  certifications: string;
}


// Interface para la data de respuesta
interface UserTrainerPlan {
  trainer_id: number;
  trainer_name: string;
  plan_id: number;
  plan_title: string;
  inscription_date: string | null;
}
export const createTrainer = async (req: Request, res: Response) => {
  try {
    // 1. Verificar token
    const token = req.headers["x-access-token"];
    if (!token) {
      return res.status(401).json({ error: true, message: "Token requerido" });
    }

    const decoded = verify(token as string, SECRET);
    const adminId = (decoded as any).userId; // quien crea

    // 2. Extraer datos del body
    const {
      name,
      email,
      phone,
      description,
      address,
      goal,
      price,
      rating = 0,
      experience_years = 0,
    } = req.body;

    // 3. Validación con DTO
    const { error } = createTrainerDto.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: true,
        message: error.details[0].message,
      });
    }

    // 4. VALIDAR QUE EMAIL Y TELÉFONO NO EXISTAN (NUEVAS VALIDACIONES)
    // Verificar si el email ya existe en la tabla auth
    if (email) {
      const [existingEmail]: any = await pool.execute(
        "SELECT id FROM auth WHERE email = ?",
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({
          error: true,
          message: `El email ${email} ya está registrado en el sistema`,
        });
      }
    }

    // Verificar si el teléfono ya existe en la tabla auth
    if (phone) {
      const [existingPhone]: any = await pool.execute(
        "SELECT id FROM auth WHERE telefono = ?",
        [phone]
      );
      if (existingPhone.length > 0) {
        return res.status(409).json({
          error: true,
          message: `El teléfono ${phone} ya está registrado en el sistema`,
        });
      }
    }

    // 5. Manejo de archivos subidos por Multer
    let imageUrl: string | null = null;
    let certificationsUrls: string[] = [];

    const files = req.files as { [key: string]: Express.MulterS3.File[] } | undefined;

    if (files?.image?.[0]) {
      imageUrl = files.image[0].location;
    }

    if (files?.certifications) {
      certificationsUrls = files.certifications.map((file) => file.location);
    }

    // 6. Crear usuario base
    const [userRes]: any = await pool.execute(
      "INSERT INTO usuarios (nombre) VALUES (?)",
      [name]
    );
    const usuarioId = userRes.insertId;

    // 7. Crear entrenador CON REFERENCIA a usuario_id
    const [trainerRes]: any = await pool.execute(
      `INSERT INTO entrenadores (
        usuario_id, name, email, phone, description, address, goal, price, rating, experience_years,
        image, certifications, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        usuarioId,
        name,
        email,
        phone,
        description || null,
        address || null,
        goal || null,
        price || null,
        rating,
        experience_years,
        imageUrl,
        certificationsUrls.length > 0 ? JSON.stringify(certificationsUrls) : null,
      ]
    );

    const trainerId = trainerRes.insertId;

    // 8. Crear auth para trainer para permitir flujo OTP web
    const authData = {
      usuario_id: usuarioId,
      name: name || null,
      entrenador_id: trainerId,
      email: email || null,
      telefono: phone || null,
      id_apple: 0,
      tipo_login: email ? "email" : "phone",
      rol: "trainer",
    };
    await OtpModel.createAuth(authData);

    console.log(`✅ Entrenador creado exitosamente - Usuario ID: ${usuarioId}, Trainer ID: ${trainerId}`);

    // 9. Preparar y enviar OTP
    // → Aquí DEJAMOS QUE sendOTP envíe SU respuesta
    req.body = {
      email,
      phonenumber: phone,
      name,
      platform: "web",
      usuario_id: usuarioId,
      entrenador_id: trainerId,
      rol: "trainer",
    };

    // Llamamos sendOTP y dejamos que maneje la respuesta
    await sendOTP(req, res, (err?: any) => {
      if (err) {
        console.error("Error en callback de sendOTP:", err);
      }
    });

    // ¡NO PONER NADA MÁS AQUÍ!
    // No return, no res.json, no res.status después de sendOTP
    // La respuesta la envía sendOTP directamente

  } catch (error: any) {
    console.error("Error al crear entrenador:", error);

    // Solo enviamos respuesta de error si NO se ha enviado nada aún
    if (!res.headersSent) {
      return res.status(500).json({
        error: true,
        message: "Error al crear el entrenador: " + (error.message || "desconocido"),
      });
    }

    // Si ya se envió headers (por sendOTP o error previo), no hacemos nada
    // Express ya manejará el cierre de la conexión
  }
};

// Obtener entrenadores (con soporte para query param name)
export const getTrainers = async (req: Request, res: Response, next: NextFunction) => {
  const { name, page = 1, limit = 20 } = req.query; // Agregamos page y limit como query params
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = {
    message: "",
    error: false,
    data: [] as Trainer[],
    current_page: 0,
    total_trainers: 0,
    total_pages: 0
  };

  try {
    // Validación con DTO para query params (ajusta si necesitas uno específico para list)
    const { error: dtoError } = getTrainersListDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // === CONSTRUCCIÓN DINÁMICA DE WHERE ===
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (name) {
      whereConditions.push(`e.name LIKE ?`);
      params.push(`%${name}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // === CONTAR TOTAL ===
    let countQuery = `
      SELECT COUNT(DISTINCT e.id) AS total
      FROM entrenadores e
      LEFT JOIN asignaciones a ON a.entrenador_id = e.id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ${whereClause}
    `;

    const [countRows] = await pool.query(countQuery, params);
    const totalTrainers = (countRows as any)[0].total;
    const totalPages = Math.ceil(totalTrainers / limitNum);

    // === CONSULTA PRINCIPAL ===
    let query = `
      SELECT 
        e.id, 
        e.name, 
        e.email, 
        e.phone, 
        e.description, 
        e.goal, 
        e.rating, 
        e.experience_years, 
        e.certifications, 
        e.created_at,
        COUNT(DISTINCT a.usuario_id) AS user_count,
        IFNULL(
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', u.id,
              'name', u.nombre  -- Reemplaza 'nombre' con el nombre real de la columna en 'usuarios' si es diferente
            )
          ),
          JSON_ARRAY()
        ) AS assigned_users
      FROM entrenadores e
      LEFT JOIN asignaciones a ON a.entrenador_id = e.id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ${whereClause}
      GROUP BY 
        e.id, 
        e.name, 
        e.email, 
        e.phone, 
        e.description, 
        e.goal, 
        e.rating, 
        e.experience_years, 
        e.certifications, 
        e.created_at
      ORDER BY e.name ASC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, limitNum, offset];
    const [rows] = await pool.query(query, queryParams);

    const trainerRows = rows as Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      description: string;
      goal: string;
      rating: number;
      experience_years: number;
      certifications: string;
      created_at: Date;
      user_count: number;
      assigned_users: string; // JSON string from the query
    }>;

    response.current_page = pageNum;
    response.total_trainers = totalTrainers;
    response.total_pages = totalPages;

    if (trainerRows.length > 0) {
      response.data = adapterTrainers(trainerRows); // Asegúrate de que adapterTrainers maneje estos campos
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

// Obtener un entrenador por ID (ACTUALIZADO con JOIN a auth y formato de fecha)
export const getTrainerById = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: null as Trainer | null };

  // Función auxiliar para formatear fecha
  const formatDateWithSlash = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  try {
    // Validación con DTO para params
    const { error: dtoError } = getTrainerDto.validate({ id: Number(id) });
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    // 1. Obtener datos del entrenador
    const query = "SELECT id, name, email, phone, description, goal, rating, experience_years, certifications, created_at FROM entrenadores WHERE id = ?";
    const [rows] = await pool.execute(query, [id]);

    const trainerRow = rows as Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      description: string;
      goal: string;
      rating: number;
      experience_years: number;
      certifications: string;
      created_at: Date;
    }>;

    if (trainerRow.length > 0) {
      // 2. Obtener usuarios asignados CON PLANES Y STATUS desde auth
      const [assigned] = await pool.execute(`
        SELECT 
          a.id as assignment_id,
          a.usuario_id as user_id,
          a.plan_id,
          a.status,
          a.fecha_asignacion as assigned_date,
          p.title as plan_title,
          p.price_cop,
          p.description_items,
          auth.email as user_email  -- Usar email de auth como identificador
        FROM asignaciones a
        LEFT JOIN planes p ON a.plan_id = p.id
        LEFT JOIN auth ON a.usuario_id = auth.usuario_id
        WHERE a.entrenador_id = ? AND a.status = 'active'
        ORDER BY a.fecha_asignacion DESC
      `, [id]);

      // 3. Formatear usuarios asignados
      const assignedUsers = (assigned as any[]).map((a: any) => {
        let parsedDescriptionItems = [];

        if (a.description_items) {
          if (Array.isArray(a.description_items)) {
            // Ya es un array (parseado por mysql2)
            parsedDescriptionItems = a.description_items;
            console.log('✅ description_items ya es array:', parsedDescriptionItems);
          } else if (typeof a.description_items === 'string') {
            // Si por algún motivo es string, parsea
            try {
              parsedDescriptionItems = JSON.parse(a.description_items);
            } catch (error) {
              console.error("Error al parsear description_items string para el usuario:", a.user_id, error);
              // Fallback: split por comas si parece lista
              parsedDescriptionItems = a.description_items.split(',').map((item: any) => item.trim()).filter((item: any) => item);
            }
          } else {
            console.warn('⚠️ description_items no es array ni string:', typeof a.description_items);
          }
        }

        return {
          assignment_id: a.assignment_id,
          user_id: a.user_id,
          user_email: a.user_email || `Usuario ${a.user_id}`,
          plan_id: a.plan_id,
          plan_title: a.plan_title || 'Plan no especificado',
          price_cop: a.price_cop || 0,
          description_items: parsedDescriptionItems,
          status: a.status,
          assigned_date: a.assigned_date ? formatDateWithSlash(new Date(a.assigned_date)) : null
        };
      });

      // 4. Contar total de usuarios activos
      const totalAssignedUsers = assignedUsers.length;

      // 5. Construir objeto del entrenador completo
      const trainer = {
        ...trainerRow[0],
        assigned_users: assignedUsers,
        total_assigned_users: totalAssignedUsers
      };

      // 6. Usar adapter para consistencia
      response.data = adapterTrainers([trainer])[0];
      response.message = "Entrenador obtenido exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontró el entrenador";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener el entrenador por ID:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener el entrenador por ID." });
  }
};

export const getUserTrainerAndPlan = async (req: Request, res: Response, next: NextFunction) => {
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: null as UserTrainerPlan | null };

  // Función auxiliar para formatear fecha
  const formatDateWithSlash = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  try {
    // No se necesita DTO de validación ya que no hay params/body, pero si quieres agregar uno para futuro, hazlo aquí

    if (!userId) {
      response.error = true;
      response.message = "No se pudo obtener el ID del usuario desde el token";
      return res.status(401).json(response);
    }

    // Consulta para obtener entrenador, plan y fecha de inscripción basada en el userId
    const query = `
      SELECT 
        e.id AS trainer_id,
        e.name AS trainer_name,
        p.id AS plan_id,
        p.title AS plan_title,
        a.fecha_asignacion AS inscription_date
      FROM asignaciones a
      LEFT JOIN entrenadores e ON a.entrenador_id = e.id
      LEFT JOIN planes p ON a.plan_id = p.id
      WHERE a.usuario_id = ? AND a.status = 'active'
      ORDER BY a.fecha_asignacion DESC
      LIMIT 1  -- Asumimos el más reciente si hay múltiples, ajusta si necesitas todos
    `;
    const [rows] = await pool.execute(query, [userId]);

    const resultRow = rows as Array<{
      trainer_id: number;
      trainer_name: string;
      plan_id: number;
      plan_title: string;
      inscription_date: Date;
    }>;

    if (resultRow.length > 0) {
      const data = {
        trainer_id: resultRow[0].trainer_id,
        trainer_name: resultRow[0].trainer_name,
        plan_id: resultRow[0].plan_id,
        plan_title: resultRow[0].plan_title,
        inscription_date: resultRow[0].inscription_date ? formatDateWithSlash(new Date(resultRow[0].inscription_date)) : null
      };

      response.data = data;
      response.message = "Datos de entrenador y plan obtenidos exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontró entrenador o plan asignado para este usuario";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener el entrenador y plan del usuario:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener el entrenador y plan del usuario." });
  }
};

// Actualizar entrenador (PUT /update)
export const updateTrainer = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"];
    const decoded = verify(token as string, SECRET);
    const adminId = (decoded as any).userId;

    const {
      id, // ← importante: debe venir en el body o params
      new_name,
      new_email,
      new_phone,
      new_description,
      new_goal,
      new_price,
      new_rating,
      new_experience_years,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        error: true,
        message: "El campo 'id' es requerido para actualizar",
      });
    }

    // Validación con DTO
    const { error } = updateTrainerDto.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: true,
        message: error.details[0].message,
      });
    }

    // Obtener datos actuales
    const [currentRows]: any = await pool.execute(
      "SELECT image, certifications FROM entrenadores WHERE id = ?",
      [id]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({
        error: true,
        message: "Entrenador no encontrado",
      });
    }

    const current = currentRows[0];
    let updatedImage = current.image;
    let updatedCerts: string[] = current.certifications
      ? JSON.parse(current.certifications)
      : [];

    // Manejo de archivos nuevos
    const files = req.files as { [key: string]: Express.MulterS3.File[] } | undefined;

    // Foto de perfil (reemplaza si se envía)
    if (files?.image?.[0]) {
      const newImageUrl = files.image[0].location;
      if (updatedImage) {
        await deleteFromS3(updatedImage); // borra la anterior de S3
      }
      updatedImage = newImageUrl;
    }

    // Certificados (reemplaza todos si se envían nuevos)
    if (files?.certifications && files.certifications.length > 0) {
      // Borrar los anteriores (opcional, comenta si prefieres acumular)
      for (const oldUrl of updatedCerts) {
        await deleteFromS3(oldUrl);
      }
      updatedCerts = files.certifications.map((file) => file.location);
    }

    // Construir actualización dinámica
    const updates: string[] = [];
    const values: any[] = [];

    if (new_name) {
      updates.push("name = ?");
      values.push(new_name);
    }
    if (new_email) {
      updates.push("email = ?");
      values.push(new_email);
    }
    if (new_phone) {
      updates.push("phone = ?");
      values.push(new_phone);
    }
    if (new_description !== undefined) {
      updates.push("description = ?");
      values.push(new_description);
    }
    if (new_goal !== undefined) {
      updates.push("goal = ?");
      values.push(new_goal);
    }
    if (new_price !== undefined) {
      updates.push("price = ?");
      values.push(new_price);
    }
    if (new_rating !== undefined) {
      updates.push("rating = ?");
      values.push(new_rating);
    }
    if (new_experience_years !== undefined) {
      updates.push("experience_years = ?");
      values.push(new_experience_years);
    }

    // Siempre incluir image y certifications si hubo cambios o no
    updates.push("image = ?");
    values.push(updatedImage);
    updates.push("certifications = ?");
    values.push(updatedCerts.length > 0 ? JSON.stringify(updatedCerts) : null);

    values.push(id);

    if (updates.length === 0) {
      return res.status(400).json({
        error: true,
        message: "No se proporcionaron campos para actualizar",
      });
    }

    const query = `UPDATE entrenadores SET ${updates.join(", ")} WHERE id = ?`;
    const [result]: any = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: true,
        message: "No se pudo actualizar el entrenador",
      });
    }

    return res.json({
      error: false,
      message: "Entrenador actualizado exitosamente",
      data: {
        id,
        image: updatedImage,
        certifications: updatedCerts,
      },
    });
  } catch (error: any) {
    console.error("Error al actualizar entrenador:", error);
    return res.status(500).json({
      error: true,
      message: "Error interno al actualizar el entrenador",
    });
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

// Asignar usuario a entrenador CON PLAN (nueva funcionalidad - COMPLETO Y AJUSTADO)
export const assignUserWithPlan = async (req: Request, res: Response, next: NextFunction) => {
  // 🔥 LOGS DE DEPURACIÓN COMPLETA
  console.log('🔍 === DEPURACIÓN assignUserWithPlan ===');
  console.log('📤 URL:', req.originalUrl);
  console.log('📋 Method:', req.method);
  console.log('📊 Headers:', {
    'content-type': req.get('Content-Type'),
    'x-access-token': req.get('x-access-token') ? 'PRESENTE' : 'AUSENTE',
    'user-agent': req.get('User-Agent')
  });
  console.log('📦 req.body:', req.body);
  console.log('📦 req.body type:', typeof req.body);
  console.log('📦 req.body keys:', Object.keys(req.body || {}));
  console.log('🔍 ==============================');

  const { trainer_id, plan_id } = req.body;

  const response = {
    message: "",
    error: false,
    data: null as any
  };

  try {
    // 🔥 LOG: Verificar desestructuración inicial
    console.log('🔑 trainer_id inicial:', trainer_id, '(', typeof trainer_id, ')');
    console.log('🔑 plan_id inicial:', plan_id, '(', typeof plan_id, ')');

    // 1. Obtener usuario autenticado del token
    const { headers } = req;
    const token = headers["x-access-token"];
    if (!token) {
      console.log('❌ ERROR: Sin token');
      response.error = true;
      response.message = "Token de acceso requerido";
      return res.status(401).json(response);
    }

    const decode = token && verify(`${token}`, SECRET);
    if (!decode) {
      console.log('❌ ERROR: Token inválido');
      response.error = true;
      response.message = "Token inválido";
      return res.status(401).json(response);
    }

    const userId = (<any>decode).userId; // Asegurar que userId sea accesible
    if (!userId) {
      console.log('❌ ERROR: Sin userId en token');
      response.error = true;
      response.message = "Usuario no identificado en el token";
      return res.status(401).json(response);
    }

    console.log('👤 userId del token:', userId, 'type:', typeof userId);

    // 2. Validación con NUEVO DTO (con detalles completos)
    console.log('🔍 Iniciando validación DTO...');
    const { error: dtoError, value } = assignUserWithPlanDto.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    console.log('📋 DTO value:', value);
    console.log('❌ DTO error:', dtoError ? dtoError.details.map((d: any) => d.message).join(', ') : 'NINGUNO');

    if (dtoError) {
      response.error = true;
      response.message = dtoError.details.map((detail: any) => detail.message).join(', ');
      console.log('🚫 VALIDACIÓN FALLÓ - Detalles:', dtoError.details);
      return res.status(400).json(response);
    }

    console.log('✅ DTO validación EXITOSA');

    // 3. Verificar que el ENTRENADOR existe
    console.log('🔍 Verificando entrenador ID:', trainer_id);
    const [trainer] = await pool.execute(
      "SELECT id, name, email FROM entrenadores WHERE id = ?",
      [trainer_id]
    );
    if ((trainer as any[]).length === 0) {
      console.log('🏋️‍♂️ Entrenador NO encontrado');
      response.error = true;
      response.message = "El entrenador seleccionado no existe";
      return res.status(404).json(response);
    }
    console.log('🏋️‍♂️ Entrenador encontrado:', (trainer as any[])[0].name);

    // 4. Verificar que el PLAN existe
    console.log('🔍 Verificando plan ID:', plan_id);
    const [plan] = await pool.execute(
      "SELECT id, title, price_cop, description_items FROM planes WHERE id = ?",
      [plan_id]
    );
    if ((plan as any[]).length === 0) {
      console.log('📅 Plan NO encontrado');
      response.error = true;
      response.message = "El plan seleccionado no existe";
      return res.status(400).json(response);
    }
    console.log('📅 Plan encontrado:', (plan as any[])[0].title);

    // 5. Verificar si ya existe una suscripción ACTIVA
    console.log('🔍 Verificando suscripción existente para userId:', userId, 'trainer_id:', trainer_id);
    const [existingAssignment] = await pool.execute(
      "SELECT id, status FROM asignaciones WHERE usuario_id = ? AND entrenador_id = ? AND status = 'active'",
      [userId, trainer_id]
    );
    if ((existingAssignment as any[]).length > 0) {
      console.log('🚫 Suscripción activa existente encontrada');
      response.error = true;
      response.message = "Ya tienes una suscripción activa con este entrenador. Cancela la anterior antes de crear una nueva.";
      return res.status(400).json(response);
    }
    console.log('✅ No hay suscripción activa previa');

    // 6. Insertar la NUEVA ASIGNACIÓN con plan
    console.log('📥 Insertando nueva asignación...');
    const fechaAsignacion = new Date(); // 20/10/2025 22:13 (hora actual aproximada)
    const [result]: any = await pool.execute(
      `INSERT INTO asignaciones (
        usuario_id, 
        entrenador_id, 
        plan_id, 
        fecha_asignacion, 
        status
      ) VALUES (?, ?, ?, ?, 'active')`,
      [userId, trainer_id, plan_id, fechaAsignacion]
    );

    if (result && result.insertId) {
      console.log('✅ Asignación insertada con ID:', result.insertId);

      // 7. Obtener la asignación creada CON DETALLES completos
      console.log('🔍 Obteniendo detalles de la asignación...');
      const [newAssignment] = await pool.execute(`
        SELECT 
          a.id,
          a.usuario_id,
          a.entrenador_id,
          a.plan_id,
          a.status,
          a.fecha_asignacion,
          t.name as trainer_name,
          p.title as plan_title,
          p.price_cop,
          p.description_items
        FROM asignaciones a
        JOIN entrenadores t ON a.entrenador_id = t.id
        JOIN planes p ON a.plan_id = p.id
        WHERE a.id = ?
      `, [result.insertId]);

      const assignmentData = (newAssignment as any[])[0];

      response.data = {
        id: assignmentData.id,
        user_id: assignmentData.usuario_id,
        trainer_id: assignmentData.entrenador_id,
        trainer_name: assignmentData.trainer_name,
        plan_id: assignmentData.plan_id,
        plan_title: assignmentData.plan_title,
        price_cop: assignmentData.price_cop,
        // 🔥 CORREGIDO: Parseo seguro de JSON con logs
        description_items: (() => {
          let parsedItems = [];
          if (assignmentData.description_items) {
            if (Array.isArray(assignmentData.description_items)) {
              // Ya es un array (parseado por mysql2)
              parsedItems = assignmentData.description_items;
              console.log('✅ description_items ya es array:', parsedItems);
            } else if (typeof assignmentData.description_items === 'string') {
              try {
                parsedItems = JSON.parse(assignmentData.description_items);
                console.log('✅ description_items parseado:', parsedItems);
              } catch (parseError) {
                console.log('⚠️ JSON parse error en description_items:', assignmentData.description_items, 'Error:', parseError);
                // Fallback: split por comas
                parsedItems = assignmentData.description_items.split(',').map((item: any) => item.trim()).filter((item: any) => item);
                console.log('🔧 Fallback description_items:', parsedItems);
              }
            } else {
              console.warn('⚠️ description_items no es array ni string:', typeof assignmentData.description_items);
            }
          }
          return parsedItems;
        })(),
        status: assignmentData.status,
        assigned_date: formatDateWithSlash(assignmentData.fecha_asignacion) // Ajustado al formato DD/MM/YYYY
      };

      response.message = "¡Suscripción creada exitosamente! Ahora estás asignado al entrenador con el plan seleccionado.";
      console.log('✅ Respuesta lista para enviar:', response);
      return res.status(201).json(response);
    } else {
      console.log('❌ Fallo al insertar asignación');
      response.error = true;
      response.message = "No se pudo crear la suscripción. Intenta nuevamente.";
      return res.status(400).json(response);
    }

  } catch (error: any) {
    console.error('💥 ERROR GENERAL:', error.message, 'Code:', error.code);
    response.error = true;
    response.message = "Error interno del servidor al crear la suscripción.";
    return res.status(500).json(response);
  }
};

// Función auxiliar para formato de fecha (asegurada)
const formatDateWithSlash = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Octubre es 10
  const year = date.getFullYear(); // 2025
  return `${day}/${month}/${year}`;
};