import pool from "../../../config/db";

export const UpdateForm = async ({
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
}: any) => {
  const fieldsToUpdate = [];
  const queryParams = [];

  if (user_id !== undefined) {
    fieldsToUpdate.push("usuario_id = ?");
    queryParams.push(user_id);
  }
  if (height !== undefined) {
    fieldsToUpdate.push("estatura = ?");
    queryParams.push(height);
  }
  if (weight !== undefined) {
    fieldsToUpdate.push("peso = ?");
    queryParams.push(weight);
  }
  if (age !== undefined) {
    fieldsToUpdate.push("edad = ?");
    queryParams.push(age);
  }
  if (gender !== undefined) {
    fieldsToUpdate.push("genero = ?");
    queryParams.push(gender);
  }
  if (activity_factor !== undefined) {
    fieldsToUpdate.push("factor_actividad = ?");
    queryParams.push(activity_factor);
  }
  if (main_goal !== undefined) {
    fieldsToUpdate.push("objetivo = ?");
    queryParams.push(main_goal);
  }
  if (favorite_muscular_group !== undefined) {
    fieldsToUpdate.push("grupo_muscular_favorito = ?");
    queryParams.push(favorite_muscular_group);
  }
  if (training_place !== undefined) {
    fieldsToUpdate.push("lugar_entrenamiento = ?");
    queryParams.push(training_place);
  }
  if (hours_per_day !== undefined) {
    fieldsToUpdate.push("horas_dia = ?");
    queryParams.push(hours_per_day);
  }
  if (injury !== undefined) {
    fieldsToUpdate.push("lesion = ?");
    queryParams.push(injury);
  }
  if (pathology !== undefined) {
    fieldsToUpdate.push("patologia = ?");
    queryParams.push(pathology);
  }
  if (foods_not_consumed !== undefined) {
    fieldsToUpdate.push("alimentos_no_consumo = ?");
    queryParams.push(foods_not_consumed);
  }
  if (illness !== undefined) {
    fieldsToUpdate.push("enfermedad = ?");
    queryParams.push(illness);
  }
  if (allergy !== undefined) {
    fieldsToUpdate.push("alergia = ?");
    queryParams.push(allergy);
  }
  if (usually_dinner !== undefined) {
    fieldsToUpdate.push("cena = ?");
    queryParams.push(usually_dinner);
  }
  if (usually_lunch !== undefined) {
    fieldsToUpdate.push("almuerzo = ?");
    queryParams.push(usually_lunch);
  }
  if (usually_breakfast !== undefined) {
    fieldsToUpdate.push("desayuno = ?");
    queryParams.push(usually_breakfast);
  }
  if (weekly_availability !== undefined) {
    fieldsToUpdate.push("actividad_semanal = ?");
    queryParams.push(weekly_availability);
  }
  if (birthday !== undefined) {
    fieldsToUpdate.push("fecha_nacimiento = ?");
    queryParams.push(birthday);
  }
  if (name !== undefined) {
    fieldsToUpdate.push("name = ?");
    queryParams.push(name);
  }

  if (fieldsToUpdate.length === 0) {
    return {};
  }
  const setClause = fieldsToUpdate.join(", ");
  const sql = `UPDATE formulario SET ${setClause} WHERE usuario_id = ${user_id}`;
  const [result] = await pool.execute(sql, queryParams);

  return result;
};
