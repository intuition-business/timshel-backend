import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterPlans } from "./adapter";
import { createPlanDto, getPlanDto, updatePlanDto, deletePlanDto } from "./dto";

interface Plan {
    id: number;
    title: string;
    price_cop: number;
    description_items: string[]; // Asumiendo que se parsea a array en el adapter
}

// Crear un nuevo plan
export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
    const { error } = createPlanDto.validate(req.body);
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    const { title, price_cop, description_items } = req.body;

    const response = { message: "", error: false };

    try {
        const { headers } = req;
        const token = headers["x-access-token"];
        const decode = token && verify(`${token}`, SECRET);
        const userId = (<any>(<unknown>decode)).userId; // Extraído para auth, pero no usado en query (asumiendo auth general)

        // Verificar si ya existe un plan con el mismo título (opcional, para evitar duplicados)
        const [existingPlan] = await pool.execute(
            "SELECT id FROM planes WHERE title = ?",
            [title]
        );

        if ((existingPlan as any).length > 0) {
            response.error = true;
            response.message = `Ya existe un plan con el título ${title}`;
            return res.status(400).json(response);
        }

        // Insertar el nuevo plan (description_items como JSON stringified)
        const [result]: any = await pool.execute(
            "INSERT INTO planes (title, price_cop, description_items) VALUES (?, ?, ?)",
            [title, price_cop, JSON.stringify(description_items)]
        );

        if (result) {
            response.message = "Plan creado exitosamente";
            return res.status(201).json({
                title,
                price_cop,
                description_items,
            });
        } else {
            response.error = true;
            response.message = "No se pudo crear el plan";
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Error al crear el plan:", error);
        next(error);
        return res.status(500).json({ message: "Error al crear el plan." });
    }
};

// Obtener todos los planes
export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId; // Extraído para auth

    const response = { message: "", error: false, data: [] as Plan[] };

    try {
        const [rows] = await pool.execute(
            "SELECT id, title, price_cop, description_items FROM planes ORDER BY title ASC"
        );

        const planRows = rows as Array<{
            id: number;
            title: string;
            price_cop: number;
            description_items: string; // Viene como string JSON desde DB
        }>;

        if (planRows.length > 0) {
            response.data = adapterPlans(planRows); // Adapter parseará JSON a array
            response.message = "Planes obtenidos exitosamente";
            return res.status(200).json(response);
        } else {
            response.error = true;
            response.message = "No se encontraron planes";
            return res.status(404).json(response);
        }
    } catch (error) {
        console.error("Error al obtener los planes:", error);
        next(error);
        return res.status(500).json({ message: "Error al obtener los planes." });
    }
};

// Obtener un plan por ID
export const getPlanById = async (req: Request, res: Response, next: NextFunction) => {
    const { error } = getPlanDto.validate(req.params); // Asumiendo que ID viene en params
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    const { id } = req.params;

    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId; // Extraído para auth

    const response = { message: "", error: false, data: null as Plan | null };

    try {
        const [rows] = await pool.execute(
            "SELECT id, title, price_cop, description_items FROM planes WHERE id = ?",
            [id]
        );

        const planRows = rows as Array<{
            id: number;
            title: string;
            price_cop: number;
            description_items: string;
        }>;

        if (planRows.length > 0) {
            response.data = adapterPlans(planRows)[0]; // Adapter para un solo item
            response.message = "Plan obtenido exitosamente";
            return res.status(200).json(response);
        } else {
            response.error = true;
            response.message = "No se encontró el plan";
            return res.status(404).json(response);
        }
    } catch (error) {
        console.error("Error al obtener el plan:", error);
        next(error);
        return res.status(500).json({ message: "Error al obtener el plan." });
    }
};

// Actualizar un plan
export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
    const { error } = updatePlanDto.validate(req.body);
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    const { id, new_title, new_price_cop, new_description_items } = req.body;

    const response = { message: "", error: false };

    try {
        const { headers } = req;
        const token = headers["x-access-token"];
        const decode = token && verify(`${token}`, SECRET);
        const userId = (<any>(<unknown>decode)).userId; // Extraído para auth

        // Construir query dinámica basada en campos proporcionados
        const updates: string[] = [];
        const params: any[] = [];

        if (new_title) {
            updates.push("title = ?");
            params.push(new_title);
        }
        if (new_price_cop) {
            updates.push("price_cop = ?");
            params.push(new_price_cop);
        }
        if (new_description_items) {
            updates.push("description_items = ?");
            params.push(JSON.stringify(new_description_items));
        }

        if (updates.length === 0) {
            response.error = true;
            response.message = "No se proporcionaron campos para actualizar";
            return res.status(400).json(response);
        }

        const query = `UPDATE planes SET ${updates.join(", ")} WHERE id = ?`;
        params.push(id);

        const [result] = await pool.execute(query, params);

        const updateResult = result as import('mysql2').ResultSetHeader;

        if (updateResult && updateResult.affectedRows > 0) {
            response.message = "Plan actualizado exitosamente";
            return res.status(200).json(response);
        } else {
            response.error = true;
            response.message = "No se encontró un plan para actualizar";
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Error al actualizar el plan:", error);
        next(error);
        return res.status(500).json({ message: "Error al actualizar el plan." });
    }
};

// Eliminar un plan
export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
    const { error } = deletePlanDto.validate(req.body);
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    const { id } = req.body;

    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId; // Extraído para auth

    const response = { message: "", error: false };

    try {
        const [result] = await pool.execute(
            "DELETE FROM planes WHERE id = ?",
            [id]
        );

        const deleteResult = result as import('mysql2').ResultSetHeader;

        if (deleteResult && deleteResult.affectedRows > 0) {
            response.message = "Plan eliminado exitosamente";
            return res.status(200).json(response);
        } else {
            response.error = true;
            response.message = "No se encontró un plan para eliminar";
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Error al eliminar el plan:", error);
        next(error);
        return res.status(500).json({ message: "Error al eliminar el plan." });
    }
};