import dotenv from 'dotenv';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';  // PreApproval con A mayúscula

dotenv.config();

// Configuración de MercadoPago
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    options: { timeout: 5000 }
});
// Crear pago
export const createPayment = async (paymentData: any) => {
    try {
        console.log('MercadoPago createPayment - data recibida:', paymentData);
        const payment = new Payment(client);
        const response = await payment.create({
            body: paymentData
        });
        console.log('MercadoPago createPayment - respuesta:', response);
        return response;
    } catch (error) {
        console.error('MercadoPago createPayment - error:', error);
        throw error;
    }
};

// Crear suscripción (PreApproval)
export const createSubscription = async (subscriptionData: any) => {
    try {
        const preApproval = new PreApproval(client);
        const response = await preApproval.create({
            body: subscriptionData
        });
        return response;
    } catch (error) {
        console.error('MercadoPago createSubscription - error:', error);
        throw error;
    }
};