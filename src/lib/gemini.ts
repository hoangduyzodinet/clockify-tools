import { GoogleGenerativeAI } from '@google/generative-ai';
import { CommitItem } from '@/types/commit';
import { SYSTEM_PROMPT, buildInput, parseOutput } from '@/lib/ai-titles';

export async function generateTaskTitlesGemini({
  apiKey,
  model,
  commits,
}: {
  apiKey: string;
  model: string;
  commits: CommitItem[];
}) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  const result = await geminiModel.generateContent(buildInput(commits));
  return parseOutput(result.response.text() ?? '{}', commits);
}
