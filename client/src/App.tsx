import { useEffect, useState, useRef } from "react";
import { Room, RoomEvent } from "livekit-client";
import { FaMicrophone, FaStop } from "react-icons/fa";
import "./App.css";

// Configuration
const SERVER_URL = "http://localhost:3000"; // Your Bun Server
const LIVEKIT_URL = "ws://localhost:7880";  // Your LiveKit Server

export default function App() {
    const [room, setRoom] = useState<Room | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState("Disconnected");

    // User Info (Hardcoded for now, mimicking your curl test)
    const user = { name: "Ajay", phone: "9876543210" };

    // Refs for Audio Handling
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioPlayerRef = useRef<HTMLAudioElement>(new Audio());

    // 1. Connect to LiveKit on Mount
    useEffect(() => {
        const connectToRoom = async () => {
            try {
                setStatus("Fetching Token...");
                // A. Get Token from your Backend
                const resp = await fetch(`${SERVER_URL}/token?name=${user.name}&phone=${user.phone}`);
                const { token } = await resp.json();

                setStatus("Connecting to LiveKit...");
                // B. Connect to Room
                const newRoom = new Room();

                // C. Setup Event Listeners (THE MAGIC PART)
                newRoom.on(RoomEvent.DataReceived, (payload, _participant, _kind) => {
                    const decoder = new TextDecoder();
                    const strData = decoder.decode(payload);
                    const data = JSON.parse(strData);

                    console.log("⚡ Received Signal:", data);

                    if (data.type === "AGENT_RESPONSE" && data.audioUrl) {
                        setStatus(`Agent Intent: ${data.intent}`);
                        playAudioResponse(data.audioUrl);
                    }
                });

                await newRoom.connect(LIVEKIT_URL, token);
                setRoom(newRoom);
                setIsConnected(true);
                setStatus("Ready. Press Mic to Speak.");

            } catch (err: any) {
                console.error("LiveKit Connection Error:", err);
                console.error("Error details:", {
                    message: err.message,
                    name: err.name,
                    stack: err.stack
                });
                setStatus(`Connection Failed: ${err.message || 'Unknown error'}`);
            }
        };

        connectToRoom();

        // Cleanup
        return () => {
            room?.disconnect();
        };
    }, []);


    // 2. Play Audio Helper
    const playAudioResponse = (url: string) => {
        // Append timestamp to prevent caching if needed
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play().catch(e => console.error("Playback failed", e));
    };


    // 3. Start Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = uploadAudio;
            mediaRecorder.start();
            setIsRecording(true);
            setStatus("Listening...");
        } catch (err) {
            console.error("Mic Error:", err);
        }
    };


    // 4. Stop Recording & Upload
    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setStatus("Processing...");
    };

    const uploadAudio = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const formData = new FormData();
        formData.append("file", audioBlob, "input.mp3");
        formData.append("name", user.name);
        formData.append("phone", user.phone);
        formData.append("id", user.phone); // Using phone as unique ID

        try {
            // Send to your backend
            const response = await fetch(`${SERVER_URL}/transcribe`, {
                method: "POST",
                body: formData,
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Transcription error:", errorData);
                setStatus(`Error: ${errorData.error || 'Unknown error'}`);
                return;
            }
            
            const result = await response.json();
            console.log("Transcription success:", result);
            // The Server will send a LiveKit signal when it's done.
        } catch (err: any) {
            console.error("Upload failed:", err);
            setStatus(`Error sending audio: ${err.message}`);
        }
    };

    return (
        <div className="container">
            <h1>Cabswale AI Agent</h1>
            <div className="status-bar">
                <span className={`dot ${isConnected ? "green" : "red"}`}></span>
                {status}
            </div>

            <div className="controls">
                {!isRecording ? (
                    <button className="mic-btn" onClick={startRecording} disabled={!isConnected}>
                        <FaMicrophone size={30} />
                    </button>
                ) : (
                    <button className="mic-btn recording" onClick={stopRecording}>
                        <FaStop size={30} />
                    </button>
                )}
            </div>

            <div className="debug-info">
                <p>User: {user.name} ({user.phone})</p>
            </div>
        </div>
    );
}
