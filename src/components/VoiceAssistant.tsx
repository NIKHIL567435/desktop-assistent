import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Play, Trash2, Send, Database, Sliders, Volume2, ShieldAlert, Cpu, Sparkles, X, Check } from "lucide-react";
import { Command, LogEntry, VoiceSettings } from "../types";
import { AudioVisualizer } from "./AudioVisualizer";
import { motion, AnimatePresence } from "motion/react";

interface VoiceAssistantProps {
  settings: VoiceSettings;
  setSettings: React.Dispatch<React.SetStateAction<VoiceSettings>>;
  onAction?: (actionType: Command["actionType"]) => string | void;
  onVoiceCommand?: (query: string) => string | null;
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  writeSystemLog: (
    message: string,
    type: "info" | "success" | "warning" | "error" | "input" | "output",
    source: "system" | "voice-in" | "voice-out" | "engine" | "automation"
  ) => void;
}

const PREDEFINED_COMMANDS: Command[] = [
  { id: "1", phrase: "hello", description: "Standard welcome greeting", category: "core", actionType: "text", response: "Hello there! I am VoicePilot, your offline-first desktop assistant. How can I assist you today?" },
  { id: "2", phrase: "what time is it", description: "Flares local clock reading", category: "core", actionType: "time", response: "" },
  { id: "3", phrase: "what date is today", description: "Translates local date structures", category: "core", actionType: "date", response: "" },
  { id: "4", phrase: "stop listening", description: "Terminates the mic recognizer", category: "system", actionType: "stop", response: "Deactivating transcription listener. Press Push-to-Talk to speak again." },
  { id: "5", phrase: "exit assistant", description: "Enforces virtual app termination", category: "system", actionType: "exit", response: "Shutting down VoicePilot. Goodbye!" },
  { id: "6", phrase: "volume up", description: "Increases OS speaker level by 10%", category: "automation", actionType: "volume_up", response: "" },
  { id: "7", phrase: "volume down", description: "Decreases OS speaker level by 10%", category: "automation", actionType: "volume_down", response: "" },
  { id: "8", phrase: "mute volume", description: "Toggles OS speaker mute state", category: "automation", actionType: "volume_mute", response: "" },
  { id: "9", phrase: "open browser", description: "Launches virtual web browser frame", category: "automation", actionType: "app_browser", response: "" },
  { id: "10", phrase: "open downloads", description: "Launches virtual downloads file explorer", category: "automation", actionType: "app_folder", response: "" },
  { id: "11", phrase: "system shutdown", description: "Initiates OS system shutdown countdown", category: "system", actionType: "shutdown", response: "" },
  { id: "12", phrase: "abort shutdown", description: "Aborts active OS shutdown sequence", category: "system", actionType: "abort", response: "" },
  { id: "13", phrase: "cpu usage", description: "Reads current CPU thread loads", category: "system", actionType: "cpu_usage", response: "" },
  { id: "14", phrase: "memory usage", description: "Reads active physical memory loads", category: "system", actionType: "memory_usage", response: "" },
  { id: "15", phrase: "battery status", description: "Inspects power and battery state", category: "system", actionType: "battery_status", response: "" },
  { id: "16", phrase: "disk space", description: "Inspects remaining physical drive space", category: "system", actionType: "disk_space", response: "" }
];

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  settings,
  setSettings,
  onAction,
  onVoiceCommand,
  logs,
  setLogs,
  writeSystemLog,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [textQuery, setTextQuery] = useState<string>("");
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micStatusText, setMicStatusText] = useState<string>("● STANDBY");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [micPermissionState, setMicPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [showSimulatedMic, setShowSimulatedMic] = useState<boolean>(false);
  const [simulatedText, setSimulatedText] = useState<string>("");

  const recognitionRef = useRef<any | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Initialize SpeechSynthesis Voices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        // Find default or first english voice
        if (voices.length > 0 && !settings.voiceURI) {
          const defaultVoice = voices.find(v => v.lang.startsWith("en")) || voices[0];
          setSettings(prev => ({ ...prev, voiceURI: defaultVoice.voiceURI }));
        }
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Load V1 Initial logs
    writeSystemLog("VoicePilot subsystem initialized in offline container.", "info", "system");
    writeSystemLog("Local SQLite local database loaded: voicepilot.db (2 schemas loaded).", "success", "system");
    writeSystemLog("Vosk local voice model ready: vosk-model-small-en-us-0.15.", "success", "engine");
  }, []);

  // Sync scroll to bottom for logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle Speech Recognition setup
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startSpeechRecognition = async () => {
    if (!SpeechRecognition) {
      writeSystemLog("Speech Recognition API not supported in this browser sandbox. Activating interactive voice simulator.", "warning", "engine");
      setMicPermissionState("denied");
      setShowSimulatedMic(true);
      return;
    }

    try {
      // Trigger browser mic permissions prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
        throw new Error("blocked");
      });
      setMicStream(stream);
      setMicPermissionState("granted");

      const recognition = new SpeechRecognition();
      recognition.continuous = false; // PTT is single capture
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setMicStatusText("● LISTENING");
        setVolumeLevel(0.35); // simulated active sound floor
        writeSystemLog("PTT activated. Capturing local audio buffers...", "info", "voice-in");
      };

      recognition.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e);
        writeSystemLog(`Audio Capture error: ${e.error || "unspecified"}`, "error", "voice-in");
        if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "permission-denied") {
          setMicPermissionState("denied");
          setShowSimulatedMic(true);
        }
        stopSpeechRecognition();
      };

      recognition.onend = () => {
        setIsListening(false);
        setMicStatusText("● STANDBY");
        setVolumeLevel(0);
        // Stop stream tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setMicStream(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          writeSystemLog(`Decoded offline Speech Chunk: "${transcript}"`, "input", "voice-in");
          processEngineCommand(transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err: any) {
      console.error("Could not obtain mic permission:", err);
      setMicPermissionState("denied");
      setShowSimulatedMic(true);
      writeSystemLog("Microphone hardware blocked inside iframe. Loading seamless interactive voice control.", "warning", "voice-in");
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setMicStatusText("● STANDBY");
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }
    setMicStream(null);
    setVolumeLevel(0);
  };

  const handlePTTToggle = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      // Cancel active speaking syntheses before listening to avoid echo loops
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      
      if (micPermissionState === "denied" || !SpeechRecognition) {
        setShowSimulatedMic(true);
        return;
      }
      
      startSpeechRecognition();
    }
  };

  // Speaks out the voice responses locally in client synthesis
  const speakResponse = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel(); // Stop anything playing
      
      const utterance = new SpeechSynthesisUtterance(text);
      if (settings.voiceURI) {
        const selectedVoice = availableVoices.find(v => v.voiceURI === settings.voiceURI);
        if (selectedVoice) utterance.voice = selectedVoice;
      }
      utterance.rate = settings.rate / 175; // Normalize relative to standard speaking rate
      utterance.volume = settings.volume;
      utterance.pitch = settings.pitch;

      utterance.onstart = () => {
        setIsSpeaking(true);
        writeSystemLog(`Executing TTS synthesize loop`, "info", "voice-out");
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = (e) => {
        console.error("speechSynthesis error", e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      writeSystemLog("Text-To-Speech is not fully supported in this browser.", "warning", "voice-out");
    }
  };

  // Core Command matching Engine router (replicates core/engine.py in SQLite terms)
  const processEngineCommand = (query: string) => {
    const cleaned = query.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // SQLite query logging mock
    writeSystemLog("Running SQLite script: 'INSERT INTO command_history (transcript) VALUES (...)'", "info", "system");

    // Dynamic Productivity voice intercept
    if (onVoiceCommand) {
      const response = onVoiceCommand(query);
      if (response) {
        writeSystemLog(`Matched Productivity Pattern: "${cleaned}"`, "success", "engine");
        writeSystemLog(`[Replying] ${response}`, "output", "voice-out");
        speakResponse(response);
        return;
      }
    }

    // Exact matching logic
    const matched = PREDEFINED_COMMANDS.find(cmd => cleaned === cmd.phrase);

    if (matched) {
      executeMatchedAction(matched);
    } else {
      // Partial phrasing fallback keyword check (e.g. "could you say hello")
      const kwMatch = PREDEFINED_COMMANDS.find(cmd => cleaned.includes(cmd.phrase));
      if (kwMatch) {
         writeSystemLog(`Keyword sub-match found for target: "${kwMatch.phrase}"`, "success", "engine");
         executeMatchedAction(kwMatch);
      } else {
        // Unknown command
        const errReply = `Command not recognized: "${query}". Try speaking phrases like 'hello' or 'what time is it'.`;
        writeSystemLog(`Matching engine returned 0 results. Threshold unmatched.`, "warning", "engine");
        writeSystemLog(`[Replying] ${errReply}`, "output", "voice-out");
        
        // SQLite logging
        writeSystemLog("SQLite transactional state updated for unhandled intent.", "info", "system");
        
        speakResponse("I did not recognize the spoken command. Please review the manual cheat sheet.");
      }
    }
  };

  // Execution subroutines mapping to target actionType
  const executeMatchedAction = (cmd: Command) => {
    let resolvedText = cmd.response;

    if (cmd.actionType === "time") {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      resolvedText = `The current system time is ${timeStr}.`;
    } else if (cmd.actionType === "date") {
      const today = new Date();
      const dateStr = today.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      resolvedText = `Today's date is ${dateStr}.`;
    } else if (cmd.actionType === "stop") {
      stopSpeechRecognition();
    } else if (cmd.actionType === "exit") {
      stopSpeechRecognition();
      writeSystemLog("Received local application termination code. Shutting down hooks...", "warning", "system");
    }

    if (onAction) {
      const customDescription = onAction(cmd.actionType);
      if (customDescription) {
        resolvedText = customDescription;
      }
    }

    const logSource = cmd.category === "automation" ? "automation" : "engine";
    writeSystemLog(`Parsed command structure: Match type "${cmd.phrase.toUpperCase()}"`, "success", logSource);
    writeSystemLog(`[Replying] ${resolvedText}`, "output", "voice-out");
    speakResponse(resolvedText);
  };

  // Helper routine triggered for interactive speech synthesis simulation
  const triggerSimulatedSpeech = (text: string) => {
    if (!text.trim()) return;
    setShowSimulatedMic(false);
    
    // Animate a realistic 1.2 second speech-capture transition
    setIsListening(true);
    setMicStatusText("● TRANSCRIBING");
    writeSystemLog(`Virtual Audio Input Triggering: "${text}"`, "info", "voice-in");
    
    // Simulate active capture volume levels to get wave movement
    let count = 0;
    let timerId = setInterval(() => {
      setVolumeLevel(0.35 + Math.random() * 0.45);
      count++;
      if (count > 10) {
        clearInterval(timerId);
      }
    }, 100);

    setTimeout(() => {
      setIsListening(false);
      setVolumeLevel(0);
      setMicStatusText("● STANDBY");
      
      writeSystemLog(`Offline Decoded Transcribed String: "${text}"`, "input", "voice-in");
      processEngineCommand(text);
    }, 1100);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textQuery.trim()) return;
    
    writeSystemLog(`Keyboard Console Input: "${textQuery}"`, "input", "system");
    processEngineCommand(textQuery);
    setTextQuery("");
  };

  const clearLogs = () => {
    setLogs([]);
    writeSystemLog("SQLite Log buffer cleared.", "info", "system");
  };

  return (
    <div id="voice-assistant" className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[560px]">
      
      {/* Left Column: Recording Controls, Wave, Cheat Sheet (Col 5) */}
      <div className="lg:col-span-5 flex flex-col bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-y-auto scrollbar-thin relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">
            <Cpu className="w-4 h-4 text-emerald-400" />
            V1 Hardware Console
          </div>
          <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
            isListening ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800 animate-pulse" : "bg-slate-900 border border-slate-800 text-slate-400"
          }`}>
            {micStatusText}
          </div>
        </div>

        {/* Simulated Vocal Overlay */}
        <AnimatePresence>
          {showSimulatedMic && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-20 bg-slate-950/98 backdrop-blur-md p-4 flex flex-col justify-between border border-slate-800 rounded-lg"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold font-mono tracking-wider text-slate-200 uppercase">
                    Interactive Voiceless Assist
                  </span>
                </div>
                <button
                  onClick={() => setShowSimulatedMic(false)}
                  className="p-1 hover:bg-slate-900 text-slate-500 hover:text-slate-200 rounded transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center text-center py-4 flex-1">
                <div className="w-11 h-11 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mb-3 animate-pulse">
                  <Mic className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed max-w-[240px]">
                  Speak silently or query your pilot. Type anything or click any preset to emulate speech capture:
                </p>
                
                {/* Instant voice triggers */}
                <div className="flex flex-wrap gap-1.5 justify-center mt-3 max-h-[140px] overflow-y-auto p-1 border border-slate-900 bg-slate-900/20 rounded">
                  {PREDEFINED_COMMANDS.slice(0, 8).map(cmd => (
                    <button
                      key={cmd.phrase}
                      onClick={() => {
                        setSimulatedText(cmd.phrase);
                        triggerSimulatedSpeech(cmd.phrase);
                      }}
                      className="text-[10px] bg-[#0c101a] hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800/80 px-2 py-1 rounded text-slate-400 font-mono transition cursor-pointer"
                    >
                      "{cmd.phrase}"
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Enter vocal phrase string..."
                    value={simulatedText}
                    onChange={(e) => setSimulatedText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        triggerSimulatedSpeech(simulatedText);
                        setSimulatedText("");
                      }
                    }}
                    className="flex-1 text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-650 px-2.5 py-2 rounded focus:outline-none focus:border-emerald-500 font-mono"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      triggerSimulatedSpeech(simulatedText);
                      setSimulatedText("");
                    }}
                    className="bg-emerald-900 border border-emerald-700 hover:bg-emerald-850 px-3.5 py-1.5 rounded text-emerald-100 font-sans font-bold text-xs transition"
                  >
                    Speak
                  </button>
                </div>
                <div className="text-[9px] text-slate-500 text-center mt-2 font-mono">
                  Translates input buffer directly into PyQt pipeline triggers.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waves view */}
        <AudioVisualizer 
          isActive={isListening} 
          volume={volumeLevel} 
          isSpeaking={isSpeaking}
          stream={micStream}
        />

        {/* PTT Circular Buttons */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-3">
          <div className="relative">
            {/* Pulsing visual halo boundary */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-emerald-500/20"
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {isSpeaking && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-blue-500/25"
                />
              )}
            </AnimatePresence>

            <button
              onClick={handlePTTToggle}
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl border-4 ${
                isListening
                  ? "bg-emerald-900/60 border-emerald-400 text-emerald-200 hover:bg-emerald-950"
                  : isSpeaking
                  ? "bg-blue-900/60 border-blue-400 text-blue-100"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-500"
              }`}
            >
              {isListening ? (
                <Mic className="w-10 h-10 text-emerald-400 animate-bounce" />
              ) : (
                <MicOff className="w-10 h-10 text-slate-400" />
              )}
              <span className="text-[10px] font-mono mt-1 font-bold tracking-wider uppercase">
                {isListening ? "Listening..." : "Push to talk"}
              </span>
            </button>
          </div>

          <p className="text-[10px] font-mono text-slate-500 max-w-[200px] text-center mt-2 font-medium">
            Deploy local weights offline. Web Speech translation triggers matching modules.
          </p>
        </div>

        {/* Commands cheat sheet */}
        <div className="mt-auto bg-slate-900/40 border border-[#161c2c] rounded p-3 shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1 font-mono mb-2">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            Local Speech Cheat Sheet
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-0.5">
            {PREDEFINED_COMMANDS.map(cmd => (
              <button
                key={cmd.id}
                onClick={() => {
                  writeSystemLog(`Emulated Command: Clicked "${cmd.phrase}"`, "input", "system");
                  processEngineCommand(cmd.phrase);
                }}
                className="text-[10px] font-mono font-medium px-2 py-1 rounded bg-[#0f1420] border border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-emerald-300 cursor-pointer transition whitespace-nowrap"
              >
                {cmd.phrase}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Right Column: Transaction Logs Console & Manual Keying (Col 7) */}
      <div className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-hidden">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">
            <Database className="w-4 h-4 text-emerald-400" />
            Sqlite Command Transaction Logs
          </div>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1 text-[10px] font-semibold font-sans px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition"
            title="Clear history DB cache"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear logs
          </button>
        </div>

        {/* Display logs */}
        <div className="flex-1 overflow-y-auto mb-3 space-y-2 pr-1 font-mono text-[11px]" ref={scrollRef}>
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 italic">
              No database log events cached in SQLite stack.
            </div>
          ) : (
            logs.map((log) => {
              let tagColor = "bg-slate-900 text-slate-400 border-slate-800";
              let msgColor = "text-slate-300";

              if (log.type === "success") {
                tagColor = "bg-emerald-950/40 text-emerald-400 border-emerald-900";
              } else if (log.type === "error") {
                tagColor = "bg-rose-950/40 text-rose-400 border-rose-900";
                msgColor = "text-rose-300";
              } else if (log.type === "warning") {
                tagColor = "bg-amber-950/40 text-amber-400 border-amber-900";
              } else if (log.type === "input") {
                tagColor = "bg-purple-950/40 text-purple-400 border-purple-900 font-bold";
                msgColor = "text-purple-300 font-medium";
              } else if (log.type === "output") {
                tagColor = "bg-blue-950/40 text-blue-400 border-blue-900 font-bold";
                msgColor = "text-emerald-400 font-semibold";
              }

              return (
                <div key={log.id} className="flex gap-2.5 items-start px-2 py-1.5 hover:bg-slate-900/30 rounded border border-transparent hover:border-slate-850 transition">
                  <span className="text-slate-600 shrink-0 select-none">{log.timestamp}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 border select-none ${tagColor}`}>
                    {log.source}:{log.type}
                  </span>
                  <span className={`flex-1 break-all ${msgColor}`}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Manual typing console prompt */}
        <form onSubmit={handleTextSubmit} className="flex gap-2 border-t border-slate-800 pt-3 shrink-0">
          <input
            type="text"
            placeholder="Type terminal command query..."
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            className="flex-1 bg-[#090d16] border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-300 placeholder-slate-650 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 px-4 py-2 hover:border-emerald-600 transition flex items-center justify-center rounded cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
          </button>
        </form>

      </div>

    </div>
  );
};
