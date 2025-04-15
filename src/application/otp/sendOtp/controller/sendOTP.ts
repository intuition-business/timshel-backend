import { Request, Response, NextFunction } from "express";
import { sendWithEmail } from "./sendWithEmail";
import { sendWithPhonenumber } from "./sendWithPhonenumber";
import { generateOTPSmS, generateOTPEmail } from "./generateOTP";
import OtpService from "../../services";
import { ICreateOtp } from "../types";

export const sendOTP = async (req?: Request, res?: Response, next?: any) => {
  const OTP_EXPIRATION_TIME = 300000;
  const services = new OtpService();
  const created_at = Date.now();
  const expires_at = Date.now() + OTP_EXPIRATION_TIME;
  const { email, phonenumber, name } = req?.body || {};

  try {
    if (email) {
      const otp = generateOTPEmail(6);
      const response = await sendWithEmail(email, name, otp);
      if (!response.error) {
        const otpData: ICreateOtp = {
          email,
          otp,
          created_at,
          expires_at,
        };

        await services.create(otpData);
        res?.status(200).json(response);
      }
      res?.status(400).json(response);
    }
  } catch (error) {
    console.log("Error: ", error);
    next(error);
  }

  try {
    if (phonenumber) {
      const otp = generateOTPSmS(4);
      const response = await sendWithPhonenumber(phonenumber, name, otp);
      if (!response.error) {
        const otpData: ICreateOtp = {
          phone: phonenumber,
          otp,
          created_at,
          expires_at,
        };
        await services.create(otpData);
        res?.status(200).json(response);
      }
      res?.status(400).json(response);
    }
  } catch (error) {
    console.log("Error: ", error);
    next(error);
  }
};
