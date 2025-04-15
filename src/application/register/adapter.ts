import { IUser } from "./types";

export const adapter = ({
  name = "",
  email = "",
  password = "",
  password_confirmation = "",
  phone = "",
  weight = 0,
  age = 0,
  gender = "",
  rol = 0,
  reason = "",
  otp_email = 0,
  otp_phone = 0,
}: IUser): IUser => {
  const data = {
    name,
    email,
    password,
    password_confirmation,
    phone,
    weight,
    age,
    gender,
    rol,
    reason,
    otp_email,
    otp_phone,
  };
  return data;
};
