import * as admin from 'firebase-admin';

const getFirebasePrivateKey = (): string | undefined => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  // JSON.parse convierte \n escapados en saltos de línea reales (necesario en Docker)
  try {
    return JSON.parse(`"${key}"`);
  } catch {
    return key.replace(/\\n/g, '\n');
  }
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getFirebasePrivateKey(),
    }),
  });
}

export default admin;
