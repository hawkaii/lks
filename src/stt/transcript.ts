export interface TranscribeResponse {
    id: string;
    transcription: string;
    chunks: number;
}

export async function transcribeAudio(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://34.93.193.25:8000/transcribe", {
        method: "POST",
        headers: {
            "accept": "application/json",
        },
        body: formData,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`STT API failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as TranscribeResponse;
    return data.transcription;
}

