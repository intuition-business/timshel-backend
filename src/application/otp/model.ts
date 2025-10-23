import pool from "../../config/db";

export const OTP_AUTH_TABLE = "auth";
export const USUARIOS_TABLE = "usuarios";
export const OTP_VALIDATION_TABLE = "otp_validation";

const createUser = async (data: {
  nombre?: string;
  fecha_registro: Date;
  planes_id: number;
}): Promise<any> => {
  try {
    const { nombre, fecha_registro, planes_id } = data;
    const [result] = await pool.execute(
      `INSERT INTO ${USUARIOS_TABLE} (nombre, fecha_registro, planes_id) VALUES (?, ?, ?)`,
      [nombre, fecha_registro, planes_id]
    );
    return result;
  } catch (error) {
    console.error("Error al crear OTP:", error);
    throw error;
  }
};

const createAuth = async (data: {
  usuario_id: number;
  entrenador_id: number;
  name: string;
  email: string;
  rol: string;
  telefono: string;
  id_apple: number;
  tipo_login: string;
}): Promise<any> => {
  try {
    const { usuario_id, name, entrenador_id, email, rol = 'user', telefono, id_apple, tipo_login } =
      data;
    const [result] = await pool.execute(
      `INSERT INTO ${OTP_AUTH_TABLE} (usuario_id, entrenador_id, email, 	telefono,	id_apple,	tipo_login, rol) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuario_id, entrenador_id, email, telefono, id_apple, tipo_login, rol]
    );
    return result;
  } catch (error) {
    console.error("Error al crear OTP:", error);
    throw error;
  }
};

const createOtp = async (data: {
  auth_id: number;
  code: number | string;
  fecha_creacion: number;
  fecha_expiracion: number;
  isUsed: number;
}): Promise<any> => {
  try {
    const { auth_id, code, fecha_creacion, fecha_expiracion, isUsed } = data;
    const [result] = await pool.execute(
      `INSERT INTO ${OTP_VALIDATION_TABLE} (auth_id, code, fecha_creacion, fecha_expiracion, isUsed) VALUES (?, ?, ?, ?, ?)`,
      [auth_id, code, fecha_creacion, fecha_expiracion, isUsed]
    );
    return result;
  } catch (error) {
    console.error("Error al crear OTP:", error);
    throw error;
  }
};

const updateOtp = async (data: {
  auth_id: number;
  code: number | string;
  fecha_creacion: number;
  fecha_expiracion: number;
  isUsed: number;
}): Promise<any> => {
  try {
    const { auth_id, code, fecha_creacion, fecha_expiracion, isUsed } = data;
    const [result] = await pool.execute(
      `UPDATE ${OTP_VALIDATION_TABLE} SET auth_id = ? , code = ?, fecha_creacion = ?, fecha_expiracion = ?, isUsed = ? WHERE auth_id = ?`,
      [auth_id, code, fecha_creacion, fecha_expiracion, isUsed, auth_id]
    );
    return result;
  } catch (error) {
    console.error("Error al crear OTP:", error);
    throw error;
  }
};

const findByEmail = async (email: string) => {
  try {
    const [rows] = await pool.execute(
      `
        SELECT
            a.*,
            o.*
        FROM
            ${OTP_AUTH_TABLE} a
        LEFT JOIN
            ${OTP_VALIDATION_TABLE} o ON a.id = o.auth_id
        WHERE
            a.email = ?
      `,
      [email] // Proporciona el email como parámetro
    );

    return rows; // Devuelve un array de objetos, donde cada objeto representa una fila
  } catch (error) {
    console.error("Error al obtener datos de auth y otp_validation:", error);
    throw error; // Relanza el error para que pueda ser manejado por quien llama a la función
  }
};

const findByPhone = async (phone: string) => {
  try {
    const [rows] = await pool.execute(
      `
        SELECT
            a.*,
            o.*
        FROM
            ${OTP_AUTH_TABLE} a
        LEFT JOIN
            ${OTP_VALIDATION_TABLE} o ON a.id = o.auth_id
        WHERE
            a.telefono = ?
      `,
      [phone] // Proporciona el email como parámetro
    );

    return rows; // Devuelve un array de objetos, donde cada objeto representa una fila
  } catch (error) {
    console.error("Error al obtener datos de auth y otp_validation:", error);
    throw error; // Relanza el error para que pueda ser manejado por quien llama a la función
  }
};

const findById = async (id: string) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM ${OTP_AUTH_TABLE} WHERE usuario_id = ?`,
      [id] // Proporciona el email como parámetro
    );

    return rows; // Devuelve un array de objetos, donde cada objeto representa una fila
  } catch (error) {
    console.error("Error al obtener datos de auth y otp_validation:", error);
    throw error; // Relanza el error para que pueda ser manejado por quien llama a la función
  }
};

const removeOtp = async (auth_id: string) => {
  try {
    const [result] = await pool.execute(
      `
       DELETE FROM ${OTP_AUTH_TABLE} where auth_id = ?
      `,
      [auth_id] // Proporciona el email como parámetro
    );

    return result; // Devuelve un array de objetos, donde cada objeto representa una fila
  } catch (error) {
    console.error("Error al obtener datos de auth y otp_validation:", error);
    throw error; // Relanza el error para que pueda ser manejado por quien llama a la función
  }
};

export const OtpModel = {
  createUser,
  createAuth,
  createOtp,
  findByEmail,
  findByPhone,
  updateOtp,
  removeOtp,
  findById,
};
