import { NextFunction, Request, Response } from "express";
import { validateOtpSMS } from "./validateOtpSMS";
import { validateOtpEmail } from "./validateOtpEmail";

export const validateOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, phonenumber, otp } = req.body;
    if (email) {
      const response = await validateOtpEmail(email, otp, next);
      if (response) res.status(response.status).json(response);
    }

    if (phonenumber) {
      const response = await validateOtpSMS(otp, phonenumber, next);
      if (response) res.status(response.status).json(response);
    }
  } catch (error) {
    next(error);
  }
};
