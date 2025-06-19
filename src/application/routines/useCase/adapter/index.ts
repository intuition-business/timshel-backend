export const adapter = (data: any) => {
  const personData = {
    birth_date: data.birthday,
    gender: data.gender,
    weight_kg: data.weight,
    height_cm: data.height,
    activity_level: data.activity_factor,
    primary_goal: data.goal,
    training_days_per_week: data.weekly_availability,
    training_hours_per_day: data.hours_per_day,
    injuries: data.injury,
    pathologies: data.pathology,
    diseases: data.illness,
  };

  return personData;
};
