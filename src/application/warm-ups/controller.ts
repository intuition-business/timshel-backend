// src/warmups/controller.ts
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterWarmUps } from "./adapter";
import {
  createWarmUpDto,
  getWarmUpDto,
  updateWarmUpDto,
  deleteWarmUpDto,
} from "./dto";
import { deleteFromS3, uploadWarmUpMedia } from "../../middleware/uploadWarmUpMedia";

interface WarmUp {
  id: number;
  name: string;
  description: string;
  video_url: string;
  video_thumbnail: string;
  duration_in_minutes: number;
}

interface JwtPayload {
  userId: number;
}

// CREATE - con subida de archivos (array para spread en router)
export const createWarmUp = [
  uploadWarmUpMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { name, description, duration_in_minutes } = req.body;
    const files = req.files as { [fieldname: string]: Express.MulterS3.File[] };

    try {
      const token = req.headers["x-access-token"] as string;
      verify(token, SECRET) as JwtPayload;

      const { error: dtoError } = createWarmUpDto.validate(req.body);
      if (dtoError) {
        res.status(400).json({ error: true, message: dtoError.details[0].message });
        return;
      }

      if (!name || !description || duration_in_minutes === undefined) {
        res.status(400).json({ error: true, message: "Faltan campos requeridos." });
        return;
      }

      if (!files?.video?.[0] || !files?.thumbnail?.[0]) {
        res.status(400).json({ error: true, message: "Video y thumbnail son obligatorios." });
        return;
      }

      const [existing] = await pool.execute("SELECT id FROM warm_ups WHERE name = ?", [name]);
      if ((existing as any[]).length > 0) {
        res.status(400).json({ error: true, message: "Ya existe un calentamiento con ese nombre." });
        return;
      }

      const video_url = files.video[0].location;
      const video_thumbnail = files.thumbnail[0].location;

      const [result]: any = await pool.query(
        `INSERT INTO warm_ups 
         (name, description, video_url, video_thumbnail, duration_in_minutes) 
         VALUES (?, ?, ?, ?, ?)`,
        [name, description, video_url, video_thumbnail, Number(duration_in_minutes)]
      );

      res.status(201).json({
        warm_up: {
          id: result.insertId,
          name,
          description,
          video_url,
          video_thumbnail,
          duration_in_minutes: Number(duration_in_minutes),
        },
      });
    } catch (error: any) {
      if (error.name === "JsonWebTokenError") {
        res.status(401).json({ error: true, message: "Token inválido." });
        return;
      }
      console.error("Error al crear warm-up:", error);
      next(error);
    }
  },
];

// READ ALL - con random y limit
export const getWarmUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { length, random } = req.query;

  try {
    const token = req.headers["x-access-token"] as string;
    verify(token, SECRET) as JwtPayload;

    const { error: dtoError } = getWarmUpDto.validate(req.query);
    if (dtoError) {
      res.status(400).json({ error: true, message: dtoError.details[0].message });
      return;
    }

    let query = "SELECT id, name, description, video_url, video_thumbnail, duration_in_minutes FROM warm_ups";
    const params: any[] = [];

    query += random === "true" ? " ORDER BY RAND()" : " ORDER BY name ASC";

    if (length) {
      const limit = Math.min(100, Math.max(1, parseInt(length as string, 10)));
      query += " LIMIT ?";
      params.push(limit);
    }

    const [rows] = params.length > 0 ? await pool.execute(query, params) : await pool.query(query);
    const warmUps = rows as WarmUp[];

    if (warmUps.length === 0) {
      res.status(404).json({ error: true, message: "No se encontraron calentamientos" });
      return;
    }

    res.status(200).json({
      message: "Calentamientos obtenidos exitosamente",
      data: adapterWarmUps(warmUps),
    });
  } catch (error) {
    console.error("Error al obtener warm-ups:", error);
    next(error);
  }
};

// UPDATE - con reemplazo de archivos
export const updateWarmUp = [
  uploadWarmUpMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = parseInt(req.params.id);
    const { name, description, duration_in_minutes } = req.body;
    const files = req.files as { [fieldname: string]: Express.MulterS3.File[] };

    if (isNaN(id)) {
      res.status(400).json({ error: true, message: "ID inválido." });
      return;
    }

    try {
      const token = req.headers["x-access-token"] as string;
      verify(token, SECRET) as JwtPayload;

      const { error: dtoError } = updateWarmUpDto.validate(req.body);
      if (dtoError) {
        res.status(400).json({ error: true, message: dtoError.details[0].message });
        return;
      }

      const [current] = await pool.execute("SELECT video_url, video_thumbnail FROM warm_ups WHERE id = ?", [id]);
      const currentData = (current as any[])[0];
      if (!currentData) {
        res.status(404).json({ error: true, message: "Calentamiento no encontrado." });
        return;
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (name !== undefined) { updates.push("name = ?"); values.push(name); }
      if (description !== undefined) { updates.push("description = ?"); values.push(description); }
      if (duration_in_minutes !== undefined) { updates.push("duration_in_minutes = ?"); values.push(Number(duration_in_minutes)); }

      if (files?.video?.[0]) {
        updates.push("video_url = ?");
        values.push(files.video[0].location);
        await deleteFromS3(currentData.video_url);
      }
      if (files?.thumbnail?.[0]) {
        updates.push("video_thumbnail = ?");
        values.push(files.thumbnail[0].location);
        await deleteFromS3(currentData.video_thumbnail);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: true, message: "No hay cambios para actualizar." });
        return;
      }

      values.push(id);
      await pool.query(`UPDATE warm_ups SET ${updates.join(", ")} WHERE id = ?`, values);

      res.status(200).json({ message: "Calentamiento actualizado exitosamente" });
    } catch (error) {
      console.error("Error al actualizar warm-up:", error);
      next(error);
    }
  },
];

// DELETE - por ID en params
export const deleteWarmUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: true, message: "ID inválido." });
    return;
  }

  try {
    const token = req.headers["x-access-token"] as string;
    verify(token, SECRET) as JwtPayload;

    const { error: dtoError } = deleteWarmUpDto.validate({ id });
    if (dtoError) {
      res.status(400).json({ error: true, message: dtoError.details[0].message });
      return;
    }

    const [current] = await pool.execute("SELECT video_url, video_thumbnail FROM warm_ups WHERE id = ?", [id]);
    const currentData = (current as any[])[0];
    if (!currentData) {
      res.status(404).json({ error: true, message: "Calentamiento no encontrado." });
      return;
    }

    await deleteFromS3(currentData.video_url);
    await deleteFromS3(currentData.video_thumbnail);

    await pool.execute("DELETE FROM warm_ups WHERE id = ?", [id]);

    res.status(200).json({ message: "Calentamiento eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar warm-up:", error);
    next(error);
  }
};