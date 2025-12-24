import { GoogleGenAI, Type } from "@google/genai";

// Fix: Initialize GoogleGenAI strictly using process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const improveCode = async (code: string, instruction: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Improve or modify the following HTML/CSS code based on this instruction: "${instruction}". 
      Return ONLY the complete modified code. No explanations.
      
      Code:
      ${code}`,
      config: {
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const analyzeCodeForIssues = async (code: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this HTML/CSS/JS code for potential issues, bugs, or performance improvements. 
        Return the response in a structured JSON format.
        
        Code:
        ${code}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                severity: { type: Type.STRING, description: "info, warning, or error" },
                message: { type: Type.STRING },
                suggestion: { type: Type.STRING }
              },
              required: ["severity", "message"]
            }
          }
        },
      });
  
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Analysis Error:", error);
      return [];
    }
  };