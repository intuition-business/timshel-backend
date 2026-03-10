import { Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { SECRET } from '../../config';
import { createPayment, createSubscription } from './index';

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
