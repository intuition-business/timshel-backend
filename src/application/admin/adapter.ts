// adapter.ts for trainers
export const adapterTrainers = (data: any) => {
  const result = data.map((item: any) => {
    return {
      id: item?.id,
      name: item?.name,
      email: item?.email,
      phone: item?.phone,
      description: item?.description,
      goal: item?.goal,
      rating: item?.rating,
      experience_years: item?.experience_years,
      certifications: item?.certifications,
      image: item?.image,
      assigned_users: item?.assigned_users || [],
    };
  });
  return result;
};