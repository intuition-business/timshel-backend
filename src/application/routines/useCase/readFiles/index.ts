const fs = require("fs").promises;
import path from "path";
import pool from "../../../../config/db";

// Función para construir el prompt
export const buildPront = ({
  promptTemplate,
  ejerciciosCsv,
  personData,
  daysData,
  volumenDataJson, // Nuevo parámetro
}: any) => {
  let prompt = promptTemplate.replace("###EJERCICIOS###", ejerciciosCsv);
  prompt = prompt.replace("###DATOS_PERSONA###", JSON.stringify(personData));
  prompt = prompt.replace("###DIAS###", JSON.stringify(daysData));
  prompt = prompt.replace("###VOLUMEN###", volumenDataJson); // Reemplazo del placeholder
  return prompt;
};

// Función para leer los archivos y generar el prompt
export const readFiles = async (personData: any, daysData: any) => {
  const pathFilePrompt = path.join(__dirname, "prompt_v0.2_en.txt");

  // Leemos la plantilla
  const promptTemplate = await fs.readFile(pathFilePrompt, "utf-8");

  const DEFAULT_CATEGORIES = ['PECHO', 'ESPALDA'];
  const userCategories: string[] = Array.isArray(personData.grupo_muscular_favorito) && personData.grupo_muscular_favorito.length > 0
    ? personData.grupo_muscular_favorito
    : DEFAULT_CATEGORIES;

  const favoriteSet = new Set<string>(userCategories);

  // Traer todos los ejercicios de todas las categorías
  const [exerciseRowsRaw] = await pool.execute(
    "SELECT id, category, exercise, description, video_url, thumbnail_url, muscle_group FROM exercises ORDER BY category ASC, exercise ASC"
  );

  const allExerciseRows = exerciseRowsRaw as Array<{
    id: number;
    category: string;
    exercise: string;
    description: string;
    video_url: string | null;
    thumbnail_url: string | null;
    muscle_group: string;
  }>;

  // Favoritos: todos. No favoritos: máx 3 por categoría (para no agrandar el prompt)
  const nonFavCount: Record<string, number> = {};
  const exerciseRows = allExerciseRows.filter(row => {
    if (favoriteSet.has(row.category)) return true;
    nonFavCount[row.category] = (nonFavCount[row.category] || 0) + 1;
    return nonFavCount[row.category] <= 3;
  });

  // Formateamos los ejercicios como CSV (id incluido para que la IA lo use)
  let ejerciciosCsv = "ID;Categoria;Ejercicio;Descripción;Video_URL;Thumbnail_URL;Muscle_Group\n";
  exerciseRows.forEach((row) => {
    const desc = row.description.replace(/"/g, '""').replace(/\n/g, ' ');
    const videoUrl = row.video_url ?? '';
    const thumbnailUrl = row.thumbnail_url ?? '';
    const muscleGroup = row.muscle_group ?? '';
    ejerciciosCsv += `${row.id};${row.category};${row.exercise};"${desc}";${videoUrl};${thumbnailUrl};${muscleGroup}\n`;
  });

  // Consultamos la tabla de referencia de entrenamiento
  const [volumenRowsRaw] = await pool.execute(
    "SELECT grupo_muscular, mv, mev, mav, mrv, frecuencia, repeticiones, rir FROM volumen_entrenamiento"
  );

  const volumenRows = volumenRowsRaw as Array<{
    grupo_muscular: string;
    mv: string;
    mev: string;
    mav: string;
    mrv: string;
    frecuencia: string;
    repeticiones: string;
    rir: string;
  }>;

  const volumenJson = JSON.stringify(volumenRows);

  // Sanitizar campos críticos antes de enviar a OpenAI
  if (!Array.isArray(personData.grupo_muscular_favorito) || personData.grupo_muscular_favorito.length === 0) {
    personData.grupo_muscular_favorito = DEFAULT_CATEGORIES;
  }
  if (!personData.train_experience) personData.train_experience = "beginner";
  if (!personData.training_days_per_week) personData.training_days_per_week = 3;
  if (!personData.gender) personData.gender = "male";
  if (!personData.weight_kg) personData.weight_kg = 70;
  if (!personData.height_cm) personData.height_cm = 170;
  if (!personData.activity_level) personData.activity_level = "moderate";
  if (!personData.primary_goal) personData.primary_goal = "gainMuscle";

  // Generamos el prompt final con todos los datos
  const prompt = buildPront({
    promptTemplate,
    ejerciciosCsv,
    personData,
    daysData,
    volumenDataJson: volumenJson,
  });

  return prompt;
};