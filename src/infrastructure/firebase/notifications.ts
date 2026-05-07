import admin from './index';
import pool from '../../config/db';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const sendPushNotification = async (
  tokens: string[],
  payload: NotificationPayload
): Promise<void> => {
  if (!tokens.length) return;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`FCM: ${response.successCount} enviadas, ${response.failureCount} fallidas`);
};

const MESSAGES = {
  es: {
    7: { title: '⏰ Tu plan vence en 7 días', body: 'Renuévalo para seguir entrenando sin interrupciones.' },
    3: { title: '⚠️ Tu plan vence en 3 días', body: 'No pierdas tu progreso, renueva tu plan ahora.' },
    1: { title: '🚨 Tu plan vence mañana', body: '¡Último día! Renueva tu plan para seguir entrenando.' },
  },
  en: {
    7: { title: '⏰ Your plan expires in 7 days', body: 'Renew it to keep training without interruptions.' },
    3: { title: '⚠️ Your plan expires in 3 days', body: "Don't lose your progress, renew your plan now." },
    1: { title: '🚨 Your plan expires tomorrow', body: 'Last day! Renew your plan to keep training.' },
  },
};

export const checkExpiringPlans = async (): Promise<void> => {
  const daysToCheck = [7, 3, 1] as const;

  for (const days of daysToCheck) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().split('T')[0];

    const [rows]: any = await pool.execute(
      `SELECT a.id AS user_id, dt.fcm_token, dt.lang
       FROM auth a
       JOIN device_tokens dt ON a.id = dt.user_id
       WHERE DATE(a.plan_valid_until) = ? AND a.plan_id != 0`,
      [dateStr]
    );

    // Agrupa tokens por usuario
    const userMap: Record<number, { tokens: string[]; lang: 'es' | 'en' }> = {};
    for (const row of rows) {
      if (!userMap[row.user_id]) {
        userMap[row.user_id] = { tokens: [], lang: row.lang === 'en' ? 'en' : 'es' };
      }
      userMap[row.user_id].tokens.push(row.fcm_token);
    }

    for (const [, { tokens, lang }] of Object.entries(userMap)) {
      const msg = MESSAGES[lang][days];
      await sendPushNotification(tokens, {
        ...msg,
        data: {
          route: '/subscription',
          days_remaining: String(days),
        },
      });
    }

    if (rows.length > 0) {
      console.log(`Notificaciones D-${days}: ${rows.length} dispositivos notificados`);
    }
  }
};
