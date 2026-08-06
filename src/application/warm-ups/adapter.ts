// adapter.ts for warm-ups
export const adapterWarmUps = (data: any) => {
  const result = data.map((item: any) => {
    return {
      id: item?.id,
      name: item?.name,
      description: item?.description,
      video_url: item?.video_url,
      video_thumbnail: item?.video_thumbnail,
      duration_in_minutes: item?.duration_in_minutes,
      muscle_groups: item?.muscle_groups
        ? (typeof item.muscle_groups === 'string' ? JSON.parse(item.muscle_groups) : item.muscle_groups)
        : [],
    };
  });
  return result;
};