import { AccessToken, RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";
const LIVEKIT_URL = process.env.LIVEKIT_URL || "http://localhost:7880";

export class LiveKitService {
    private roomService: RoomServiceClient;

    constructor() {
        this.roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    }

    // 1. Generate Token for the Client
    async createToken(roomName: string, participantName: string, identity: string) {
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: identity,
            name: participantName,
        });

        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
        });

        return await at.toJwt();
    }

    // 2. Send "Intent" Signal to the Room
    async sendIntentSignal(roomName: string, intent: string, audioFilename: string) {
        const payload = JSON.stringify({
            type: "AGENT_RESPONSE",
            intent: intent,
            audioUrl: `http://localhost:3000/audio/${audioFilename}` // Client will fetch this
        });

        const encoder = new TextEncoder();
        const data = encoder.encode(payload);

        // Send to all participants in the room
        await this.roomService.sendData(
            roomName,
            data,
            DataPacket_Kind.RELIABLE, // Use RELIABLE for control signals
            [] // Empty array = broadcast to everyone
        );

        console.log(`📡 Sent LiveKit Signal to ${roomName}: ${intent}`);
    }
}

export const livekitService = new LiveKitService();
