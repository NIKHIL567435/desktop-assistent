import { DesktopSimulator } from "./components/DesktopSimulator";
import { Sparkles, Terminal, Info } from "lucide-react";

export default function App() {
  return (
    <main className="min-h-screen bg-[#02050a] flex flex-col justify-between py-6 px-4 md:px-8 text-slate-100 selection:bg-emerald-500 selection:text-[#02050a]">
      {/* Upper Navigation context */}
      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-900 shrink-0">
        <div className="flex flex-col text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-emerald-950 text-emerald-400 border border-emerald-900 animate-pulse">
              Version V1
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">
              VoicePilot Desktop Assistant
            </h1>
          </div>
          <p className="text-xs text-slate-400 leading-normal mt-1.5 max-w-lg font-sans">
            Offline-first PyQt6 desktop voice workspace. Processes oral speech strings, parses intents, and synthesizes local speech responses.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-3.5 bg-slate-950/60 border border-slate-900 rounded-lg max-w-sm">
          <Info className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
          <p className="text-[11px] text-slate-400 leading-normal font-medium">
            <strong>Voice activation</strong>: Press <strong>PUSH TO TALK</strong> and speak. E.g. <code className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded font-mono">"hello"</code> or <code className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded font-mono">"what time is it"</code>. Or double click commands in the bottom cheatsheet!
          </p>
        </div>
      </div>

      {/* Main interactive desktop simulation card */}
      <div className="flex-1 py-8 flex flex-col justify-center">
        <DesktopSimulator />
      </div>

      {/* Outer informational footer */}
      <footer className="w-full max-w-6xl mx-auto border-t border-slate-900 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[10px] text-slate-500 shrink-0">
        <div>
          VoicePilot Core Engine • V1 local weights compiled offline
        </div>
        <div className="flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5 text-slate-600" />
          Designed in accordance with PyQt6 + Vosk specs
        </div>
      </footer>
    </main>
  );
}
