import { Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { SECRET } from '../../config';
import { createPayment, createSubscription } from './index';
import pool from '../../config/db';

// Crear pago único
export const createPaymentController = async (req: Request, res: Response) => {
    try {
        // Extraer el token del header
        const token = req.headers['x-access-token'];
        let userId = null;
        if (token) {
            try {
                const decode = verify(`${token}`, SECRET);
                userId = (<any>(<unknown>decode)).userId;
            } catch (jwtError) {
                console.error('Error al verificar el token JWT:', jwtError);
            }
        }
        const response = await createPayment(req.body);
        // Guardar el pago en la base de datos
        try {
            const payment = response;
            const metadata = payment.metadata || {};
            const planId = metadata.plan_id || metadata.planId || null;
            const entrenadorId = metadata.entrenador_id || metadata.entrenadorId || null;
            // period_start/period_end se resuelven en el webhook con user_routine o el metadata como fallback
            const query = `INSERT INTO payments (
                mercadopago_id, user_id, plan_id, entrenador_id, amount, status, description, approved_at,
                payment_method_id, payment_type_id, currency_id, installments, payer_email, created_at,
                last_updated_at, net_amount, fee_amount, card_last_four, cardholder_name, registered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const values = [
                payment.id,
                userId || null,
                planId,
                entrenadorId,
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
                payment.fee_details && payment.fee_details[0] ? payment.fee_details[0].amount : null,
                payment.card?.last_four_digits || null,
                payment.card?.cardholder?.name || null,
                new Date() // registered_at
            ];
            await pool.execute(query, values);
        } catch (dbError) {
            console.error('Error al guardar el pago:', dbError);
        }
        res.status(200).json({ success: true, data: response, userId });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Crear suscripción
export const createSubscriptionController = async (req: Request, res: Response) => {
    try {
        const { reason, payer_email, frequency, frequency_type, amount } = req.body;
        const subscriptionData = {
            reason,
            auto_recurring: {
                frequency,
                frequency_type,
                transaction_amount: amount,
                currency_id: 'COP',
            },
            payer: { email: payer_email },
            back_url: 'https://tuapp.com/success',
        };
        const response = await createSubscription(subscriptionData);
        res.status(200).json({ success: true, data: response });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
