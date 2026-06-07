import React, { useState, useMemo } from "react";
import { CalendarEvent } from "../types";
import { 
  CalendarDays, 
  MapPin, 
  Plus, 
  Trash2, 
  Clock, 
  Sparkles,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Info
} from "lucide-react";

interface CalendarPageProps {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  triggerToast: (msg: string) => void;
  writeSystemLog: (msg: string, type: "info" | "success" | "warning" | "error" | "input" | "output", source: "system" | "voice-in" | "voice-out" | "engine" | "automation") => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  events,
  setEvents,
  triggerToast,
  writeSystemLog
}) => {
  // Calendar modes: "daily" | "weekly" | "monthly" | "agenda"
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly" | "agenda">("agenda");

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    tmrw.setHours(14, 0, 0, 0);
    return tmrw.toISOString().substring(0, 16);
  });
  const [endTime, setEndTime] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    tmrw.setHours(15, 0, 0, 0);
    return tmrw.toISOString().substring(0, 16);
  });
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Create manual event
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      triggerToast("Error: Event title is required.");
      return;
    }

    if (new Date(endTime) < new Date(startTime)) {
      triggerToast("Error: End time cannot compile prior to Start time.");
      return;
    }

    const newEvent: CalendarEvent = {
      id: events.length > 0 ? Math.max(...events.map(ev => ev.id)) + 1 : 1,
      title: title.trim(),
      description: description.trim(),
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      location: location.trim(),
      notes: notes.trim(),
      created_at: new Date().toISOString()
    };

    setEvents(prev => {
      const updated = [...prev, newEvent];
      localStorage.setItem("voicepilot_events", JSON.stringify(updated));
      return updated;
    });

    writeSystemLog(`Committed Event ${newEvent.id}: "${newEvent.title}" on the sqlite cluster.`, "success", "system");
    triggerToast(`Event "${newEvent.title}" scheduled successfully.`);

    // Reset fields
    setTitle("");
    setDescription("");
    setLocation("");
    setNotes("");
    
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(14, 0, 0, 0);
    setStartTime(t.toISOString().substring(0, 16));
    t.setHours(15, 0, 0, 0);
    setEndTime(t.toISOString().substring(0, 16));
  };

  // Delete event
  const handleDeleteEvent = (id: number) => {
    setEvents(prev => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem("voicepilot_events", JSON.stringify(updated));
      return updated;
    });
    writeSystemLog(`Deleted event item ID ${id} safely.`, "warning", "system");
    triggerToast("Event deleted from calendar.");
  };

  // Days list for Monthly view (current month)
  const currentMonthDays = useMemo(() => {
    // Current year/month is June 2026 as per local time
    const days: Date[] = [];
    const baseDate = new Date(2026, 5, 1); // June 1st, 2026 (Monday)
    
    // Fill 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  // Weekdays for Weekly view
  const currentWeekDays = useMemo(() => {
    const dates: { dayName: string; date: Date }[] = [];
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const base = new Date(2026, 5, 8); // Start at Monday June 8th, 2026
    
    weekdays.forEach((wd, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push({ dayName: wd, date: d });
    });
    return dates;
  }, []);

  // Events filtered by day comparison helper
  const getEventsForDate = (date: Date) => {
    return events.filter(e => {
      const eventStart = new Date(e.start_time);
      return eventStart.getDate() === date.getDate() && 
             eventStart.getMonth() === date.getMonth() &&
             eventStart.getFullYear() === date.getFullYear();
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[560px] text-slate-350">
      
      {/* Left Column: Create Form */}
      <div className="lg:col-span-5 flex flex-col bg-slate-950 border border-slate-850 rounded-lg p-4 overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-850">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-250 uppercase tracking-widest font-mono">
            Schedule Event Form
          </span>
        </div>

        <form onSubmit={handleCreateEvent} className="space-y-4 font-sans text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Design Sync & Layout sync"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-2.5 py-1.5 text-slate-350 focus:outline-none text-[11px]"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-2.5 py-1.5 text-slate-350 focus:outline-none text-[11px]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
              Location / Link
            </label>
            <input
              type="text"
              placeholder="e.g. Virtual Jitsi, Room 404, or 123 Main St"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-0"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
              Brief Description / Agenda
            </label>
            <textarea
              placeholder="Provide context or event details..."
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-0 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-950/80 hover:bg-emerald-950 text-emerald-300 font-bold border border-emerald-800 hover:border-emerald-500 py-2.5 rounded tracking-widest font-mono uppercase transition cursor-pointer text-[10px]"
          >
            Schedule Calendar event
          </button>
        </form>

        <div className="mt-auto pt-4 border-t border-slate-900 text-[10px] text-slate-500 leading-normal font-mono">
          <div className="text-slate-450 uppercase font-bold tracking-wider mb-1 font-sans">SQLite Calendar Schema:</div>
          <code className="block bg-slate-900/60 p-2 rounded text-[9px] text-[#2cbe7d] font-mono leading-tight">
            CREATE TABLE calendar_events (id INTEGER, title TEXT, notes TEXT, start_time TEXT, end_time TEXT, loc TEXT);
          </code>
        </div>
      </div>

      {/* Right Column: Calendar Grid / Switching layouts */}
      <div className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-850 rounded-lg p-4 overflow-hidden">
        
        {/* Navigation & Layout Switcher */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-850 shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-350">
            <CalendarDays className="w-4 h-4 text-emerald-400" />
            <span className="uppercase tracking-wider">June 2026</span>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-mono font-bold">
            {(["agenda", "daily", "weekly", "monthly"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 select-none cursor-pointer transition rounded-md border text-[9px] sm:text-[10px] uppercase ${
                  viewMode === mode 
                    ? "bg-[#0c1825] border-indigo-900 text-indigo-300" 
                    : "bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-205 hover:border-slate-705"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable views */}
        <div className="flex-1 overflow-y-auto pr-1">
          
          {/* Agenda view: general sorted events */}
          {viewMode === "agenda" && (
            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs italic py-16">
                  No upcoming events scheduled on your calendar.
                </div>
              ) : (
                [...events]
                  .sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map(ev => (
                    <div key={ev.id} className="p-3 bg-[#080d15]/55 border border-slate-850 hover:border-slate-705 rounded-xl transition flex gap-3 items-start">
                      <div className="w-11 py-1 rounded bg-[#0a0f1d] border border-slate-800 text-center shrink-0 font-mono flex flex-col shrink-0 select-none">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                          {new Date(ev.start_time).toLocaleString([], { weekday: "short" })}
                        </span>
                        <span className="text-xs font-black text-emerald-400">
                          {new Date(ev.start_time).getDate()}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0 font-sans text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-200 text-xs leading-tight truncate">{ev.title}</h4>
                          <span className="text-[9px] font-mono text-slate-500 font-bold tracking-tight bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0 select-none">
                            ID: #{ev.id}
                          </span>
                        </div>

                        {ev.description && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{ev.description}</p>}
                        
                        <div className="flex flex-wrap items-center gap-3.5 mt-2 text-[10px] font-mono text-slate-500">
                          <span className="flex items-center gap-1 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            {new Date(ev.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - 
                            {new Date(ev.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>

                          {ev.location && (
                            <span className="flex items-center gap-1 text-slate-400 shrink-0 truncate max-w-[120px]">
                              <MapPin className="w-3.5 h-3.5 text-[#2cbe7d]" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1.5 rounded bg-slate-950 border border-slate-900 hover:border-red-900 text-slate-500 hover:text-rose-455 transition shrink-0 cursor-pointer self-center"
                        title="Purge event block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* Daily View: Specific hourly list for today/tomorrow */}
          {viewMode === "daily" && (
            <div className="space-y-1">
              <div className="bg-slate-900 p-2 rounded text-center text-[10px] font-mono text-slate-400 border border-slate-850 uppercase font-bold tracking-wider mb-2 shrink-0 select-none">
                Timeline Loop: Today & Tomorrow Scheduled Hours
              </div>
              {Array.from({ length: 14 }).map((_, idx) => {
                const hourNum = idx + 8; // 8 AM to 9 PM
                const isPm = hourNum >= 12;
                const displayHour = hourNum > 12 ? hourNum - 12 : hourNum;
                const label = `${displayHour} ${isPm ? "PM" : "AM"}`;

                // Find events falling in this hourly segment
                const hourEvents = events.filter(e => {
                  const s = new Date(e.start_time);
                  return s.getHours() === hourNum;
                });

                return (
                  <div key={idx} className="flex gap-2.5 items-start py-1.5 border-b border-slate-900">
                    <span className="w-14 text-right font-mono text-[10px] text-slate-600 font-bold shrink-0 py-1 font-semibold">
                      {label}
                    </span>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {hourEvents.length === 0 ? (
                        <div className="h-6 rounded bg-slate-950/20 border border-dashed border-slate-900/60" />
                      ) : (
                        hourEvents.map(he => (
                          <div key={he.id} className="px-2.5 py-1.5 rounded-md bg-[#0c1825]/60 hover:bg-[#0c1825] border border-indigo-950 flex items-center justify-between text-xs transition min-h-8">
                            <span className="font-bold text-slate-300 truncate mr-2 font-mono text-xs">{he.title}</span>
                            <span className="text-[9px] font-mono text-slate-500 shrink-0">{he.location || "Online"}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Weekly view: grid columns for 7 days */}
          {viewMode === "weekly" && (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
              {currentWeekDays.map((day, dIdx) => {
                const dayEvents = getEventsForDate(day.date);
                
                return (
                  <div key={dIdx} className="bg-slate-950/40 border border-slate-850 hover:border-slate-755 rounded-lg p-2 flex flex-col h-56 min-w-0 transition">
                    <div className="text-center font-mono border-b border-slate-900 pb-1 shrink-0 select-none">
                      <div className="text-[9px] text-slate-500 uppercase tracking-tight font-extrabold">{day.dayName.substring(0,3)}</div>
                      <div className="text-xs font-black text-indigo-400 mt-0.5">{day.date.getDate()}</div>
                    </div>
                    
                    <div className="flex-grow mt-2 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                      {dayEvents.length === 0 ? (
                        <span className="block text-[9px] text-slate-655 text-center mt-3 select-none italic">Empty</span>
                      ) : (
                        dayEvents.map(e => (
                          <div 
                            key={e.id} 
                            className="p-1 rounded bg-[#091515] border border-emerald-950 text-[9px] text-emerald-300 font-mono font-medium truncate leading-normal hover:border-emerald-500 transition"
                            title={`${e.title} at ${new Date(e.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                          >
                            {e.title}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monthly view: 30 days grid layout */}
          {viewMode === "monthly" && (
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {currentMonthDays.map((day, dIdx) => {
                const dayEvents = getEventsForDate(day);
                const isToday = day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth();

                return (
                  <div 
                    key={dIdx} 
                    className={`h-11 rounded-md border flex flex-col items-center justify-center p-1 relative transition shrink-0 select-none ${
                      isToday 
                        ? "bg-indigo-950/20 border-indigo-500 shadow-[inset_0_0_8px_rgba(99,102,241,0.2)]" 
                        : "bg-slate-950/30 border-slate-900 hover:border-slate-800"
                    }`}
                  >
                    <span className={`text-[10px] font-mono font-bold ${isToday ? "text-indigo-400" : "text-slate-400"}`}>
                      {day.getDate()}
                    </span>

                    {/* Events indicator dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-1 shrink-0 select-none">
                        {dayEvents.map((_, dotIdx) => (
                          <span 
                            key={dotIdx} 
                            className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-pulse shrink-0" 
                            title={dayEvents.map(ev => ev.title).join(", ")}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
