import OpenAI from "openai";
import { OPENAI_KEY } from "../../config";

const model = "gpt-4o-mini-2024-07-18";
const temperature = 0;
const response_format = "json_object";

export const openai = new OpenAI({
  apiKey: OPENAI_KEY,
});

export const getOpenAI = async (prompt: any) => {
  try {
    if (process.env.MOCK_OPENAI === "true") {
      const promptText = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
      const isoDateMatches = promptText.match(/\d{4}-\d{2}-\d{2}/g) || [];
      const uniqueDates = [...new Set(isoDateMatches)];
      const dayCount = Math.max(1, uniqueDates.length);

      const workouts = Array.from({ length: dayCount }).map((_, index) => ({
        nombre_dia: `Dia ${index + 1}`,
        ejercicios: [
          {
            exercise_name: `Ejercicio ${index + 1}`,
            description: "Generado en modo mock",
            series_completed: [
              { reps: 12, load: 0, breakTime: 60 }
            ]
          }
        ]
      }));

      return {
        response: {
          choices: [
            {
              message: {
                content: JSON.stringify({ training_plan: workouts })
              }
            }
          ]
        },
        error: undefined
      };
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature,
      response_format: { type: response_format }, // 'text' o 'json'
    });
    return { response, error: undefined };
  } catch (error) {
    return { response: undefined, error };
  }
};
