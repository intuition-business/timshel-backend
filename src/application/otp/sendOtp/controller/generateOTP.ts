export const generateOTPSmS = (length = 6): string => {
  const charactersFirst = "123456789"; // No zero for first digit
  const charactersRest = "0123456789";
  let otp = charactersFirst[Math.floor(Math.random() * charactersFirst.length)];

  for (let i = 1; i < length; i++) {
    otp += charactersRest[Math.floor(Math.random() * charactersRest.length)];
  }

  return otp;  // Retorna como string sin ceros iniciales
};

export const generateOTPEmail = (length = 6): string => {
  const charactersFirst = "123456789"; // No zero for first digit
  const charactersRest = "0123456789";
  let otp = charactersFirst[Math.floor(Math.random() * charactersFirst.length)];

  for (let i = 1; i < length; i++) {
    otp += charactersRest[Math.floor(Math.random() * charactersRest.length)];
  }

  return otp;  // Retorna como string sin ceros iniciales
};