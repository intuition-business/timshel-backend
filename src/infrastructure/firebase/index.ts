import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const b64 = process.env.FIREBASE_CREDENTIALS_B64;
  if (b64) {
    // Prod: JSON completo de credenciales en base64 (evita problemas de multi-línea en Docker)
    const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Local: variables individuales del .env
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
}

export default admin;
