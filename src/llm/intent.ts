import { HarmBlockThreshold, HarmCategory, SchemaType, type GenerateContentRequest } from "@google-cloud/vertexai";
import type { TripState } from "./types";
import { getModel, MODELS } from "./vertex-ai";



export const getPrompt = (
    todayDate: string,
    userTranscript: string,
    currentTripState: TripState
) => {
    return `
TODAY_DATE: ${todayDate}

ROLE:
You are a deterministic intent classifier for a cab / trip booking assistant.
You operate as a finite-state machine, not a conversational agent.

TASK:
Analyze the user's latest message and decide the NEXT intent
based on the current trip state and strict conversation flow.

STRICT RULES:
- Choose EXACTLY ONE intent.
- Do NOT explain reasoning.
- Do NOT invent missing information.
- Do NOT output values outside the defined enums.
- Only trip-related intents are supported.

====================
ALLOWED ENUMS
====================

INTENT:
- greet
- ask_source
- ask_destination
- ask_trip_type
- ask_date
- ask_preferences (if we have even one preference do not set intent as ASK_PREFERENCES)
- general
- unknown

TRIP_TYPE:
- one_way
- round_trip
- not_decided

VEHICLE_TYPE:
- suv
- sedan
- hatchback
- none

LANGUAGE:
- en (English)
- hi (Hindi)
- bn (Bengali)
- ta (Tamil)
- te (Telugu)
- mr (Marathi)
- gu (Gujarati)
- kn (Kannada)
- ml (Malayalam)
- pa (Punjabi)
- or (Odia)
- as (Assamese)
- ur (Urdu)
- none

# IMPORTANT:
- If the user has not specified a value, treat it as undefined.
- NEVER infer enum values unless the user explicitly mentions them.
- If the user says “any”, map it to NONE / XX where applicable.

====================
FLOW LOGIC (STRICT)
====================

1. Greeting:
   - If the message is a greeting → GREET

2. Core trip details (MANDATORY):
   - If source is missing → ASK_SOURCE
   - If destination is missing → ASK_DESTINATION
   - If tripType is missing or is "not_decided" → ASK_TRIP_TYPE
   - If tripStartDate is missing → ASK_DATE

3. Preferences (OPTIONAL):
   - If all core trip details exist
   - If any one preference exist set preference as ASK_PREFERENCES, else
   - AND preferences.vehicleType or preferences.language is missing
   - AND the user is not asking a general question
   → ASK_PREFERENCES

4. General trip queries:
   - If all mandatory details exist and the user asks about
     price, availability, timing, confirmation, etc. → GENERAL

5. Non-trip messages:
   - If the message is unrelated to trips → UNKNOWN

====================
DEFINITIONS
====================

- Source: starting location of the trip (convert the city/place name in english)
- Destination: ending location of the trip (convert the city/place name in english)
- Trip Type: one_way or round_trip
- tripStartDate: start date-time of trip (dd/mm/yyyy hh:mm AM/PM)
  Example: 12/11/2026 12:26 PM
- tripEndDate:
  - For one_way: tripStartDate + 12 hours
  - For round_trip: explicitly provided by user
- Preferences:
  - vehicleType
  - language

====================
CURRENT TRIP STATE (JSON)
====================
${JSON.stringify(currentTripState, null, 2)}

====================
USER MESSAGE
====================
"${userTranscript}"

====================
OUTPUT FORMAT (JSON ONLY)
====================
`;
};

export const getTripStatusWithIntent = async (userTranscript: string, tripState: TripState) => {
    console.log('calling with userTranscript')

    const currentDate = new Date();

    const indianTime = currentDate.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata"
    });

    const prompt = getPrompt(indianTime, userTranscript, tripState);
    const model = getModel(MODELS.FLASH, 1024);

    const request: GenerateContentRequest = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        safetySettings: [{
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        }],
        generationConfig: {
            temperature: 0.0,
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    intent: { type: SchemaType.STRING },
                    source: { type: SchemaType.STRING },
                    destination: { type: SchemaType.STRING },
                    tripStartDate: { type: SchemaType.STRING },
                    tripEndDate: { type: SchemaType.STRING },
                    tripType: { type: SchemaType.STRING },
                    preferences: {
                        type: SchemaType.OBJECT,
                        properties: {
                            vehicleType: { type: SchemaType.STRING },
                            language: { type: SchemaType.STRING },
                        },
                        required: ["vehicleType", "language"]
                    }
                },
                required: ["intent", "source", "destination", "tripStartDate", "tripEndDate", "tripType", "preferences"]
            }
        }
    }

    model.generateContent(request)
    const result = await model.generateContentStream(request);
    const res = [];

    if (result.stream) {
        for await (const item of result.stream) {
            if (item.candidates && item.candidates[0]?.content.parts[0]) {
                res.push(item.candidates[0].content.parts[0].text);
            }
            else {
                break;
            }
        }
        return res.join("");
    } else {
        return null;
    }
}
