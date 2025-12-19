import { TextToSpeechClient } from "@google-cloud/text-to-speech";

const client = new TextToSpeechClient();

export const generateAudio = async (text: string): Promise<string> => {
    const request = {
        input: { text: text },
        voice: { languageCode: 'hi-IN', ssmlGender: 'NEUTRAL' as const },
        audioConfig: { audioEncoding: 'MP3' as const },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);

        if (!response.audioContent) {
            throw new Error("No audio content received");
        }

        const filename = `response_${Date.now()}.mp3`;
        const filepath = `src/audio/${filename}`;

        await Bun.write(filepath, response.audioContent);

        return filename;
    } catch (error) {
        console.error("TTS Error:", error);
        return "general.mp3";
    }
}
