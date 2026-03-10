import { Router } from 'express';
import { createPaymentController, createSubscriptionController } from './controller';
import { mercadopagoWebhook } from './webhook';

const router = Router();

// Pago único
router.post('/payment', createPaymentController);

// Suscripción
router.post('/subscription', createSubscriptionController);

// Webhook
router.post('/webhook', mercadopagoWebhook);

export default router;
