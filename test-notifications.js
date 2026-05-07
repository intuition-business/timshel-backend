require('dotenv').config();
const admin = require('firebase-admin');
const mysql = require('mysql2/promise');

async function run() {
  // 1. Inicializar Firebase
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin inicializado');

  // 2. Conectar a BD
  const conn = await mysql.createConnection({
    host: process.env.HOST.trim(),
    port: parseInt(process.env.PORT_DB.trim()),
    user: process.env.USER_DB.trim(),
    password: process.env.PASSWORD_DB.trim(),
    database: process.env.DATABASE.trim(),
  });
  console.log('✅ Conectado a la BD');

  // 3. Dry run — ver qué usuarios recibirían notificación hoy
  console.log('\n--- Usuarios que recibirían notificación hoy ---');
  for (const days of [7, 3, 1]) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().split('T')[0];

    const [rows] = await conn.execute(
      `SELECT a.id AS user_id, a.email, a.plan_valid_until, a.plan_id,
              COUNT(dt.id) AS tokens_registrados
       FROM auth a
       LEFT JOIN device_tokens dt ON a.id = dt.user_id
       WHERE DATE(a.plan_valid_until) = ? AND a.plan_id != 0
       GROUP BY a.id`,
      [dateStr]
    );

    if (rows.length) {
      console.log(`\nD-${days} (vencen el ${dateStr}):`);
      rows.forEach(r => console.log(`  user_id=${r.user_id} email=${r.email} tokens=${r.tokens_registrados}`));
    } else {
      console.log(`D-${days} (vencen el ${dateStr}): nadie`);
    }
  }

  // 4. Ver usuarios con plan activo y fechas próximas (vista general)
  console.log('\n--- Usuarios con plan activo y plan_valid_until próximo ---');
  const [upcoming] = await conn.execute(
    `SELECT a.id, a.email, a.plan_id, a.plan_valid_until,
            DATEDIFF(a.plan_valid_until, CURDATE()) AS dias_restantes,
            COUNT(dt.id) AS tokens_registrados
     FROM auth a
     LEFT JOIN device_tokens dt ON a.id = dt.user_id
     WHERE a.plan_id != 0 AND a.plan_valid_until IS NOT NULL
     GROUP BY a.id
     ORDER BY a.plan_valid_until ASC
     LIMIT 10`
  );

  if (upcoming.length) {
    upcoming.forEach(r => {
      console.log(`  user=${r.id} email=${r.email} plan_id=${r.plan_id} vence=${r.plan_valid_until ? r.plan_valid_until.toISOString().split('T')[0] : 'null'} dias=${r.dias_restantes} tokens=${r.tokens_registrados}`);
    });
  } else {
    console.log('  No hay usuarios con plan activo y fecha de vencimiento');
  }

  // 5. Probar conexión real a Firebase con token ficticio
  console.log('\n--- Probando envío FCM (token ficticio) ---');
  try {
    await admin.messaging().send({
      token: 'token_de_prueba_invalido_123',
      notification: { title: 'Test', body: 'Test' },
    });
  } catch (err) {
    if (err.errorInfo?.code === 'messaging/registration-token-not-registered' ||
        err.errorInfo?.code === 'messaging/invalid-registration-token') {
      console.log('✅ Firebase conectado correctamente (token ficticio rechazado como se espera)');
    } else {
      console.log('❌ Error Firebase:', err.errorInfo?.code || err.message);
    }
  }

  await conn.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
