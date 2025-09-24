import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterWeights } from "./adapter";
import { createWeightDto, getWeightsDto, updateWeightDto, deleteWeightDto } from "./dto";

interface Weight {
    weight: number;
    date: string;
}

// Función para formatear las fechas a "DD/MM/YYYY"
const formatDateWithSlash = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
};

// Función para obtener la fecha en formato "YYYY-MM-DD" usando componentes locales
const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const createWeight = async (req: Request, res: Response, next: NextFunction) => {
    const { error } = createWeightDto.validate(req.body);
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    const { weight, date } = req.body;

    const response = { message: "", error: false };

    try {
        const { headers } = req;
        const token = headers["x-access-token"];
        const decode = token && verify(`${token}`, SECRET);
        const userId = (<any>(<unknown>decode)).userId;

        // Convertir fecha de "DD/MM/YYYY" a "YYYY-MM-DD"
        const [dayStr, monthStr, yearStr] = date.split('/');
        const dbDate = `${yearStr}-${monthStr}-${dayStr}`;

        // Verificar si ya existe un registro para esa fecha
        const [existingWeight] = await pool.execute(
            "SELECT id FROM user_weight WHERE user_id = ? AND date = ?",
            [userId, dbDate]
        );

        if ((existingWeight as any).length > 0) {
            response.error = true;
            response.message = `Ya existe un registro de peso para la fecha ${date}`;
            return res.status(400).json(response);
        }

        // Insertar el nuevo registro
        const [result]: any = await pool.execute(
            "INSERT INTO user_weight (user_id, weight, date) VALUES (?, ?, ?)",
            [userId, weight, dbDate]
        );

        if (result) {
            response.message = "Peso registrado exitosamente";
            return res.status(201).json({
                weight,
                date,
            });
        } else {
            response.error = true;
            response.message = "No se pudo registrar el peso";
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Error al crear el registro de peso:", error);
        next(error);
        return res.status(500).json({ message: "Error al crear el registro de peso." });
    }
};

export const getWeightsByUserId = async (req: Request, res: Response, next: NextFunction) => {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    const response = { message: "", error: false, data: [] as Weight[] };

    try {
        const [rows] = await pool.execute(
            "SELECT weight, date FROM user_weight WHERE user_id = ? ORDER BY date ASC",
            [userId]
        );

        const weightRows = rows as Array<{
            weight: number;
            date: string | Date | null;
        }>;

        if (weightRows.length > 0) {
            const formattedRows = weightRows.map((row) => {
                // Convert to strings if Date objects
                const dateStr = row.date instanceof Date ? getLocalDateString(row.date) : row.date;

                // Parse and format, with validation
                const formatOrInvalid = (dateStr: string | null): string => {
                    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        return 'Invalid Date';
                    }
                    const dateObj = new Date(dateStr); // Directly parse YYYY-MM-DD
                    if (isNaN(dateObj.getTime())) {
                        return 'Invalid Date';
                    }
                    return formatDateWithSlash(dateObj);
                };

                return {
                    weight: row.weight,
                    date: formatOrInvalid(dateStr),
                };
            });

            response.data = formattedRows;
            response.message = "Registros de peso obtenidos exitosamente";
            return res.status(200).json(response);
        } else {
            response.error = true;
            response.message = "No se encontraron registros de peso para este usuario";
            return res.status(404).json(response);
        }
    } catch (error) {
        console.error("Error al obtener los registros de peso del usuario:", error);
        next(error);
        return res.status(500).json({ message: "Error al obtener los registros de peso." });
    }
};

