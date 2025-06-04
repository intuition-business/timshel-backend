export const generateOTPSmS = (length = 6): number => {
  const characters = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    otp += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  otp = otp.padStart(length, '0');

  return Number(otp);
};

export const generateOTPEmail = (length = 6): number => {
  const characters = "0123456789";
  let otp = "";


  for (let i = 0; i < length; i++) {
    otp += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  otp = otp.padStart(length, '0');

  return Number(otp);
};
