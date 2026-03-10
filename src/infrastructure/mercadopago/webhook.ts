import { Request, Response } from 'express';
import pool from '../../config/db';
// Si tienes un useCase/insertPayment, lo puedes importar aquí
// import { InsertPayment } from './useCase/insertPayment';

export const mercadopagoWebhook = async (req: Request, res: Response) => {
    // Aquí procesas los eventos de Mercado Pago
    // Ejemplo: payment.created, payment.succeeded, payment.failed, preapproval.created, preapproval.updated
    const event = req.body;
    try {
        // Solo procesar pagos aprobados
        if (event.type === 'payment' && event.data && event.data.status === 'approved') {
            const payment = event.data;
            const metadata = payment.metadata || {};
            const planId = metadata.plan_id || metadata.planId;
            const period = metadata.period;
            const userId = metadata.user_id || metadata.userId;
            // Validar si el pago ya existe
            const [rows]: any = await pool.execute('SELECT id FROM payments WHERE mercadopago_id = ?', [payment.id]);
            if (rows.length === 0) {
                // Insertar nuevo pago
                const query = `INSERT INTO payments (
                    mercadopago_id, user_id, plan_id, period, amount, status, description, approved_at,
                    payment_method_id, payment_type_id, currency_id, installments, payer_email, created_at,
                    last_updated_at, net_amount, fee_amount, card_last_four, cardholder_name, registered_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                const values = [
                    payment.id,
                    userId || null,
                    planId || null,
                    period || null,
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
            } else {
                // Actualizar estado y datos relevantes
                await pool.execute(
                    `UPDATE payments SET status = ?, description = ?, approved_at = ?, last_updated_at = ? WHERE mercadopago_id = ?`,
                    [
                        payment.status,
                        payment.description,
                        payment.date_approved,
                        payment.date_last_updated,
                        payment.id
                    ]
                );
            }
        }
        // Puedes agregar lógica para otros tipos de eventos
        res.status(200).send('Webhook recibido');
    } catch (error) {
        console.error('Error en webhook MercadoPago:', error);
        res.status(500).send('Error procesando webhook');
    }
};
