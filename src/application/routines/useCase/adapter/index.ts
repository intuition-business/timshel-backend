export const adapter = (data: any) => {
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
  };

  return personData;
};
