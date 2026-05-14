import * as admin from 'firebase-admin';

const getFirebasePrivateKey = (): string | undefined => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  // Si es base64 (una sola línea sin espacios ni guiones) → decodificar
  if (!key.includes('-----BEGIN')) {
    return Buffer.from(key.trim(), 'base64').toString('utf8');
  }
  // Fallback: reemplazar \n literales por saltos de línea reales
  return key.replace(/\\n/g, '\n');
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
