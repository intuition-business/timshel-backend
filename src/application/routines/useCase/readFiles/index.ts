const fs = require("fs").promises;
import path from "path";

// Función para construir el prompt
export const buildPront = ({
  promptTemplate,
  ejerciciosCsv,
  personData,
  daysData,  // Nuevo parámetro para incluir los días
}: any) => {
  let prompt = promptTemplate.replace("###EJERCICIOS###", ejerciciosCsv);
  prompt = prompt.replace("###DATOS_PERSONA###", JSON.stringify(personData));
  prompt = prompt.replace("###DIAS###", JSON.stringify(daysData));  // Reemplazo de los días seleccionados
  return prompt;
};

// Función para leer los archivos y generar el prompt
export const readFiles = async (personData: any, daysData: any) => {
  const pathFilePrompt = path.join(__dirname, "prompt_v0.2_en.txt");
  const pathFileejercicio = path.join(__dirname, "ejecicios.csv");

  // Leemos la plantilla y los ejercicios
  const promptTemplate = await fs.readFile(pathFilePrompt, "utf-8");
  const ejerciciosCsv = await fs.readFile(pathFileejercicio, "utf-8");

  // Generamos el prompt con los datos de la persona y los días
  const prompt = buildPront({ promptTemplate, ejerciciosCsv, personData, daysData });

  return prompt;
};
