const categoryTranslations: Record<string, string> = {
  PECHO:         'Chest',
  ESPALDA:       'Back',
  CUADRICEPS:    'Quadriceps',
  ISQUITIBIALES: 'Hamstrings',
  BICEPS:        'Biceps',
  TRICEPS:       'Triceps',
  HOMBRO:        'Shoulders',
  ABDOMEN:       'Core',
  GLUTEO:        'Glutes',
  PANTORRILLA:   'Calves',
};

export const adapterExercises = (data: any, lang: string = 'es') => {
  const isEn = lang === 'en';
  const result = data.map((item: any) => {
    return {
      id: item?.id,
      category: isEn ? (categoryTranslations[item?.category] ?? item?.category) : item?.category,
      exercise: isEn ? (item?.exercise_en ?? item?.exercise) : item?.exercise,
      description: isEn ? (item?.description_en ?? item?.description) : item?.description,
      video_url: item?.video_url,
      thumbnail_url: item?.thumbnail_url,
      at_home: item?.at_home,
      muscle_group: item?.muscleGroup || item?.muscle_group || null,
    };
  });
  return result;
};