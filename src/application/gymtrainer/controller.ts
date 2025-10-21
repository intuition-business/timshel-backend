// controller.ts for trainers
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterTrainers } from "./adapter";
import { createTrainerDto, getTrainerDto, updateTrainerDto, deleteTrainerDto, assignUserDto, getTrainersListDto, assignUserWithPlanDto } from "./dto"; // Importamos los DTOs
import { OtpModel } from "../otp/model";


interface Trainer {
  id: number;
  name: string;
  email: string;
  phone: string;
  description: string;
  goal: string;
  rating: number;
  experience_years: number;
  certifications: string;
  image: string;
}

// Crear un entrenador
export const createTrainer = async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, phone, description, goal, rating, experience_years, certifications, image } = req.body;

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

    const query = "INSERT INTO entrenadores (name, email, phone, description, goal, rating, experience_years, certifications, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const [result]: any = await pool.query(query, [name, email, phone, description, goal, rating, experience_years, certifications, image]);

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
        trainer: { name, email, phone, description, goal, rating, experience_years, certifications, image },
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

// Obtener entrenadores (con soporte para query param name)
export const getTrainers = async (req: Request, res: Response, next: NextFunction) => {
  const { name } = req.query; // Solo usamos name como query param
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: [] as Trainer[] };

  try {
    // Validación con DTO para query params (ajusta si necesitas uno específico para list)
    const { error: dtoError } = getTrainersListDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    let query = `
      SELECT 
        id, 
        name, 
        email, 
        phone, 
        description, 
        goal, 
        rating, 
        experience_years, 
        certifications, 
        image, 
        created_at
      FROM entrenadores
    `;
    const params: any[] = [];

    // Si se proporciona name, agregar filtro LIKE para búsqueda por letra
    if (name) {
      query += " WHERE name LIKE ?";
      params.push(`%${name}%`); // Búsqueda insensible a mayúsculas/minúsculas
    }

    // Ordenar por nombre de forma ascendente por defecto
    query += " ORDER BY name ASC";

    // Ejecutar la consulta
    const [rows] = params.length > 0
      ? await pool.execute(query, params)
      : await pool.query(query);

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
      image: string;
      created_at: Date;
    }>;

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
    const query = "SELECT id, name, email, phone, description, goal, rating, experience_years, certifications, image, created_at FROM entrenadores WHERE id = ?";
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
      image: string;
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
      const assignedUsers = (assigned as any[]).map((a: any) => ({
        assignment_id: a.assignment_id,
        user_id: a.user_id,
        user_email: a.user_email || `Usuario ${a.user_id}`, // Fallback si no hay email
        plan_id: a.plan_id,
        plan_title: a.plan_title || 'Plan no especificado',
        price_cop: a.price_cop || 0,
        description_items: a.description_items ? JSON.parse(a.description_items) : [],
        status: a.status,
        assigned_date: a.assigned_date ? formatDateWithSlash(new Date(a.assigned_date)) : null
      }));

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


