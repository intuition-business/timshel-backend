import { Request, Response } from 'express';
import pool from '../../config/db';
import { getPayment } from './index';

export const mercadopagoWebhook = async (req: Request, res: Response) => {
    const event = req.body;

    try {
        // Solo procesar eventos de tipo "payment"
        if (event.type !== 'payment' || !event.data?.id) {
            res.status(200).send('Evento ignorado');
            return;
        }

        // Consultar el pago completo a la API de MP
        const payment = await getPayment(String(event.data.id));

        const metadata = payment.metadata || {};
        const planId = metadata.plan_id || metadata.planId || null;
        const userId = metadata.user_id || metadata.userId || null;
        const entrenadorId = metadata.entrenador_id || metadata.entrenadorId || null;

        // Validar si el pago ya existe en la BD
        const [rows]: any = await pool.execute(
            'SELECT id, status, user_id, entrenador_id FROM payments WHERE mercadopago_id = ?',
            [payment.id]
        );

        if (rows.length === 0) {
            const query = `INSERT INTO payments (
                mercadopago_id, user_id, plan_id, entrenador_id, period, amount, status, description, approved_at,
                payment_method_id, payment_type_id, currency_id, installments, payer_email, created_at,
                last_updated_at, net_amount, fee_amount, card_last_four, cardholder_name, registered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            await pool.execute(query, [
                payment.id,
                userId,
                planId,
                entrenadorId,
                metadata.period || null,
                payment.transaction_amount,
                payment.status,
                payment.description,
                payment.date_approved,
                payment.payment_method_id,
                payment.payment_type_id,
                payment.currency_id,
                payment.installments,
                payment.payer?.email || null,
                payment.date_created,
                payment.date_last_updated,
                payment.net_amount,
                payment.fee_details?.[0]?.amount || null,
                payment.card?.last_four_digits || null,
                payment.card?.cardholder?.name || null,
                new Date()
            ]);
        } else {
            await pool.execute(
                `UPDATE payments SET status = ?, approved_at = ?, last_updated_at = ? WHERE mercadopago_id = ?`,
                [payment.status, payment.date_approved, payment.date_last_updated, payment.id]
            );
        }

        // Si el pago fue aprobado, ejecutar lógica de asignación
        if (payment.status === 'approved' && planId) {
            const resolvedUserId = userId || rows[0]?.user_id;
            const resolvedEntrenadorId = entrenadorId || rows[0]?.entrenador_id;

            if (resolvedUserId) {
                // 1. Obtener generations_allowed del plan
                const [planRows]: any = await pool.execute(
                    'SELECT generations_allowed FROM planes WHERE id = ?',
                    [planId]
                );

                if (planRows.length > 0) {
                    const { generations_allowed } = planRows[0];

                    // 2. Actualizar plan, generaciones y entrenador en auth
                    await pool.execute(
                        `UPDATE auth SET plan_id = ?, generations_remaining = ?, entrenador_id = COALESCE(?, entrenador_id) WHERE id = ?`,
                        [planId, generations_allowed, resolvedEntrenadorId, resolvedUserId]
                    );
                }

                // 3. Obtener periodo activo: primero desde user_routine, fallback al metadata
                const [routineRows]: any = await pool.execute(
                    `SELECT DISTINCT start_date, end_date FROM user_routine
                     WHERE user_id = ?
                     ORDER BY start_date DESC LIMIT 1`,
                    [resolvedUserId]
                );

                const periodStart = routineRows[0]?.start_date || (metadata.period_start ? new Date(metadata.period_start) : null);
                const periodEnd = routineRows[0]?.end_date || null;

                // Guardar periodo en payments
                if (periodStart) {
                    await pool.execute(
                        `UPDATE payments SET period_start = ?, period_end = ? WHERE mercadopago_id = ?`,
                        [periodStart, periodEnd, payment.id]
                    );
                }

                // 4. Crear asignación con entrenador si viene en el pago
                if (resolvedEntrenadorId) {
                    const [existing]: any = await pool.execute(
                        `SELECT id FROM asignaciones WHERE usuario_id = ? AND entrenador_id = ? AND status = 'active'`,
                        [resolvedUserId, resolvedEntrenadorId]
                    );

                    if (existing.length === 0) {
                        await pool.execute(
                            `INSERT INTO asignaciones (usuario_id, entrenador_id, plan_id, fecha_asignacion, status) VALUES (?, ?, ?, ?, 'active')`,
                            [resolvedUserId, resolvedEntrenadorId, planId, new Date()]
                        );
                    }
                }
            }
        }

        res.status(200).send('Webhook recibido');
    } catch (error) {
        console.error('Error en webhook MercadoPago:', error);
        res.status(500).send('Error procesando webhook');
    }
};
