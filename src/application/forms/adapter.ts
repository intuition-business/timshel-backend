export const adapterForms = (data: any) => {
  const result = data.map((item: any) => {
    return {
      user_id: item?.usuario_id,
      name: item?.name,
      phone: item?.phone,
      email: item?.email,
      birthday: item?.fecha_nacimiento,
      gender: item?.genero,
      weight: item?.peso,
      height: item?.estatura,
      main_goal: item?.objetivo,
      weekly_availability: item?.actividad_semanal,
      hours_per_day: item?.horas_dia,

      favorite_muscular_group: (() => {
        let value = item?.grupo_muscular_favorito;
        if (!Array.isArray(value)) {
          value = value ? [value] : [];
        }
        return value.flatMap((el: any) => {
          if (typeof el === 'string') {
            try {
              const parsed = JSON.parse(el);
              return Array.isArray(parsed) ? parsed : [el];
            } catch (e) {
              return [el];
            }
          }
          return [el]; // Si no es string, lo dejamos como está
        });
      })(),

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
      train_experience: (() => {
        let value = item?.train_experience;
        if (value == null) return null;

        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'string') {
              value = parsed;
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              value = parsed[0]; // Tomamos el primero si es array
            }
          } catch (e) {
            // No es JSON válido, usamos el string original
          }
        }

        if (typeof value !== 'string') return null;

        const normalized = value.toLowerCase().trim();
        const enumValues = ['basic', 'beginner', 'intermediate', 'advanced', 'expert'];

        return enumValues.includes(normalized) ? normalized : null;
      })(),
    };
  });

  return result;
};