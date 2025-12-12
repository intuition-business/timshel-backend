export const adapterExercises = (data: any) => {
  const result = data.map((item: any) => {
    return {
      id: item?.id,
      category: item?.category,
      exercise: item?.exercise,
      description: item?.description,
      video_url: item?.video_url,
      thumbnail_url: item?.thumbnail_url,
      at_home: item?.at_home,
      muscle_group: item?.muscleGroup || item?.muscle_group || null,
    };
  });
  return result;
};