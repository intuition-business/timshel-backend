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

  // Consultamos los ejercicios en la base de datos
  const [exerciseRowsRaw] = await pool.execute(
    "SELECT category, exercise, description, video_url, thumbnail_url, muscle_group FROM exercises ORDER BY category ASC, exercise ASC"
  );

  const exerciseRows = exerciseRowsRaw as Array<{
    category: string;
    exercise: string;
    description: string;
    video_url: string | null;
    thumbnail_url: string | null;
    muscle_group: string;
  }>;

  // Formateamos los ejercicios como CSV
  let ejerciciosCsv = "Categoria;Ejercicio;Descripción;Video_URL;Thumbnail_URL;Muscle_Group\n";
  exerciseRows.forEach((row) => {
    const desc = row.description.replace(/"/g, '""').replace(/\n/g, ' ');
    const videoUrl = row.video_url ?? '';
    const thumbnailUrl = row.thumbnail_url ?? '';
    const muscleGroup = row.muscle_group ?? '';
    ejerciciosCsv += `${row.category};${row.exercise};"${desc}";${videoUrl};${thumbnailUrl};${muscleGroup}\n`;
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