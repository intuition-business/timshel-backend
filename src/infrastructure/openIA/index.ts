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
