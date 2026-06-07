import React, { useEffect, useState } from "react";
import { VoiceSettings } from "../types";
import { Sliders, Volume2, Mic, Settings, Play, Database, Sparkles, Server } from "lucide-react";

interface SettingsPanelProps {
  settings: VoiceSettings;
  setSettings: React.Dispatch<React.SetStateAction<VoiceSettings>>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  setSettings,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saveStatus, setSaveStatus] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      setVoices(window.speechSynthesis.getVoices());
      window.speechSynthesis.onvoiceschanged = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
    }
  }, []);

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(prev => ({ ...prev, voiceURI: e.target.value }));
    triggerSuccessFeedback("Synthesizer vocal profile updated!");
  };

  const handleSliderChange = (key: keyof VoiceSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleToggleChange = (key: keyof VoiceSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] } as any));
    triggerSuccessFeedback("Toggle configuration cached!");
  };

  const triggerSuccessFeedback = (message: string) => {
    setSaveStatus(message);
    setTimeout(() => setSaveStatus(""), 2000);
  };

  // Test current sound settings!
  const playSample = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const text = "VoicePilot local offline test. Audio configuration verified.";
      const utterance = new SpeechSynthesisUtterance(text);
      
      const currentVoice = voices.find(v => v.voiceURI === settings.voiceURI);
      if (currentVoice) utterance.voice = currentVoice;
      
      utterance.rate = settings.rate / 175;
      utterance.volume = settings.volume;
      utterance.pitch = settings.pitch;
      
      window.speechSynthesis.speak(utterance);
      triggerSuccessFeedback("Verbal sample played!");
    }
  };

  return (
    <div id="settings-panel" className="grid grid-cols-1 md:grid-cols-2 gap-5 h-[560px] overflow-y-auto pr-1">
      
      {/* Visual vocal synthesizer configs */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col space-y-4">
        <div className="flex items-center gap-2 pb-2 mb-1 border-b border-slate-800">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">
            Vocal Synthesis Engine
          </span>
        </div>

        {/* Voices combobox */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            System Vocal Profile
          </label>
          <select
            value={settings.voiceURI}
            onChange={handleVoiceChange}
            className="w-full bg-[#0c1017] border border-slate-800 rounded px-2.5 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
          >
            {voices.length === 0 ? (
              <option>Searching standard system voices...</option>
            ) : (
              voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Rate (synthesizer speech speed slider) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            <span>Speech Speed / Words-Min</span>
            <span className="text-emerald-400">{settings.rate} WPM</span>
          </div>
          <input
            type="range"
            min="100"
            max="300"
            value={settings.rate}
            onChange={(e) => handleSliderChange("rate", parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Pitch slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            <span>Synthesis Tone / Pitch</span>
            <span className="text-emerald-400">x{settings.pitch.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.pitch}
            onChange={(e) => handleSliderChange("pitch", parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Speed Volume slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            <span>Synthesis Volume</span>
            <span className="text-emerald-400">{Math.round(settings.volume * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => handleSliderChange("volume", parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>

        {/* Test sample speaking button */}
        <div className="pt-2">
          <button
            onClick={playSample}
            className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded text-xs font-semibold py-2.5 text-slate-300 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Test Speech Profile Engine
          </button>
        </div>

      </div>

      {/* Hardware / Architecture simulated configurations */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col space-y-4">
        <div className="flex items-center gap-2 pb-2 mb-1 border-b border-slate-800">
          <Server className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">
            Platform & Hardware Specifications
          </span>
        </div>

        {/* Simulated device capture hardware options */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Speech Capture Audio Device
          </label>
          <select
            value={settings.selectedMic}
            onChange={(e) => {
              setSettings(prev => ({ ...prev, selectedMic: e.target.value }));
              triggerSuccessFeedback("Target mic route updated!");
            }}
            className="w-full bg-[#0c1017] border border-slate-800 rounded px-2.5 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="default">System Default Line Recording Device</option>
            <option value="mic-1">Hardware Built-in Microphone Node</option>
            <option value="line-in">Virtual Audio Capturer Bridge</option>
          </select>
        </div>

        {/* Simulated Target Operating System (pyttsx3 engine choice) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Target OS Synthesis Engine
          </label>
          <select
            className="w-full bg-[#0c1017] border border-slate-800 rounded px-2.5 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
            defaultValue="win32"
            onChange={() => triggerSuccessFeedback("pyttsx3 drivers mapped!")}
          >
            <option value="win32">Windows OS Core: SAPI5 Drivers</option>
            <option value="darwin">macOS Core: SpeechSynthesizer Engines</option>
            <option value="linux2">Linux Core: eSpeak / ALSA modules</option>
          </select>
        </div>

        {/* Offline Mode toggle indicator */}
        <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800/80 rounded-md">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-300 uppercase font-mono tracking-wider">
              Enforce Zero-Network Offline Rule
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Strictly disables outbound networks inside Vosk models.
            </span>
          </div>
          <button
            onClick={() => handleToggleChange("offlineMode")}
            className={`w-11 h-6 rounded-full p-1 transition duration-200 focus:outline-none ${
              settings.offlineMode ? "bg-emerald-600" : "bg-slate-700"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
                settings.offlineMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Wake word toggle indicator */}
        <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800/80 rounded-md">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Pre-V6 Wake Word Active
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Fires standby background listener on: <code className="text-emerald-400">"{settings.wakeWord}"</code>.
            </span>
          </div>
          <button
            onClick={() => handleToggleChange("wakeWordEnabled")}
            className={`w-11 h-6 rounded-full p-1 transition duration-200 focus:outline-none ${
              settings.wakeWordEnabled ? "bg-emerald-600" : "bg-slate-700"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
                settings.wakeWordEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Notification Status Alert */}
        {saveStatus && (
          <div className="text-center text-[11px] font-mono font-bold text-emerald-400 py-1 bg-emerald-950/20 border border-emerald-900/55 rounded shadow-sm">
            {saveStatus}
          </div>
        )}

      </div>

    </div>
  );
};
