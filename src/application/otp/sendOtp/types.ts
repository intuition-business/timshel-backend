export interface ICreateOtp {
  otp: string;
  email?: string;
  phone?: string;
  created_at: number;
  expires_at: number;
}
