import React, { useState, useMemo } from "react";
import { Reminder } from "../types";
import { 
  Bell, 
  Clock, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Calendar, 
  Play, 
  AlertCircle,
  HelpCircle,
  Sparkles
} from "lucide-react";

interface RemindersPageProps {
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
  triggerToast: (msg: string) => void;
  writeSystemLog: (msg: string, type: "info" | "success" | "warning" | "error" | "input" | "output", source: "system" | "voice-in" | "voice-out" | "engine" | "automation") => void;
}

export const RemindersPage: React.FC<RemindersPageProps> = ({
  reminders,
  setReminders,
  triggerToast,
  writeSystemLog
}) => {
  // Manual creation states
  const [message, setMessage] = useState("");
  const [reminderTime, setReminderTime] = useState(() => {
    // Default to in 15 minutes
    const date = new Date();
    date.setMinutes(date.getMinutes() + 15);
    return date.toISOString().substring(0, 16);
  });
  const [repeatType, setRepeatType] = useState<Reminder["repeat_type"]>("none");

  // Create manual reminder
  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      triggerToast("Error: Reminder description cannot be blank.");
      return;
    }

    const newReminder: Reminder = {
      id: reminders.length > 0 ? Math.max(...reminders.map(r => r.id)) + 1 : 1,
      message: message.trim(),
      reminder_time: new Date(reminderTime).toISOString(),
      repeat_type: repeatType,
      triggered: false,
      created_at: new Date().toISOString()
    };

    setReminders(prev => {
      const updated = [...prev, newReminder];
      localStorage.setItem("voicepilot_reminders", JSON.stringify(updated));
      return updated;
    });

    writeSystemLog(`Created reminder ${newReminder.id}: "${newReminder.message}" at ${new Date(reminderTime).toLocaleString()}.`, "success", "system");
    triggerToast(`Reminder set successfully.`);

    // Reset forms
    setMessage("");
    setRepeatType("none");
    const t = new Date();
    t.setMinutes(t.getMinutes() + 15);
    setReminderTime(t.toISOString().substring(0, 16));
  };

  // Delete reminder
  const handleDeleteReminder = (id: number) => {
    setReminders(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem("voicepilot_reminders", JSON.stringify(updated));
      return updated;
    });
    writeSystemLog(`Deleted reminder state ID ${id} from database stacks.`, "warning", "system");
    triggerToast("Reminder deleted.");
  };

  // Toggle triggered state to simulate manual clear or re-engage
  const handleToggleTrigger = (id: number) => {
    setReminders(prev => {
      const updated = prev.map(r => {
        if (r.id === id) {
          return { ...r, triggered: !r.triggered };
        }
        return r;
      });
      localStorage.setItem("voicepilot_reminders", JSON.stringify(updated));
      return updated;
    });
    triggerToast("Reminder status updated.");
  };

  // Check if reminder is overdue/triggered
  const isOverdue = (r: Reminder) => {
    return !r.triggered && new Date(r.reminder_time) < new Date();
  };

  // Filter lists
  const oneTimeActiveReminders = useMemo(() => {
    return reminders.filter(r => r.repeat_type === "none" && !r.triggered).sort((a,b) => new Date(a.reminder_time).getTime() - new Date(b.reminder_time).getTime());
  }, [reminders]);

  const recurringReminders = useMemo(() => {
    return reminders.filter(r => r.repeat_type !== "none").sort((a,b) => new Date(a.reminder_time).getTime() - new Date(b.reminder_time).getTime());
  }, [reminders]);

  const completedReminders = useMemo(() => {
    return reminders.filter(r => r.triggered).sort((a,b) => new Date(b.reminder_time).getTime() - new Date(a.reminder_time).getTime());
  }, [reminders]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[560px] text-slate-350">
      
      {/* Left Column: Create Form */}
      <div className="lg:col-span-5 flex flex-col bg-slate-950 border border-slate-850 rounded-lg p-4 overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-850">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-250 uppercase tracking-widest font-mono">
            Set Reminder Form
          </span>
        </div>

        <form onSubmit={handleCreateReminder} className="space-y-4 font-sans text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
              Reminder Message *
            </label>
            <input
              type="text"
              placeholder="e.g. Call John or attend project sync"
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Trigger Date & Time
              </label>
              <input
                type="datetime-local"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
                className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-2.5 py-1.5 text-slate-350 focus:outline-none text-[11px]"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Interval Type
              </label>
              <select
                value={repeatType}
                onChange={e => setRepeatType(e.target.value as Reminder["repeat_type"])}
                className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-2 py-2 text-slate-300 focus:outline-none"
              >
                <option value="none">One-time Trigger</option>
                <option value="daily">Every day (Daily)</option>
                <option value="weekly">Every week (Weekly)</option>
                <option value="monthly">Every month (On 1st)</option>
              </select>
            </div>
          </div>

          {/* Quick tips */}
          <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-lg flex items-start gap-2 text-[11px] text-indigo-300 leading-normal">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Did you know?</span> You can register reminders entirely using voice input: <code className="text-emerald-400 font-mono bg-slate-950/50 px-1 py-0.5 rounded">"remind me tomorrow at 9 AM to write report"</code>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-emerald-950/80 hover:bg-emerald-950 text-emerald-300 font-bold border border-emerald-800 hover:border-emerald-500 py-2.5 rounded tracking-widest font-mono uppercase transition cursor-pointer text-[10px]"
          >
            Schedule Alert Node
          </button>
        </form>

        <div className="mt-auto pt-4 border-t border-slate-900 text-[10px] text-slate-500 leading-normal font-mono">
          <div className="text-slate-450 uppercase font-bold tracking-wider mb-1 font-sans">SQLite Reminders Schema:</div>
          <code className="block bg-slate-900/60 p-2 rounded text-[9px] text-[#2cbe7d] font-mono leading-tight">
            CREATE TABLE reminders (id INTEGER key, msg TEXT, trigger_time TEXT, repeat_type TEXT, triggered BOOL);
          </code>
        </div>
      </div>

      {/* Right Column: Categorized lists */}
      <div className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-850 rounded-lg p-4 overflow-hidden">
        
        {/* Toggle Categories headers status */}
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-850 shrink-0 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          <Bell className="w-3.5 h-3.5 text-emerald-400" />
          <span>Active & Scheduled Reminders Scheduler Status</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Section 1: Active One-Time Alerts */}
          <div>
            <h4 className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-widest border-b border-slate-900 pb-1 mb-2">
              ● Active One-time Alerts ({oneTimeActiveReminders.length})
            </h4>
            {oneTimeActiveReminders.length === 0 ? (
              <div className="text-[11px] italic text-slate-600 px-2 py-1">No active one-time reminders scheduled.</div>
            ) : (
              <div className="space-y-2">
                {oneTimeActiveReminders.map(rem => (
                  <div key={rem.id} className="flex items-center justify-between p-2.5 bg-slate-900/35 border border-slate-850 rounded-md hover:border-slate-755 transition">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-slate-650 font-bold select-none">#{rem.id}</span>
                        <h5 className="text-xs font-semibold text-slate-200 truncate">{rem.message}</h5>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-slate-500">
                        <Clock className="w-3 h-3 text-[#2cbe7d]" />
                        <span>Triggers: {new Date(rem.reminder_time).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => handleToggleTrigger(rem.id)}
                        className="text-[9px] font-bold font-mono uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-2 py-1 rounded hover:bg-emerald-900 transition"
                      >
                        Fire
                      </button>
                      <button 
                        onClick={() => handleDeleteReminder(rem.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Active Recurring Alerts */}
          <div>
            <h4 className="text-[10px] font-mono uppercase text-indigo-400 font-bold tracking-widest border-b border-slate-900 pb-1 mb-2">
              ● Recurring Automated Alerts ({recurringReminders.length})
            </h4>
            {recurringReminders.length === 0 ? (
              <div className="text-[11px] italic text-slate-600 px-2 py-1">No recurring/repeating reminders scheduled.</div>
            ) : (
              <div className="space-y-2">
                {recurringReminders.map(rem => (
                  <div key={rem.id} className="flex items-center justify-between p-2.5 bg-[#0e1424]/20 border border-slate-850 rounded-md hover:border-slate-705 transition">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-slate-650 font-bold select-none">#{rem.id}</span>
                        <h5 className="text-xs font-semibold text-slate-250 truncate">{rem.message}</h5>
                        <span className="text-[8px] bg-indigo-950/60 text-indigo-300 font-mono font-bold uppercase border border-indigo-900 px-1.5 rounded select-none shrink-0">
                          {rem.repeat_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-slate-500">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>Baseline anchor: {new Date(rem.reminder_time).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => handleDeleteReminder(rem.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Historically Fired */}
          <div>
            <h4 className="text-[10px] font-mono uppercase text-slate-600 font-bold tracking-widest border-b border-slate-900 pb-1 mb-2">
              ● Fired Alerts Logs ({completedReminders.length})
            </h4>
            {completedReminders.length === 0 ? (
              <div className="text-[11px] italic text-slate-655 px-2 py-1">No alerts triggered in current sandbox runtime.</div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {completedReminders.map(rem => (
                  <div key={rem.id} className="flex items-center justify-between px-3 py-1.5 bg-[#080d14]/20 border border-slate-900 rounded select-none">
                    <span className="text-[11px] font-mono text-slate-550 truncate max-w-[70%]">
                      #{rem.id}: <span className="line-through">{rem.message}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] uppercase tracking-wider font-mono text-slate-600">FIRED OK</span>
                      <button 
                        onClick={() => handleDeleteReminder(rem.id)}
                        className="p-1 text-slate-700 hover:text-slate-200 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
