import pool from "../../../config/db";

export const InsertForm = async ({
  user_id,
  height,
  weight,
  age,
  gender,
  activity_factor,
  main_goal,
  favorite_muscular_group,
  training_place,
  hours_per_day,
  injury,
  pathology,
  foods_not_consumed,
  illness,
  allergy,
  usually_dinner,
  usually_lunch,
  usually_breakfast,
  weekly_availability,
  birthday,
  name,
  train_experience,
}: any) => {
  const fieldsToUpdate = [];
  const queryParams = [];
  const values = [];
  if (user_id !== undefined) {
    fieldsToUpdate.push("usuario_id ");
    queryParams.push(user_id);
    values.push("?");
  }
  if (height !== undefined) {
    fieldsToUpdate.push("estatura ");
    queryParams.push(height);
    values.push("?");
  }
  if (weight !== undefined) {
    fieldsToUpdate.push("peso ");
    queryParams.push(weight);
    values.push("?");
  }
  if (age !== undefined) {
    fieldsToUpdate.push("edad ");
    queryParams.push(age);
    values.push("?");
  }
  if (gender !== undefined) {
    fieldsToUpdate.push("genero ");
    queryParams.push(gender);
    values.push("?");
  }
  if (activity_factor !== undefined) {
    fieldsToUpdate.push("factor_actividad ");
    queryParams.push(activity_factor);
    values.push("?");
  }
  if (main_goal !== undefined) {
    fieldsToUpdate.push("objetivo ");
    queryParams.push(main_goal);
    values.push("?");
  }
  if (favorite_muscular_group !== undefined) {
    fieldsToUpdate.push("grupo_muscular_favorito ");
    queryParams.push(favorite_muscular_group);
    values.push("?");
  }
  if (training_place !== undefined) {
    fieldsToUpdate.push("lugar_entrenamiento ");
    queryParams.push(training_place);
    values.push("?");
  }
  if (hours_per_day !== undefined) {
    fieldsToUpdate.push("horas_dia ");
    queryParams.push(hours_per_day);
    values.push("?");
  }
  if (injury !== undefined) {
    fieldsToUpdate.push("lesion ");
    queryParams.push(injury);
    values.push("?");
  }
  if (pathology !== undefined) {
    fieldsToUpdate.push("patologia ");
    queryParams.push(pathology);
    values.push("?");
  }
  if (foods_not_consumed !== undefined) {
    fieldsToUpdate.push("alimentos_no_consumo ");
    queryParams.push(foods_not_consumed);
    values.push("?");
  }
  if (illness !== undefined) {
    fieldsToUpdate.push("enfermedad ");
    queryParams.push(illness);
    values.push("?");
  }
  if (allergy !== undefined) {
    fieldsToUpdate.push("alergia ");
    queryParams.push(allergy);
    values.push("?");
  }
  if (usually_dinner !== undefined) {
    fieldsToUpdate.push("cena ");
    queryParams.push(usually_dinner);
    values.push("?");
  }
  if (usually_lunch !== undefined) {
    fieldsToUpdate.push("almuerzo ");
    queryParams.push(usually_lunch);
    values.push("?");
  }
  if (usually_breakfast !== undefined) {
    fieldsToUpdate.push("desayuno ");
    queryParams.push(usually_breakfast);
    values.push("?");
  }
  if (weekly_availability !== undefined) {
    fieldsToUpdate.push("actividad_semanal ");
    queryParams.push(weekly_availability);
    values.push("?");
  }
  if (birthday !== undefined) {
    fieldsToUpdate.push("fecha_nacimiento ");
    queryParams.push(birthday);
    values.push("?");
  }
  if (name !== undefined) {
    fieldsToUpdate.push("name ");
    queryParams.push(name);
    values.push("?");
  }
  if (train_experience !== undefined) {
    fieldsToUpdate.push("train_experience ");
    queryParams.push(train_experience);
    values.push("?");
  }

  if (fieldsToUpdate.length === 0) {
    return {};
  }
  const setClause = fieldsToUpdate.join(", ");
  const setValue = values.join(", ");
  const sql = `INSERT INTO formulario ( ${setClause} ) VALUES ( ${setValue} )`;
  const [result] = await pool.execute(sql, queryParams);

  return result;
};