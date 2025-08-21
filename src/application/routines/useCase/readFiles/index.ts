const fs = require("fs").promises;
import path from "path";
import pool from "../../../../config/db";

// Función para construir el prompt
export const buildPront = ({
  promptTemplate,
  ejerciciosCsv,
  personData,
  daysData,
}: any) => {
  let prompt = promptTemplate.replace("###EJERCICIOS###", ejerciciosCsv);
  prompt = prompt.replace("###DATOS_PERSONA###", JSON.stringify(personData));
  prompt = prompt.replace("###DIAS###", JSON.stringify(daysData));
  return prompt;
};

// Función para leer los archivos y generar el prompt
export const readFiles = async (personData: any, daysData: any) => {
  const pathFilePrompt = path.join(__dirname, "prompt_v0.2_en.txt");

  // Leemos la plantilla
  const promptTemplate = await fs.readFile(pathFilePrompt, "utf-8");

  // En lugar de leer el CSV, consultamos la base de datos
  const [rows] = await pool.execute(
    "SELECT category, exercise, description FROM exercises ORDER BY category ASC, exercise ASC"
  );

  const exerciseRows = rows as Array<{
    category: string;
    exercise: string;
    description: string;
  }>;

  // Formateamos los datos como un string CSV similar al original
  let ejerciciosCsv = "Categoria;Ejercicio;Descripción\n"; // Encabezado
  exerciseRows.forEach((row) => {
    // Escapamos comillas y manejamos saltos de línea si es necesario
    const desc = row.description.replace(/"/g, '""').replace(/\n/g, ' ');
    ejerciciosCsv += `${row.category};${row.exercise};"${desc}"\n`;
  });

  // Generamos el prompt con los datos de la persona y los días
  const prompt = buildPront({ promptTemplate, ejerciciosCsv, personData, daysData });

  return prompt;
};