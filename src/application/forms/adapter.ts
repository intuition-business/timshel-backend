export const adapterForms = (data: any) => {
  const result = data.map((item: any) => {
    return {
      user_id: item?.usuario_id,
      name: item?.name,
      birthday: item?.fecha_nacimiento,
      gender: item?.genero,
      weight: item?.peso,
      height: item?.estatura,
      activity_factor: item?.factor_actividad,
      goal: item?.objetivo,
      weekly_availability: item?.actividad_semanal,
      hours_per_day: item?.horas_dia,
      injury: item?.lesion,
      pathology: item?.patologia,
      usually_breakfast: item?.desayuno,
      usually_lunch: item?.almuerzo,
      usually_dinner: item?.cena,
      age: item?.edad,
      allergy: item?.alergia,
      illness: item?.enfermedad,
      foods_not_consumed: item?.alimentos_no_consumo,
    };
  });
  return result;
};
