export const adapter = (data: any) => {
  // Mapeo de nombres del formulario → categorías de la tabla exercises
  const muscleGroupMap: Record<string, string> = {
    'pectoral': 'PECHO',
    'pecho': 'PECHO',
    'chest': 'PECHO',
    'espalda': 'ESPALDA',
    'back': 'ESPALDA',
    'hombro': 'HOMBRO',
    'hombros': 'HOMBRO',
    'shoulders': 'HOMBRO',
    'shoulder': 'HOMBRO',
    'deltoides': 'HOMBRO',
    'biceps': 'BICEPS',
    'bíceps': 'BICEPS',
    'triceps': 'TRICEPS',
    'tríceps': 'TRICEPS',
    'cuadriceps': 'CUADRICEPS',
    'cuádriceps': 'CUADRICEPS',
    'quadriceps': 'CUADRICEPS',
    'quads': 'CUADRICEPS',
    'isquiotibiales': 'ISQUITIBIALES',
    'isquitibiales': 'ISQUITIBIALES',
    'hamstrings': 'ISQUITIBIALES',
    'gluteo': 'GLUTEO',
    'glúteo': 'GLUTEO',
    'glutes': 'GLUTEO',
    'gluteos': 'GLUTEO',
    'pantorrilla': 'PANTORRILLA',
    'calves': 'PANTORRILLA',
    'abdomen': 'ABDOMEN',
    'abdominales': 'ABDOMEN',
    'core': 'ABDOMEN',
    'abs': 'ABDOMEN',
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
    birth_date: data?.fecha_nacimiento || null,
    gender: data?.genero || "male",
    weight_kg: data?.peso || 70,
    height_cm: data?.estatura || 170,
    activity_level: data?.factor_actividad || "moderate",
    primary_goal: data?.objetivo || "gainMuscle",
    training_days_per_week: data?.actividad_semanal || 3,
    training_hours_per_day: data?.horas_dia || 1,
    injuries: data?.lesion || null,
    pathologies: data?.patologia || null,
    diseases: data?.enfermedad || null,
    grupo_muscular_favorito: grupoMuscular,
    train_experience: data?.train_experience || "beginner",
  };

  return personData;
};
