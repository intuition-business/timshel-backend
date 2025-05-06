export const adapterForms = (data: any) => {
  const result = data.map((item: any) => {
    return {
      user_id: item?.usuario_id,
      height: item?.estatura,
      age: item?.edad,
      weight: item?.peso,
      gender: item?.genero,
      activity_factor: item?.factor_actividad,
      goal: item?.objetivo,
      availability: item?.disponibilidad,
      hours_per_day: item?.horas_dia,
      injury: item?.lesion,
      pathology: item?.patologia,
      food: item?.alimentos,
      meals_per_day: item?.comidas_dia,
      foods_not_consumed: item?.alimentos_no_consumo,
      illness: item?.enfermedad,
    };
  });
  return result;
};
