// adapter.ts for trainers
export const adapterTrainers = (data: any) => {
  const result = data.map((item: any) => {
    return {
      id: item?.id,
      name: item?.name,
      email: item?.email,
      phone: item?.telefono,
      biography: item?.biografia,
      experience_years: item?.experiencia,
      certifications: item?.certificaciones,
      profile_photo: item?.foto_perfil,
      assigned_users: item?.assigned_users || [],
    };
  });
  return result;
};