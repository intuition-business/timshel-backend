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
import { presignFields } from "../../services/s3Presigner";

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
      const muscleGroupsRaw = req.body.muscle_groups;
      const muscle_groups = muscleGroupsRaw
        ? JSON.stringify(Array.isArray(muscleGroupsRaw) ? muscleGroupsRaw : JSON.parse(muscleGroupsRaw))
        : null;

      const [result]: any = await pool.query(
        `INSERT INTO warm_ups
         (name, description, video_url, video_thumbnail, duration_in_minutes, muscle_groups)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, description, video_url, video_thumbnail, Number(duration_in_minutes), muscle_groups]
      );

      res.status(201).json({
        warm_up: {
          id: result.insertId,
          name,
          description,
          video_url,
          video_thumbnail,
          duration_in_minutes: Number(duration_in_minutes),
          muscle_groups: muscle_groups ? JSON.parse(muscle_groups) : [],
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

// READ ALL - con random, limit y filtro por categorías del día (3 matching + 1 any)
export const getWarmUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { length, random, categories } = req.query;

  try {
    const token = req.headers["x-access-token"] as string;
    verify(token, SECRET) as JwtPayload;

    const { error: dtoError } = getWarmUpDto.validate(req.query);
    if (dtoError) {
      res.status(400).json({ error: true, message: dtoError.details[0].message });
      return;
    }

    const [allRows] = await pool.query(
      "SELECT id, name, description, video_url, video_thumbnail, duration_in_minutes, muscle_groups FROM warm_ups"
    );
    const all = allRows as any[];

    if (all.length === 0) {
      res.status(404).json({ error: true, message: "No se encontraron calentamientos" });
      return;
    }

    let warmUps: any[];

    if (categories) {
      // Lógica: 3 que correspondan a las categorías del día + 1 cualquiera
      const requestedCats = (categories as string).split(",").map(c => c.trim().toUpperCase());

      const matching = all.filter(w => {
        const groups: string[] = typeof w.muscle_groups === "string"
          ? JSON.parse(w.muscle_groups)
          : (w.muscle_groups ?? []);
        return groups.some(g => requestedCats.includes(g));
      });

      const nonMatching = all.filter(w => !matching.includes(w));

      const shuffle = (arr: any[]) => arr.sort(() => Math.random() - 0.5);

      const picked3 = shuffle([...matching]).slice(0, 3);
      const usedIds = new Set(picked3.map(w => w.id));

      // El 4to: preferir uno que no haya salido, de cualquier categoría
      const remaining = all.filter(w => !usedIds.has(w.id));
      const picked1 = shuffle(remaining).slice(0, 1);

      warmUps = [...picked3, ...picked1];
    } else {
      // Sin filtro: comportamiento original
      const sorted = random === "true"
        ? [...all].sort(() => Math.random() - 0.5)
        : [...all].sort((a, b) => a.name.localeCompare(b.name));

      const limit = length ? Math.min(100, Math.max(1, parseInt(length as string, 10))) : all.length;
      warmUps = sorted.slice(0, limit);
    }

    const data = await presignFields(adapterWarmUps(warmUps), ["video_url", "video_thumbnail"]);
    res.status(200).json({
      message: "Calentamientos obtenidos exitosamente",
      data,
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

      const muscleGroupsRaw = req.body.muscle_groups;
      if (muscleGroupsRaw !== undefined) {
        const parsed = Array.isArray(muscleGroupsRaw) ? muscleGroupsRaw : JSON.parse(muscleGroupsRaw);
        updates.push("muscle_groups = ?");
        values.push(JSON.stringify(parsed));
      }

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