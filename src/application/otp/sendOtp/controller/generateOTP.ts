export const generateOTPSmS = (length = 6): string => {
  const characters = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    otp += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // padStart es opcional aquí (el loop ya genera exactamente 'length' dígitos), pero no daña
  otp = otp.padStart(length, '0');

  return otp;  // Retorna como string para preservar ceros iniciales
};

export const generateOTPEmail = (length = 6): string => {
  const characters = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    otp += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Igual, padStart opcional
  otp = otp.padStart(length, '0');

  return otp;  // Retorna como string
};