// Actualizar un entrenador (CORREGIDO)
export const updateTrainer = async (req: Request, res: Response, next: NextFunction) => {
  const { id, new_name, new_email, new_phone, new_description, new_goal, new_rating, new_experience_years, new_certifications, new_image } = req.body;

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

    // 1. Verificar que el entrenador existe antes de actualizar
    const [existingTrainer] = await pool.execute(
      "SELECT id FROM entrenadores WHERE id = ?",
      [id]
    );
    if ((existingTrainer as any[]).length === 0) {
      response.error = true;
      response.message = "El entrenador no existe";
      return res.status(404).json(response);
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // ✅ phone -> phone (no telefono)
    if (new_phone) {
      updateFields.push("phone = ?");  // ✅ CORREGIDO
      updateValues.push(new_phone);
    }

    // ✅ name -> name (no name, ya está correcto)
    if (new_name) {
      updateFields.push("name = ?");
      updateValues.push(new_name);
    }

    // ✅ email -> email (no email, ya está correcto)
    if (new_email) {
      updateFields.push("email = ?");
      updateValues.push(new_email);
    }

    // ✅ description -> description (no description, ya está correcto)
    if (new_description) {
      updateFields.push("description = ?");
      updateValues.push(new_description);
    }

    // ✅ goal -> goal (no goal, ya está correcto)
    if (new_goal) {
      updateFields.push("goal = ?");
      updateValues.push(new_goal);
    }

    // ✅ rating -> rating (no rating, ya está correcto)
    if (new_rating !== undefined) {
      updateFields.push("rating = ?");
      updateValues.push(new_rating);
    }

    // ❌ PROBLEMA: experience_years vs experiencia
    if (new_experience_years !== undefined) {
      updateFields.push("experience_years = ?");
      updateValues.push(new_experience_years);
    }

    // ❌ PROBLEMA: certifications vs certificaciones
    if (new_certifications) {
      updateFields.push("certifications = ?");
      updateValues.push(new_certifications);
    }

    // ❌ PROBLEMA: image vs foto_perfil
    if (new_image) {
      updateFields.push("image = ?");
      updateValues.push(new_image);
    }

    if (updateFields.length === 0) {
      response.error = true;
      response.message = "No se proporcionaron campos para actualizar.";
      return res.status(400).json(response);
    }

    // 3. Verificación adicional para email único (si se actualiza)
    if (new_email) {
      const [emailConflict] = await pool.execute(
        "SELECT id FROM entrenadores WHERE email = ? AND id != ?",
        [new_email, id]
      );
      if ((emailConflict as any[]).length > 0) {
        response.error = true;
        response.message = `El email "${new_email}" ya está registrado por otro entrenador.`;
        return res.status(400).json(response);
      }
    }

    // 4. Ejecutar actualización
    const query = `UPDATE entrenadores SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(id);

    const [result]: any = await pool.execute(query, updateValues);  // ✅ Usar execute en lugar de query para consistencia

    if (result.affectedRows > 0) {
      response.message = "Entrenador actualizado exitosamente";

      // Opcional: retornar los datos actualizados
      const [updatedTrainer] = await pool.execute(
        "SELECT id, name, email, phone, description, goal, rating, experience_years, certifications, image FROM entrenadores WHERE id = ?",
        [id]
      );

      return res.status(200).json({
        ...response,
        data: adapterTrainers(updatedTrainer as any[])[0]  // Retornar entrenador actualizado
      });
    } else {
      response.error = true;
      response.message = "No se encontró el entrenador para actualizar";
      return res.status(404).json(response);
    }

  } catch (error: any) {
    // Manejo específico de errores
    if (error.code === 'ER_DUP_ENTRY') {
      response.error = true;
      response.message = "Error: El email ya está registrado por otro entrenador.";
      return res.status(400).json(response);
    }

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

// Asignar usuario a entrenador CON PLAN (nueva funcionalidad)
export const assignUserWithPlan = async (req: Request, res: Response, next: NextFunction) => {
  const { trainer_id, plan_id } = req.body;

  const response = {
    message: "",
    error: false,
    data: null as any
  };

  try {
    // 1. Obtener usuario autenticado del token
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId; // Usuario que se suscribe

    // 2. Validación con NUEVO DTO
    const { error: dtoError } = assignUserWithPlanDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    // 3. Verificar que el ENTRENADOR existe
    const [trainer] = await pool.execute(
      "SELECT id, name, email FROM entrenadores WHERE id = ?",
      [trainer_id]
    );
    if ((trainer as any[]).length === 0) {
      response.error = true;
      response.message = "El entrenador seleccionado no existe";
      return res.status(404).json(response);
    }

    // 4. Verificar que el PLAN existe
    const [plan] = await pool.execute(
      "SELECT id, title, price_cop FROM planes WHERE id = ?",
      [plan_id]
    );
    if ((plan as any[]).length === 0) {
      response.error = true;
      response.message = "El plan seleccionado no existe";
      return res.status(400).json(response);
    }

    // 5. Verificar si ya existe una suscripción ACTIVA para este usuario-entrenador
    const [existingAssignment] = await pool.execute(
      "SELECT id, status FROM asignaciones WHERE usuario_id = ? AND entrenador_id = ? AND status = 'active'",
      [userId, trainer_id]
    );
    if ((existingAssignment as any[]).length > 0) {
      response.error = true;
      response.message = "Ya tienes una suscripción activa con este entrenador. Cancela la anterior antes de crear una nueva.";
      return res.status(400).json(response);
    }

    // 6. Insertar la NUEVA ASIGNACIÓN con plan
    const fechaAsignacion = new Date();
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
      // 7. Obtener la asignación creada CON DETALLES completos
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
        description_items: JSON.parse(assignmentData.description_items || '[]'),
        status: assignmentData.status,
        assigned_date: assignmentData.fecha_asignacion
      };

      response.message = "¡Suscripción creada exitosamente! Ahora estás asignado al entrenador con el plan seleccionado.";
      return res.status(201).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo crear la suscripción. Intenta nuevamente.";
      return res.status(400).json(response);
    }

  } catch (error: any) {
    // Manejo específico de errores de base de datos
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      response.error = true;
      response.message = "Error de integridad: El entrenador o plan no existe";
      return res.status(400).json(response);
    }

    console.error("Error al crear suscripción:", error);
    next(error);
    return res.status(500).json({
      message: "Error interno del servidor al crear la suscripción."
    });
  }
};