import { Request, Response, NextFunction } from "express";
import pool from "../../../../config/db";
import { OTP_AUTH_TABLE } from "../../model"; // o donde tengas la constante

interface AuthenticatedRequest extends Request {
    userId?: string;
}

export const deleteAccount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    const date = new Date();

    try {
        if (!req.userId) {
            return res.status(401).json({
                message: "No autorizado: token requerido",
                error: true,
                date,
            });
        }

        const authId = req.userId;

        // Solo cambiar el estado usando el id del token
        const [result] = await pool.execute(
            `UPDATE ${OTP_AUTH_TABLE} 
       SET is_deleted = 1 
       WHERE id = ?`,
            [authId]
        );

        const affected = (result as any).affectedRows;

        if (affected === 0) {
            return res.status(404).json({
                message: "Cuenta no encontrada o ya eliminada",
                error: true,
                date,
            });
        }

        return res.status(200).json({
            message: "Cuenta eliminada permanentemente",
            error: false,
            date,
        });
    } catch (error) {
        console.error("Error al eliminar cuenta:", error);
        next(error);
        return res.status(500).json({
            message: "Error interno",
            error: true,
            date,
        });
    }
};