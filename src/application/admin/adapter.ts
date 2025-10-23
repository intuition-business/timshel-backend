// adapter.ts for users
export const adapterUsers = (data: any) => {
  const result = data.map((item: any) => {
    return {
      id: item?.id,
      name: item?.name,
      email: item?.email,
      phone: item?.phone,
      fecha_registro: item?.fecha_registro,
      trainer_id: item?.trainer_id || null,
      trainer_name: item?.trainer_name || null,
    };
  });
  return result;
};