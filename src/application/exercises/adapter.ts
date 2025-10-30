export const adapterExercises = (data: any) => {
  const result = data.map((item: any) => {
    return {
      id: item?.id,
      category: item?.category,
      exercise: item?.exercise,
      description: item?.description,
      video_url: item?.video_url,
      thumbnail_url: item?.thumbnail_url
    };
  });
  return result;
};