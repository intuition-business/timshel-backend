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
            const userId = metadata.user_id || metadata.userId; // Si lo tienes en metadata
            // Si el userId no viene en metadata, deberás buscarlo por otro medio

            // Ejemplo de guardado directo con pool
            const query = `INSERT INTO pagos (mercadopago_id, usuario_id, plan_id, periodo, monto, status, fecha_aprobado) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const values = [
                payment.id,
                userId || null,
                planId || null,
                period || null,
                payment.transaction_amount,
                payment.status,
                payment.date_approved
            ];
            await pool.execute(query, values);
        }
        // Puedes agregar lógica para otros tipos de eventos
        res.status(200).send('Webhook recibido');
    } catch (error) {
        console.error('Error en webhook MercadoPago:', error);
        res.status(500).send('Error procesando webhook');
    }
};
