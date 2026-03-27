export const adapter = (data: any) => {
  // Mapeo de nombres del formulario → categorías de la tabla exercises
  const muscleGroupMap: Record<string, string> = {
    'pectoral': 'PECHO',
    'pecho': 'PECHO',
    'espalda': 'ESPALDA',
    'hombro': 'HOMBRO',
    'hombros': 'HOMBRO',
    'biceps': 'BICEPS',
    'bíceps': 'BICEPS',
    'triceps': 'TRICEPS',
    'tríceps': 'TRICEPS',
    'cuadriceps': 'CUADRICEPS',
    'cuádriceps': 'CUADRICEPS',
    'isquiotibiales': 'ISQUITIBIALES',
    'isquitibiales': 'ISQUITIBIALES',
    'gluteo': 'GLUTEO',
    'glúteo': 'GLUTEO',
    'pantorrilla': 'PANTORRILLA',
    'abdomen': 'ABDOMEN',
    'abdominales': 'ABDOMEN',
  };

  // Parsear grupo_muscular_favorito si viene como string JSON
  let grupoMuscular: string[] = [];
  if (Array.isArray(data?.grupo_muscular_favorito)) {
    grupoMuscular = data.grupo_muscular_favorito;
  } else if (typeof data?.grupo_muscular_favorito === 'string') {
    try { grupoMuscular = JSON.parse(data.grupo_muscular_favorito); } catch {}
  }
  // Normalizar nombres al formato de la tabla exercises
  grupoMuscular = grupoMuscular.map((g: string) => muscleGroupMap[g.toLowerCase()] || g.toUpperCase());

  const personData = {
    birth_date: data?.fecha_nacimiento,
    gender: data?.genero,
    weight_kg: data?.peso,
    height_cm: data?.estatura,
    activity_level: data?.factor_actividad,
    primary_goal: data?.objetivo,
    training_days_per_week: data?.actividad_semanal,
    training_hours_per_day: data?.horas_dia,
    injuries: data?.lesion,
    pathologies: data?.patologia,
    diseases: data?.enfermedad,
    grupo_muscular_favorito: grupoMuscular,
    train_experience: data?.train_experience || "beginner",
  };

  return personData;
};
