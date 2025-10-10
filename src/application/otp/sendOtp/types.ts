export interface ICreateOtp {
  auth_id?: number;
  fecha_creacion: number;
  fecha_expiracion: number;
  isUsed: number;
  code: number | string;
}

export interface ICreateAuth extends ICreateOtp {
  usuario_id?: number;
  name?: string;
  plataforma?: string;
  entrenador_id?: number;
  email: string;
  telefono: string;
  id_apple: number;
  tipo_login: string;
}
