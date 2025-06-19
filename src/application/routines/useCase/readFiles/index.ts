const fs = require("fs").promises;
import path from "path";

export const buildPront = ({
  promptTemplate,
  ejerciciosCsv,
  personData,
}: any) => {
  let prompt = promptTemplate.replace("###EJERCICIOS###", ejerciciosCsv);
  prompt = prompt.replace("###DATOS_PERSONA###", JSON.stringify(personData));
  return prompt;
};

export const readFiles = async (personData: any) => {
  const pathFilePrompt = path.join(__dirname, "prompt_v0.2_en.txt");
  const pathFileejercicio = path.join(__dirname, "ejecicios.csv");

  const promptTemplate = await fs.readFile(pathFilePrompt, "utf-8");
  const ejerciciosCsv = await fs.readFile(pathFileejercicio, "utf-8");
  const prompt = buildPront({ promptTemplate, ejerciciosCsv, personData });
  return prompt;
};
