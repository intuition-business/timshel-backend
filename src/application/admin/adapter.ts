// src/api/users/adapter.ts
export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  fecha_registro: Date;
  trainer_id: number | null;
  trainer_name: string | null;
  trainer_image: string | null;
  user_image: string | null;
  plan_id: number | null;
}

export const adapterUsers = (data: any[]): UserResponse[] => {
  return data.map((item) => ({
    id: item?.id ?? 0,
    name: item?.name ?? '',
    email: item?.email ?? '',
    phone: item?.phone ?? '',
    fecha_registro: item?.fecha_registro ?? new Date(),
    trainer_id: item?.trainer_id ?? null,
    trainer_name: item?.trainer_name ?? null,
    trainer_image: item?.trainer_image ?? null,
    user_image: item?.user_image ?? null,
    plan_id: item?.plan_id ?? null,
  }));
};