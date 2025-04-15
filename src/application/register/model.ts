import { Schema, model } from "mongoose";

export const REGISTER_USER_TABLE = "users";

const registerModel = new Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: { type: String, minlength: 8, select: false },
  phone: { type: String, required: true },
  weight: { type: Number, required: true, positive: true },
  age: { type: Number, required: true, integer: true, min: 1 },
  gender: { type: String, required: true },
  rol: { type: Number, required: true, default: 0 },
  reason: { type: String, required: true, minlength: 3, maxlength: 255 },
  otp_email: { type: Number },
  otp_phone: { type: Number },
});

export const RegisterModel = model(REGISTER_USER_TABLE, registerModel);
