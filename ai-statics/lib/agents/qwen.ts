import { createOpenAI } from "@ai-sdk/openai";

// DashScope exposes Qwen behind an OpenAI-compatible endpoint.
const dashscope = createOpenAI({
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.DASHSCOPE_API_KEY,
});

// "qwen-max" is a deprecated alias the compatible-mode endpoint now rejects;
// qwen3.7-max is the current flagship model.
export const qwen = dashscope("qwen3.7-max");
