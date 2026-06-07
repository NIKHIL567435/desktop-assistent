import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Play, 
  Trash2, 
  Send, 
  Database, 
  Sliders, 
  Volume2, 
  ShieldAlert, 
  Cpu, 
  Sparkles, 
  X, 
  Check, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  ListTodo, 
  Sparkle,
  Trash,
  Settings,
  Circle
} from "lucide-react";
import { Command, LogEntry, VoiceSettings, Task, Reminder, CalendarEvent } from "../types";
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
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}

const PREDEFINED_COMMANDS: Command[] = [
  { id: "1", phrase: "hello", description: "Standard welcome greeting", category: "core", actionType: "text", response: "Hello there! I am VoicePilot, your offline-first desktop assistant. How can I assist you today?" },
  { id: "2", phrase: "what time is it", description: "Flares local clock reading", category: "core", actionType: "time", response: "" },
  { id: "3", phrase: "what date is today", description: "Translates local date structures", category: "core", actionType: "date", response: "" },
  { id: "4", phrase: "stop listening", description: "Terminates the mic recognizer", category: "system", actionType: "stop", response: "Deactivating transcription listener. Press Push-to-Talk to speak again." },
  { id: "6", phrase: "volume up", description: "Increases OS speaker level by 10%", category: "automation", actionType: "volume_up", response: "" },
  { id: "7", phrase: "volume down", description: "Decreases OS speaker level by 10%", category: "automation", actionType: "volume_down", response: "" },
  { id: "8", phrase: "mute volume", description: "Toggles OS speaker mute state", category: "automation", actionType: "volume_mute", response: "" },
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
  tasks,
  setTasks,
  reminders,
  setReminders,
  events,
  setEvents
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [textQuery, setTextQuery] = useState<string>( "");
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micStatusText, setMicStatusText] = useState<string>("● STANDBY");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [micPermissionState, setMicPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [showSimulatedMic, setShowSimulatedMic] = useState<boolean>(false);
  const [simulatedText, setSimulatedText] = useState<string>("");
  const [activeLedgerTab, setActiveLedgerTab] = useState<"tasks" | "calendar" | "reminders" | "logs">("tasks");
  const [showQuickSettings, setShowQuickSettings] = useState<boolean>(false);

  const recognitionRef = useRef<any | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Initialize SpeechSynthesis Voices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
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
  }, []);

  // Sync scroll to bottom for logs list
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, activeLedgerTab]);

  // Handle Speech Recognition setup
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startSpeechRecognition = async () => {
    if (!SpeechRecognition) {
      writeSystemLog("Speech Recognition API not supported in this browser sandbox. Activating interactive voice simulator.", "warning", "engine");
      setMicPermissionState("denied");
      setShowSimulatedMic(true);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicPermissionState("denied");
      setShowSimulatedMic(true);
      writeSystemLog("Microphone API is not available in the current browser sandbox. Activating interactive voice simulator.", "warning", "voice-in");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setMicPermissionState("denied");
      setShowSimulatedMic(true);
      writeSystemLog("Microphone hardware blocked or denied in iframe context. Activating high-fidelity simulation console.", "warning", "voice-in");
      return;
    }

    try {
      setMicStream(stream);
      setMicPermissionState("granted");

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setMicStatusText("● RECORDING");
        writeSystemLog("Local voice recognition thread listening on default Mic node...", "info", "voice-in");
      };

      recognition.onerror = (e: any) => {
        // Log locally to keep system logs healthy, using console.warn instead of error
        console.warn("Speech recognition status:", e.error || e);
        writeSystemLog(`Audio capture update: ${e.error || "released"}`, "info", "voice-in");
        if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "permission-denied") {
          setMicPermissionState("denied");
          setShowSimulatedMic(true);
        }
        stopSpeechRecognition();
      };

      recognition.onend = () => {
        setIsListening(false);
        setMicStatusText("● STANDBY");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        writeSystemLog(`Offline Decoded Transcribed String: "${transcript}"`, "input", "voice-in");
        processEngineCommand(transcript);
      };

      recognition.start();
    } catch (innerErr) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setMicPermissionState("denied");
      setShowSimulatedMic(true);
      writeSystemLog("Unable to bind physical stream context. Loading interactive simulator.", "warning", "voice-in");
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
    setIsListening(false);
    setMicStatusText("● STANDBY");
  };

  const handlePTTToggle = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
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

  // Speaks out spoken responses
  const speakResponse = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (settings.voiceURI) {
        const selectedVoice = availableVoices.find(v => v.voiceURI === settings.voiceURI);
        if (selectedVoice) utterance.voice = selectedVoice;
      }
      utterance.rate = settings.rate / 175;
      utterance.volume = settings.volume;
      utterance.pitch = settings.pitch;

      utterance.onstart = () => {
        setIsSpeaking(true);
        writeSystemLog(`Executing TTS synthesize loop`, "info", "voice-out");
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      writeSystemLog("Text-To-Speech is not fully supported in this browser.", "warning", "voice-out");
    }
  };

  // Core Command matching Engine router
  const processEngineCommand = (query: string) => {
    const cleaned = query.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    writeSystemLog(`Parsing vocal intent: "${query}"`, "info", "engine");

    // Dynamic Productivity voice intercept
    if (onVoiceCommand) {
      const response = onVoiceCommand(query);
      if (response) {
        writeSystemLog(`Matched Productivity Pattern: "${cleaned}"`, "success", "engine");
        writeSystemLog(`[Replying] ${response}`, "output", "voice-out");
        speakResponse(response);

        // Bring the relevant tab into focus automatically based on the command!
        if (cleaned.includes("task")) {
          setActiveLedgerTab("tasks");
        } else if (cleaned.includes("remind") || cleaned.includes("reminder")) {
          setActiveLedgerTab("reminders");
        } else if (cleaned.includes("meeting") || cleaned.includes("event") || cleaned.includes("calendar")) {
          setActiveLedgerTab("calendar");
        }
        return;
      }
    }

    // Exact matching logic
    const matched = PREDEFINED_COMMANDS.find(cmd => cleaned === cmd.phrase);

    if (matched) {
      executeMatchedAction(matched);
    } else {
      const kwMatch = PREDEFINED_COMMANDS.find(cmd => cleaned.includes(cmd.phrase));
      if (kwMatch) {
        writeSystemLog(`Keyword sub-match found for target: "${kwMatch.phrase}"`, "success", "engine");
        executeMatchedAction(kwMatch);
      } else {
        const errReply = `Command not recognized: "${query}". Try 'add task study tomorrow' or 'schedule meeting Friday'.`;
        writeSystemLog(`Matching engine returned 0 results.`, "warning", "engine");
        writeSystemLog(`[Replying] ${errReply}`, "output", "voice-out");
        speakResponse("I did not recognize that command. Try add task or schedule meeting.");
      }
    }
  };

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
    }

    if (onAction) {
      const customDescription = onAction(cmd.actionType);
      if (customDescription) {
        resolvedText = customDescription;
      }
    }

    writeSystemLog(`Parsed command structure: Match type "${cmd.phrase.toUpperCase()}"`, "success", "engine");
    writeSystemLog(`[Replying] ${resolvedText}`, "output", "voice-out");
    speakResponse(resolvedText);
  };

  const triggerSimulatedSpeech = (text: string) => {
    if (!text.trim()) return;
    setShowSimulatedMic(false);
    
    setIsListening(true);
    setMicStatusText("● TRANSCRIBING");
    writeSystemLog(`Virtual Audio Input Triggering: "${text}"`, "info", "voice-in");
    
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
    
    writeSystemLog(`Console Prompt Command: "${textQuery}"`, "input", "system");
    processEngineCommand(textQuery);
    setTextQuery("");
  };

  const clearLogs = () => {
    setLogs([]);
    writeSystemLog("SQLite transactional log register flushed.", "info", "system");
  };

  // Checkbox action inside Task dynamic ledger
  const toggleTaskStatus = (id: number) => {
    let taskTitle = "";
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const nextStatus = t.status === "completed" ? "pending" : "completed";
          taskTitle = t.title;
          return { 
            ...t, 
            status: nextStatus as any,
            completed_at: nextStatus === "completed" ? new Date().toISOString() : null
          };
        }
        return t;
      });
      localStorage.setItem("voicepilot_tasks", JSON.stringify(updated));
      return updated;
    });

    writeSystemLog(`[SQL ENGINE] UPDATE tasks INTO local ledger index id=${id}`, "success", "system");
    speakResponse(`Updated task: "${taskTitle}" status changed.`);
  };

  // Direct delete handlers within client ledger widgets
  const deleteTask = (id: number) => {
    setTasks(prev => {
      const filtered = prev.filter(t => t.id !== id);
      localStorage.setItem("voicepilot_tasks", JSON.stringify(filtered));
      return filtered;
    });
    writeSystemLog(`[SQL ENGINE] DELETE FROM tasks WHERE id = ${id}`, "warning", "system");
  };

  const deleteReminder = (id: number) => {
    setReminders(prev => {
      const filtered = prev.filter(r => r.id !== id);
      localStorage.setItem("voicepilot_reminders", JSON.stringify(filtered));
      return filtered;
    });
    writeSystemLog(`[SQL ENGINE] DELETE FROM reminders WHERE id = ${id}`, "warning", "system");
  };

  const deleteCalendarEvent = (id: number) => {
    setEvents(prev => {
      const filtered = prev.filter(e => e.id !== id);
      localStorage.setItem("voicepilot_events", JSON.stringify(filtered));
      return filtered;
    });
    writeSystemLog(`[SQL ENGINE] DELETE FROM calendar_events WHERE id = ${id}`, "warning", "system");
  };

  // CSS Priority color mapper
  const getPriorityBadge = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "high":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "medium":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <div id="voice-assistant" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0 overflow-hidden w-full text-slate-200">
      
      {/* ============================================================== */}
      {/* LEFT COLUMN: PRIMARY capture focal widget (Col 7) */}
      {/* ============================================================== */}
      <div className="lg:col-span-7 flex flex-col bg-[#070a12]/90 border border-slate-800/80 rounded-2xl p-5 overflow-hidden relative shadow-inner">
        
        {/* Core Header info */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold font-mono tracking-wider text-slate-300 uppercase">
              Core Module: {micStatusText}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQuickSettings(!showQuickSettings)}
              className={`p-1.5 rounded-lg border text-slate-400 hover:text-slate-100 transition cursor-pointer ${
                showQuickSettings ? "bg-slate-900 border-slate-700 text-emerald-400" : "bg-[#0b101d] border-slate-850"
              }`}
              title="Voice Configuration"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              OFFLINE VPS
            </span>
          </div>
        </div>

        {/* Quick settings drawer option */}
        <AnimatePresence>
          {showQuickSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#0c1221] border border-slate-800/60 rounded-xl p-3.5 mb-4 text-xs font-mono shrink-0 overflow-hidden text-slate-300"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-3">
                <span className="font-bold text-slate-200 uppercase text-[10px]">Speech Parameters</span>
                <button onClick={() => setShowQuickSettings(false)} className="text-slate-500 hover:text-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">VOICE SELECTION</label>
                  <select
                    value={settings.voiceURI}
                    onChange={(e) => setSettings(p => ({ ...p, voiceURI: e.target.value }))}
                    className="w-full bg-[#070a12] border border-slate-850 rounded px-2 py-1 text-slate-300 focus:outline-none"
                  >
                    {availableVoices.length === 0 ? (
                      <option>System Default Voice</option>
                    ) : (
                      availableVoices.map(v => (
                        <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">SPEED RATE ({settings.rate})</label>
                  <input
                    type="range"
                    min="100"
                    max="250"
                    value={settings.rate}
                    onChange={(e) => setSettings(p => ({ ...p, rate: parseInt(e.target.value, 10) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Simulated Vocal Overlay */}
        <AnimatePresence>
          {showSimulatedMic && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="absolute inset-0 z-20 bg-[#060910] p-5 flex flex-col justify-between border border-slate-800/80 rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold font-mono tracking-wider text-slate-200 uppercase">
                    Interactive Speech Sandbox
                  </span>
                </div>
                <button
                  onClick={() => setShowSimulatedMic(false)}
                  className="p-1 hover:bg-slate-900 text-slate-500 hover:text-slate-200 rounded transition"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center text-center py-4 flex-1 overflow-y-auto pr-1">
                <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center mb-3.5 animate-pulse shrink-0">
                  <Mic className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-sm font-sans font-semibold text-slate-200 mb-1">Seamless Voice Integration</h3>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed max-w-[280px]">
                  Microphone access is locked inside standard browser security iframes. Trigger speech queries instantly by choosing a voice preset below:
                </p>
                
                {/* Instant voice triggers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 w-full max-w-sm mt-4 p-1.5 border border-slate-900 bg-[#090d16] rounded-xl max-h-[140px] overflow-y-auto">
                  <button
                    onClick={() => triggerSimulatedSpeech("what time is it")}
                    className="text-[10px] text-left hover:bg-emerald-950/40 bg-[#0c111e] border border-slate-800/60 p-2 rounded text-slate-300 font-mono transition cursor-pointer"
                  >
                    "What time is it?"
                  </button>
                  <button
                    onClick={() => triggerSimulatedSpeech("add task buy groceries at 6 PM")}
                    className="text-[10px] text-left hover:bg-emerald-950/40 bg-[#0c111e] border border-slate-800/60 p-2 rounded text-slate-300 font-mono transition cursor-pointer"
                  >
                    "Add task buy groceries at 6 PM"
                  </button>
                  <button
                    onClick={() => triggerSimulatedSpeech("schedule meeting review tomorrow at 2 PM")}
                    className="text-[10px] text-left hover:bg-emerald-950/40 bg-[#0c111e] border border-slate-800/60 p-2 rounded text-slate-300 font-mono transition cursor-pointer"
                  >
                    "Schedule meeting review tomorrow..."
                  </button>
                  <button
                    onClick={() => triggerSimulatedSpeech("remind me to check medicine tomorrow at 8 AM")}
                    className="text-[10px] text-left hover:bg-emerald-950/40 bg-[#0c111e] border border-slate-800/60 p-2 rounded text-slate-300 font-mono transition cursor-pointer"
                  >
                    "Remind me tomorrow at 8 AM"
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3.5 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter speech string to synthesize..."
                    value={simulatedText}
                    onChange={(e) => setSimulatedText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        triggerSimulatedSpeech(simulatedText);
                        setSimulatedText("");
                      }
                    }}
                    className="flex-1 text-xs bg-[#0b0f1a] border border-slate-800 text-slate-200 placeholder-slate-650 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      triggerSimulatedSpeech(simulatedText);
                      setSimulatedText("");
                    }}
                    className="bg-emerald-900 border border-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-lg text-emerald-100 font-sans font-bold text-xs transition cursor-pointer"
                  >
                    Speak
                  </button>
                </div>
                <div className="text-[9px] text-slate-500 text-center mt-2.5 font-mono uppercase tracking-wider">
                  Triggers speech engine pipeline offline
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waves visualization panel */}
        <AudioVisualizer 
          isActive={isListening} 
          volume={volumeLevel} 
          isSpeaking={isSpeaking}
          stream={micStream}
        />

        {/* Massive glowing centerpiece Orb & PTT Button */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-4 select-none">
          
          {/* Glowing Orb container */}
          <div className="relative">
            <AnimatePresence>
              {(isListening || isSpeaking) && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ 
                    scale: isSpeaking ? [1.1, 1.3, 1.1] : [1.15, 1.4, 1.15],
                    opacity: [0.4, 0.1, 0.4]
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: isSpeaking ? 1.4 : 2.0, 
                    ease: "easeInOut" 
                  }}
                  className={`absolute -inset-6 rounded-full blur-xl ${
                    isSpeaking ? "bg-indigo-500/15" : "bg-emerald-500/20"
                  }`}
                />
              )}
            </AnimatePresence>

            <button
              onClick={handlePTTToggle}
              className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl relative z-10 border-4 cursor-pointer focus:outline-none ${
                isListening
                  ? "bg-emerald-950/80 border-emerald-400 text-emerald-200 hover:bg-emerald-900"
                  : isSpeaking
                  ? "bg-indigo-950/80 border-indigo-400 text-indigo-200 scale-102"
                  : "bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-600"
              }`}
            >
              {isListening ? (
                <Mic className="w-12 h-12 text-emerald-400 animate-pulse" />
              ) : isSpeaking ? (
                <Sparkle className="w-12 h-12 text-indigo-400 animate-spin-slow" />
              ) : (
                <MicOff className="w-12 h-12 text-slate-400" />
              )}
              <span className="text-[10px] font-mono mt-1.5 font-bold tracking-widest uppercase">
                {isListening ? "Listening" : isSpeaking ? "Speaking" : "Push To Talk"}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-850 rounded-full px-3 py-1 text-[10px] font-mono text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Interactive Voice Activation Loop</span>
          </div>
        </div>

        {/* Local Command Presets / Cheatsheet */}
        <div className="bg-[#0b101c]/60 border border-slate-900 rounded-xl p-3 mb-3 shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1.5 font-mono mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Vocal Phrase Cheatsheet
          </span>
          <div className="flex flex-wrap gap-1 w-full max-h-[85px] overflow-y-auto pr-0.5 scrollbar-thin">
            {PREDEFINED_COMMANDS.map(cmd => (
              <button
                key={cmd.id}
                onClick={() => {
                  writeSystemLog(`Cheatsheet Click: Inputting phrase "${cmd.phrase}"`, "input", "system");
                  processEngineCommand(cmd.phrase);
                }}
                className="text-[10px] font-mono px-2.5 py-1 rounded bg-[#0e1423] border border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-emerald-300 cursor-pointer transition whitespace-nowrap"
              >
                {cmd.phrase}
              </button>
            ))}
          </div>
        </div>

        {/* Text prompt keyboard terminal line directly anchored at bottom */}
        <form onSubmit={handleTextSubmit} className="flex gap-2 border-t border-slate-900 pt-3 shrink-0">
          <input
            type="text"
            placeholder="Type vocal sentence command manually..."
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            className="flex-1 bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-350 placeholder-slate-650 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-950 border border-emerald-800/80 hover:bg-emerald-900 text-emerald-300 px-3.5 hover:border-emerald-600 transition flex items-center justify-center rounded-lg cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

      {/* ============================================================== */}
      {/* RIGHT COLUMN: PRECISE SQLITE DYNAMIC LEDGERS (Col 5) */}
      {/* ============================================================== */}
      <div className="lg:col-span-5 flex flex-col bg-[#070a12]/90 border border-slate-800/80 rounded-2xl p-5 overflow-hidden">
        
        {/* Ledger Header with dynamic navigation */}
        <div className="flex flex-col border-b border-slate-900 pb-3 mb-3 shrink-0 gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>SQLite Dynamic Indices</span>
            </div>
          </div>

          {/* Dynamic LEDGER tabs inside sidebar */}
          <div className="grid grid-cols-4 gap-1 bg-[#0a0f1d] p-1 rounded-lg border border-slate-850 mt-1">
            <button
              onClick={() => setActiveLedgerTab("tasks")}
              className={`py-1 rounded text-[10px] font-mono tracking-wider uppercase font-bold transition flex flex-col items-center justify-center ${
                activeLedgerTab === "tasks" ? "bg-emerald-950/60 text-emerald-450 border border-emerald-900" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setActiveLedgerTab("calendar")}
              className={`py-1 rounded text-[10px] font-mono tracking-wider uppercase font-bold transition flex flex-col items-center justify-center ${
                activeLedgerTab === "calendar" ? "bg-emerald-950/60 text-emerald-450 border border-emerald-900" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              Cal ({events.length})
            </button>
            <button
              onClick={() => setActiveLedgerTab("reminders")}
              className={`py-1 rounded text-[10px] font-mono tracking-wider uppercase font-bold transition flex flex-col items-center justify-center ${
                activeLedgerTab === "reminders" ? "bg-emerald-950/60 text-emerald-450 border border-emerald-900" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              Rem ({reminders.length})
            </button>
            <button
              onClick={() => setActiveLedgerTab("logs")}
              className={`py-1 rounded text-[10px] font-mono tracking-wider uppercase font-bold transition flex flex-col items-center justify-center ${
                activeLedgerTab === "logs" ? "bg-emerald-950/60 text-emerald-450 border border-emerald-900" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              Logs
            </button>
          </div>
        </div>

        {/* Tab display views container with absolute height bounding */}
        <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin scroll-smooth min-h-0">
          <AnimatePresence mode="wait">
            
            {/* 1. TASKS LEDGER PANEL */}
            {activeLedgerTab === "tasks" && (
              <motion.div
                key="tasks-ledger"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-2 h-full"
              >
                {tasks.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 italic text-center font-mono text-[11px]">
                    <ListTodo className="w-8 h-8 text-slate-700 mb-1.5 animate-pulse" />
                    <span>No pending data inside tasks table.</span>
                    <span className="text-[9px] text-slate-650 mt-1 max-w-[180px]">Synthesise "add task write reports" to insert.</span>
                  </div>
                ) : (
                  tasks.map(t => (
                    <div 
                      key={t.id} 
                      className={`p-3 bg-[#0c1221]/90 rounded-xl border transition flex items-start gap-2.5 ${
                        t.status === "completed" ? "border-slate-900 opacity-60" : "border-slate-850 hover:border-slate-700"
                      }`}
                    >
                      <button
                        onClick={() => toggleTaskStatus(t.id)}
                        className="p-0.5 rounded hover:bg-slate-900 text-slate-400 hover:text-emerald-400 mt-0.5 transition cursor-pointer"
                        title="Toggle Check Status"
                      >
                        {t.status === "completed" ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                        ) : (
                          <Circle className="w-4.5 h-4.5 text-slate-650" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-mono bg-slate-950 font-bold border rounded px-1.5 py-0.2 text-slate-400`}>
                            ID:{t.id}
                          </span>
                          <span className={`text-[9px] font-mono font-bold tracking-wider uppercase border rounded px-1.5 py-0.2 ${getPriorityBadge(t.priority)}`}>
                            {t.priority}
                          </span>
                        </div>
                        <h4 className={`text-xs font-sans font-semibold mt-1.5 break-words text-slate-250 ${t.status === "completed" ? "line-through text-slate-500" : ""}`}>
                          {t.title}
                        </h4>
                        <p className="text-[10px] text-slate-550 font-sans leading-normal mt-1 italic break-words">
                          {t.description}
                        </p>
                        {t.due_date && (
                          <div className="flex items-center gap-1 text-[9px] font-mono text-indigo-400 mt-2">
                            <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>Due: {new Date(t.due_date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => deleteTask(t.id)}
                        className="p-1 hover:bg-rose-950/40 text-slate-550 hover:text-rose-400 rounded transition cursor-pointer shrink-0"
                        title="Delete record Row"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* 2. CALENDAR EVENT LEDGER PANEL */}
            {activeLedgerTab === "calendar" && (
              <motion.div
                key="calendar-ledger"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-2 h-full"
              >
                {events.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 italic text-center font-mono text-[11px]">
                    <Calendar className="w-8 h-8 text-slate-700 mb-1.5 animate-pulse" />
                    <span>No slated calendars events cached.</span>
                    <span className="text-[9px] text-slate-650 mt-1 max-w-[180px]">Synthesise "schedule meeting Friday at 10" to append.</span>
                  </div>
                ) : (
                  events.map(ev => (
                    <div 
                      key={ev.id} 
                      className="p-3 bg-[#0c1221]/90 rounded-xl border border-slate-850 hover:border-slate-700 transition flex items-start gap-2.5"
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-950/50 border border-indigo-900/40 text-indigo-400 mt-0.5 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 text-indigo-400 px-1.5 py-0.2 rounded">
                            EVENT:{ev.id}
                          </span>
                        </div>
                        <h4 className="text-xs font-sans font-bold mt-1.5 break-words text-slate-200">
                          {ev.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-sans leading-normal mt-1 break-words">
                          {ev.description}
                        </p>
                        {ev.location && (
                          <span className="inline-block mt-1 bg-slate-900 text-[9px] text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded font-mono">
                            LOC: {ev.location}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-indigo-405 mt-2.5">
                          <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>
                            {new Date(ev.start_time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteCalendarEvent(ev.id)}
                        className="p-1 hover:bg-rose-950/40 text-slate-550 hover:text-rose-400 rounded transition cursor-pointer shrink-0"
                        title="Delete event row"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* 3. REMINDERS QUEUE PANEL */}
            {activeLedgerTab === "reminders" && (
              <motion.div
                key="reminders-ledger"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-2 h-full"
              >
                {reminders.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 italic text-center font-mono text-[11px]">
                    <Clock className="w-8 h-8 text-slate-700 mb-1.5 animate-pulse" />
                    <span>No active reminder thresholds cached.</span>
                    <span className="text-[9px] text-slate-650 mt-1 max-w-[180px]">Synthesise "remind me to run in 5 minutes" to write.</span>
                  </div>
                ) : (
                  reminders.map(rem => (
                    <div 
                      key={rem.id} 
                      className={`p-3 bg-[#0c1221]/90 rounded-xl border transition flex items-start gap-2.5 ${
                        rem.triggered ? "border-slate-900 opacity-60" : "border-slate-850 hover:border-slate-700"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 border ${
                        rem.triggered 
                          ? "bg-slate-950 text-slate-600 border-slate-900" 
                          : "bg-purple-950/40 text-purple-400 border-purple-900"
                      }`}>
                        <Clock className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 text-purple-400 px-1.5 py-0.2 rounded">
                            REMINDER:{rem.id}
                          </span>
                          {rem.triggered ? (
                            <span className="text-[8px] tracking-wider uppercase font-extrabold bg-slate-900 border border-slate-800 text-slate-500 px-1 hover:text-slate-400 rounded">
                              TRIGGERED
                            </span>
                          ) : (
                            <span className="text-[8px] tracking-wider uppercase font-extrabold bg-[#1a0f30] border border-purple-900 text-purple-300 px-1 rounded animate-pulse">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <h4 className={`text-xs font-sans font-bold mt-1.5 break-words text-slate-200 ${rem.triggered ? "line-through text-slate-500" : ""}`}>
                          {rem.message}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[9px] font-mono mt-2 text-purple-400">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            Trig: {new Date(rem.reminder_time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteReminder(rem.id)}
                        className="p-1 hover:bg-rose-950/40 text-slate-550 hover:text-rose-400 rounded transition cursor-pointer shrink-0"
                        title="Delete reminder row"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* 4. SQLITE TERMINAL LOGS LIST CONTAINER */}
            {activeLedgerTab === "logs" && (
              <motion.div
                key="system-logs"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex flex-col h-full space-y-2"
              >
                <div className="flex items-center justify-between bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-lg mb-2">
                  <span className="text-[9px] font-mono text-slate-500">ledger_transactions.log</span>
                  <button
                    onClick={clearLogs}
                    className="flex items-center gap-1 text-[9px] font-sans font-semibold px-2 py-0.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 text-slate-400 hover:text-slate-100 transition shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Flush Log</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] max-h-[340px]" ref={scrollRef}>
                  {logs.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-slate-650 italic font-mono">
                      SQLite transaction pipeline empty.
                    </div>
                  ) : (
                    logs.map((log) => {
                      let tagColor = "bg-slate-900 text-slate-400 border-slate-800";
                      let msgColor = "text-slate-400";

                      if (log.type === "success") {
                        tagColor = "bg-emerald-950/40 text-emerald-400 border-emerald-900";
                        msgColor = "text-emerald-400/90";
                      } else if (log.type === "error") {
                        tagColor = "bg-rose-950/40 text-rose-400 border-rose-900";
                        msgColor = "text-rose-350";
                      } else if (log.type === "warning") {
                        tagColor = "bg-amber-950/40 text-amber-400 border-amber-900";
                        msgColor = "text-amber-300";
                      } else if (log.type === "input") {
                        tagColor = "bg-purple-950/40 text-purple-400 border-purple-900";
                        msgColor = "text-purple-300";
                      } else if (log.type === "output") {
                        tagColor = "bg-blue-950/40 text-blue-400 border-[#0d2a4a]";
                        msgColor = "text-emerald-300 font-bold";
                      }

                      return (
                        <div key={log.id} className="p-2 bg-slate-950/40 rounded border border-transparent hover:border-slate-900 transition flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[9px] text-slate-650 select-none">
                            <span>{log.timestamp}</span>
                            <span className="lowercase font-bold opacity-60">src:{log.source}</span>
                          </div>
                          <div className="flex gap-1.5 items-start">
                            <span className={`text-[8px] px-1 py-0 rounded font-bold uppercase shrink-0 border select-none ${tagColor}`}>
                              {log.type}
                            </span>
                            <span className={`flex-1 break-all tracking-tight leading-relaxed ${msgColor}`}>
                              {log.message}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Database statistics footer */}
        <div className="border-t border-slate-900 pt-3 mt-3 shrink-0 flex items-center justify-between text-[9px] font-mono text-slate-500 uppercase select-none">
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-slate-600" />
            <span>SQLite-MOCK engine: raw memory filesystem</span>
          </div>
          <div>5 indexes bounds</div>
        </div>

      </div>

    </div>
  );
};