export const updateWeight = async (req: Request, res: Response, next: NextFunction) => {
    const { error } = updateWeightDto.validate(req.body);
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    const { weight, date } = req.body;

    const response = { message: "", error: false };

    try {
        const { headers } = req;
        const token = headers["x-access-token"];
        const decode = token && verify(`${token}`, SECRET);
        const userId = (<any>(<unknown>decode)).userId;

        // Convertir fecha de "DD/MM/YYYY" a "YYYY-MM-DD"
        const [dayStr, monthStr, yearStr] = date.split('/');
        const dbDate = `${yearStr}-${monthStr}-${dayStr}`;

        // Actualizar el registro
        const [result] = await pool.execute(
            "UPDATE user_weight SET weight = ? WHERE user_id = ? AND date = ?",
            [weight, userId, dbDate]
        );

        const updateResult = result as import('mysql2').ResultSetHeader;

        if (updateResult && updateResult.affectedRows > 0) {
            response.message = "Registro de peso actualizado exitosamente";
            return res.status(200).json(response);
        } else {
            response.error = true;
            response.message = "No se encontró un registro de peso para actualizar";
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Error al actualizar el registro de peso:", error);
        next(error);
        return res.status(500).json({ message: "Error al actualizar el registro de peso." });
    }
};

export const deleteWeight = async (req: Request, res: Response, next: NextFunction) => {
    const { error } = deleteWeightDto.validate(req.body);
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    const { date } = req.body;

    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    const response = { message: "", error: false };

    try {
        // Convertir fecha de "DD/MM/YYYY" a "YYYY-MM-DD"
        const [dayStr, monthStr, yearStr] = date.split('/');
        const dbDate = `${yearStr}-${monthStr}-${dayStr}`;

        const [result] = await pool.execute(
            "DELETE FROM user_weight WHERE user_id = ? AND date = ?",
            [userId, dbDate]
        );

        const deleteResult = result as import('mysql2').ResultSetHeader;

        if (deleteResult && deleteResult.affectedRows > 0) {
            response.message = "Registro de peso eliminado exitosamente";
            return res.status(200).json(response);
        } else {
            response.error = true;
            response.message = "No se encontró un registro de peso para eliminar";
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Error al eliminar el registro de peso:", error);
        next(error);
        return res.status(500).json({ message: "Error al eliminar el registro de peso." });
    }
};

export const getShouldUpdateWeight = async (req: Request, res: Response, next: NextFunction) => {
    const dateParam = req.query.date as string;

    if (!dateParam || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateParam)) {
        return res.status(400).json({ error: true, message: "Fecha inválida. Debe estar en formato DD/MM/YYYY." });
    }

    try {
        const { headers } = req;
        const token = headers["x-access-token"];
        const decode = token && verify(`${token}`, SECRET);
        const userId = (<any>(<unknown>decode)).userId;

        // Convertir fecha de "DD/MM/YYYY" a objeto Date
        const [dayStr, monthStr, yearStr] = dateParam.split('/');
        const providedDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));

        if (isNaN(providedDate.getTime())) {
            return res.status(400).json({ error: true, message: "Fecha inválida." });
        }

        // Calcular la fecha de 15 días atrás
        const fifteenDaysAgo = new Date(providedDate);
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        // Formatear fechas a "YYYY-MM-DD" para la consulta
        const dbProvidedDate = getLocalDateString(providedDate);
        const dbFifteenDaysAgo = getLocalDateString(fifteenDaysAgo);

        // Consultar si hay registros en los últimos 15 días
        const [rows] = await pool.execute(
            "SELECT COUNT(*) as count FROM user_weight WHERE user_id = ? AND date >= ? AND date <= ?",
            [userId, dbFifteenDaysAgo, dbProvidedDate]
        );

        const result = rows as Array<{ count: number }>;
        const count = result[0].count;

        const shouldUpdate = count === 0;

        return res.status(200).json({ "should-update": shouldUpdate });
    } catch (error) {
        console.error("Error al verificar si el usuario debe actualizar el peso:", error);
        next(error);
        return res.status(500).json({ message: "Error al verificar si el usuario debe actualizar el peso." });
    }
};

export const getLatestWeightsComparison = async (req: Request, res: Response, next: NextFunction) => {
    const response = { message: "", error: false, data: { weights: [] as Weight[], comparison: { status: "", difference: 0 } } };

    try {
        const { headers } = req;
        const token = headers["x-access-token"];
        const decode = token && verify(`${token}`, SECRET);
        const userId = (<any>(<unknown>decode)).userId;

        // Obtener los dos últimos registros de peso ordenados por fecha descendente
        const [rows] = await pool.execute(
            "SELECT weight, date FROM user_weight WHERE user_id = ? ORDER BY date DESC LIMIT 2",
            [userId]
        );

        const weightRows = rows as Array<{
            weight: number;
            date: string | Date | null;
        }>;

        if (weightRows.length === 0) {
            response.error = true;
            response.message = "No se encontraron registros de peso para este usuario";
            return res.status(404).json(response);
        }

        const formattedWeights = weightRows.map((row) => {
            // Convert to strings if Date objects
            const dateStr = row.date instanceof Date ? getLocalDateString(row.date) : row.date;

            // Parse and format, with validation
            const formatOrInvalid = (dateStr: string | null): string => {
                if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    return 'Invalid Date';
                }
                const dateObj = new Date(dateStr); // Directly parse YYYY-MM-DD
                if (isNaN(dateObj.getTime())) {
                    return 'Invalid Date';
                }
                return formatDateWithSlash(dateObj);
            };

            return {
                weight: row.weight,
                date: formatOrInvalid(dateStr),
            };
        });

        response.data.weights = formattedWeights;

        if (weightRows.length < 2) {
            response.message = "Solo hay un registro de peso, no se puede realizar una comparación";
            response.data.comparison = { status: "no comparison", difference: 0 };
            return res.status(200).json(response);
        }

        // El primer elemento es el más reciente, el segundo es el anterior
        const latestWeight = weightRows[0].weight;
        const previousWeight = weightRows[1].weight;
        const difference = latestWeight - previousWeight;

        let status: string;
        if (difference > 0) {
            status = "gained";
        } else if (difference < 0) {
            status = "lost";
        } else {
            status = "same";
        }

        response.data.comparison = { status, difference: Math.abs(difference) }; // Usamos valor absoluto para la diferencia mostrada
        response.message = "Comparación de pesos obtenida exitosamente";

        return res.status(200).json(response);
    } catch (error) {
        console.error("Error al obtener la comparación de pesos:", error);
        next(error);
        return res.status(500).json({ message: "Error al obtener la comparación de pesos." });
    }
};