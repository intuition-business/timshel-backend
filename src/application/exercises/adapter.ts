export const adapterExercises = (data: any) => {
  const result = data.map((item: any) => {
    return {
      category: item?.category,
      exercise: item?.exercise,
      description: item?.description,
    };
  });
  return result;
};