import { Schema, model } from "mongoose";

export const OTP_USER_TABLE = "users_otp";

const otpModel = new Schema({
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: { type: String, unique: true },
  otp: { type: Number },
  created_at: { type: Number },
  expires_at: { type: Number },
});

export const OtpModel = model(OTP_USER_TABLE, otpModel);
