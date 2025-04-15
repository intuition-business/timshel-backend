import { Document } from "mongoose";

export interface IUser {
  _id?: string;
  name: string;
  email: string;
  password: string;
  password_confirmation?: string;
  phone: string;
  weight?: number;
  age?: number;
  gender?: string;
  rol: number;
  reason?: string;
  otp_email?: number;
  otp_phone?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
