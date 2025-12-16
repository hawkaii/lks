import { GenerativeModel, HarmBlockThreshold, HarmCategory, VertexAI } from "@google-cloud/vertexai";

const vertexAI = new VertexAI({
    project: "cabswale-ai",
    location: "asia-south1",
});


export enum MODELS {
    FLASH = "gemini-2.5-flash",
    FLASHLITE = "gemini-2.5-flash-lite"
}

export const getModel = (modelName: MODELS, maxOutTokens: number): GenerativeModel => {
    const model = vertexAI.getGenerativeModel({
        model: modelName,
        safetySettings: [{
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        }],
        generationConfig: { maxOutputTokens: maxOutTokens },
    });

    return model;
}
