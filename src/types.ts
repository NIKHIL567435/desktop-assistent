export interface Command {
  id: string;
  phrase: string;
  description: string;
  category: "core" | "system" | "automation";
  actionType: "text" | "time" | "date" | "stop" | "exit" | "volume_up" | "volume_down" | "volume_mute" | "app_browser" | "app_folder" | "shutdown" | "abort" | "cpu_usage" | "memory_usage" | "battery_status" | "disk_space";
  response: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "input" | "output";
  source: "system" | "voice-in" | "voice-out" | "engine" | "automation";
  message: string;
}

export interface VoiceSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  offlineMode: boolean;
  wakeWordEnabled: boolean;
  wakeWord: string;
  selectedMic: string;
}

export interface SourceFile {
  path: string;
  name: string;
  content: string;
  language: string;
  description: string;
}
