export const adapterForms = (data: any) => {
  const result = data.map((item: any) => {
    return {
      user_id: item?.usuario_id,
      name: item?.name,
      birthday: item?.fecha_nacimiento,
      gender: item?.genero,
      weight: item?.peso,
      height: item?.estatura,
      main_goal: item?.objetivo,
      weekly_availability: item?.actividad_semanal,
      hours_per_day: item?.horas_dia,

      // Antes era string, ahora es array → aseguramos que siempre sea array
      favorite_muscular_group: Array.isArray(item?.grupo_muscular_favorito)
        ? item?.grupo_muscular_favorito
        : item?.grupo_muscular_favorito
          ? [item?.grupo_muscular_favorito] // si viene string, lo convertimos a array
          : [],

      training_place: item?.lugar_entrenamiento,
      age: item?.edad,

      activity_factor: item?.factor_actividad,
      injury: item?.lesion,
      pathology: item?.patologia,
      usually_breakfast: item?.desayuno,
      usually_lunch: item?.almuerzo,
      usually_dinner: item?.cena,

      allergy: item?.alergia,
      illness: item?.enfermedad,
      foods_not_consumed: item?.alimentos_no_consumo,

      // Nuevo campo
      train_experience: item?.experiencia_entrenamiento || item?.train_experience || null,
    };
  });

  return result;
};