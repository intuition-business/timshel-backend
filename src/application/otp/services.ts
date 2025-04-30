import { OtpModel } from "./model";
import { ICreateAuth } from "./sendOtp/types";

class OtpService {
  constructor() {}

  async create(data: ICreateAuth, thereIsUser: any) {
    const date = new Date();

    if (thereIsUser.length === 0) {
      const user = await OtpModel.createUser({
        nombre: "",
        fecha_registro: date,
        planes_id: 0,
      });

      const auth = await OtpModel.createAuth({
        ...data,
        usuario_id: user.insertId,
        entrenador_id: 0,
      });

      const otp = await OtpModel.createOtp({
        auth_id: auth.insertId,
        code: data.code,
        fecha_creacion: data.fecha_creacion,
        fecha_expiracion: data.fecha_expiracion,
        isUsed: data.isUsed,
      });

      const result = { user, auth, otp };
      return result;
    } else {
      const otp = await OtpModel.updateOtp({
        auth_id: thereIsUser[0].auth_id,
        code: data.code,
        fecha_creacion: data.fecha_creacion,
        fecha_expiracion: data.fecha_expiracion,
        isUsed: data.isUsed,
      });
      return { otp };
    }
  }

  async findByEmail(email: string) {
    const data = await OtpModel.findByEmail(email);
    return data;
  }

  async findByPhone(phone: string) {
    const data = await OtpModel.findByPhone(phone);
    return data;
  }
  async removeOtp(auth_id: string) {
    const data = await OtpModel.removeOtp(auth_id);
    return data;
  }
}

export default OtpService;
