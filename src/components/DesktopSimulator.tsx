import React, { useState, useEffect, useRef } from "react";
import { VoiceAssistant } from "./VoiceAssistant";
import { CodeExplorer } from "./CodeExplorer";
import { SettingsPanel } from "./SettingsPanel";
import { TasksPage } from "./TasksPage";
import { RemindersPage } from "./RemindersPage";
import { CalendarPage } from "./CalendarPage";
import { parseNaturalLanguageDateTime } from "../lib/dateTimeParser";
import { VoiceSettings, Command, Task, Reminder, CalendarEvent, LogEntry } from "../types";
import {
  Mic,
  Terminal,
  Settings,
  Clock,
  HelpCircle,
  HardDrive,
  Shield,
  Chrome,
  Folder,
  Volume2,
  VolumeX,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  CheckCircle,
  Play,
  Cpu,
  Battery,
  Activity,
  Bell
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const DesktopSimulator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"assistant" | "tasks" | "reminders" | "calendar" | "code" | "settings">("assistant");
  const [systemTime, setSystemTime] = useState<string>("");
  const [windowState, setWindowState] = useState<"normal" | "minimized" | "closed">("normal");

  // Lifted Database States for SQLite Desktop Mockup
  const [tasks, setTasks] = useState<Task[]>(() => {
    const cached = localStorage.getItem("voicepilot_tasks");
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 1,
        title: "Submit report tomorrow at 6 PM",
        description: "Submit V3 hardware telemetry indicator audit blocks to director",
        priority: "high",
        status: "pending",
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        due_date: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(18, 0, 0, 0);
          return d.toISOString();
        })(),
        completed_at: null
      },
      {
        id: 2,
        title: "Buy groceries",
        description: "Standard local list of supplies",
        priority: "low",
        status: "pending",
        created_at: new Date(Date.now() - 3600005 * 20).toISOString(),
        due_date: (() => {
          const d = new Date();
          d.setHours(20, 0, 0, 0);
          return d.toISOString();
        })(),
        completed_at: null
      },
      {
        id: 3,
        title: "Check local SQLite database bounds",
        description: "Upgrade database schemas to support production calendar rules",
        priority: "urgent",
        status: "completed",
        created_at: new Date(Date.now() - 3600000 * 25).toISOString(),
        due_date: new Date(Date.now() - 3600000 * 2).toISOString(),
        completed_at: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ];
  });

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const cached = localStorage.getItem("voicepilot_reminders");
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 1,
        message: "Call John",
        reminder_time: (() => {
          const d = new Date();
          d.setHours(20, 0, 0, 0);
          return d.toISOString();
        })(),
        repeat_type: "none",
        triggered: false,
        created_at: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 2,
        message: "Take medicine",
        reminder_time: (() => {
          const d = new Date();
          d.setHours(19, 0, 0, 0);
          return d.toISOString();
        })(),
        repeat_type: "daily",
        triggered: false,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ];
  });

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const cached = localStorage.getItem("voicepilot_events");
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 1,
        title: "Dentist appointment dentist appointment Friday at 10 AM",
        description: "Routine physical cleaning process",
        start_time: (() => {
          const d = new Date();
          const day = d.getDay();
          const nextFri = (5 - day + 7) % 7 || 7;
          d.setDate(d.getDate() + nextFri);
          d.setHours(10, 0, 0, 0);
          return d.toISOString();
        })(),
        end_time: (() => {
          const d = new Date();
          const day = d.getDay();
          const nextFri = (5 - day + 7) % 7 || 7;
          d.setDate(d.getDate() + nextFri);
          d.setHours(11, 0, 0, 0);
          return d.toISOString();
        })(),
        location: "123 Dental Suite Clinic",
        notes: "Bring insurance card",
        created_at: new Date(Date.now() - 3600000 * 12).toISOString()
      },
      {
        id: 2,
        title: "Project Review Meeting with directors",
        description: "Compile and present active terminal metrics graphs",
        start_time: (() => {
          const d = new Date();
          d.setMinutes(d.getMinutes() + 15); // Trigger alarm alert of 15-min warning!
          return d.toISOString();
        })(),
        end_time: (() => {
          const d = new Date();
          d.setHours(d.getHours() + 1);
          return d.toISOString();
        })(),
        location: "Virtual Jitsi Main Room",
        notes: "Bring slide deck link",
        created_at: new Date(Date.now() - 3600000 * 8).toISOString()
      }
    ];
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const notifiedEventIdsRef = useRef<Set<number>>(new Set());
  const [activeNotification, setActiveNotification] = useState<{ title: string; message: string } | null>(null);

  // Unified logging function
  const writeSystemLog = (
    message: string,
    type: "info" | "success" | "warning" | "error" | "input" | "output",
    source: "system" | "voice-in" | "voice-out" | "engine" | "automation"
  ) => {
    const timestamp = new Date().toLocaleTimeString();
    const newEntry: LogEntry = {
      id: Math.random().toString(),
      timestamp,
      type,
      source,
      message,
    };
    setLogs(prev => [...prev, newEntry]);
  };

  // Speaks out spoken responses
  const speakResponse = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (settings.voiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
        if (selectedVoice) utterance.voice = selectedVoice;
      }
      utterance.rate = settings.rate / 175;
      utterance.volume = settings.volume;
      utterance.pitch = settings.pitch;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Show desktop popups & speak notifications
  const triggerDesktopNotification = (title: string, message: string, voiceAnnounceText: string) => {
    setActiveNotification({ title, message });
    speakResponse(voiceAnnounceText);
    setTimeout(() => {
      setActiveNotification(null);
    }, 8000);
  };

  // Initial console loading logs
  useEffect(() => {
    writeSystemLog("VoicePilot subsystem initialized in offline container.", "info", "system");
    writeSystemLog("Local SQLite database loaded: voicepilot.db (5 schemas loaded).", "success", "system");
    writeSystemLog("Vosk local voice engine ready: vosk-model-small-en-us-0.15.", "success", "engine");
  }, []);

  // BG Scheduler Loop
  useEffect(() => {
    const schedulerInterval = setInterval(() => {
      const now = new Date();

      // 1. Monitor Reminders
      setReminders(prev => {
        let changed = false;
        const updated = prev.map(rem => {
          const remTime = new Date(rem.reminder_time);
          if (!rem.triggered && remTime <= now) {
            changed = true;
            triggerDesktopNotification("Reminder Alert", rem.message, `You have a reminder: ${rem.message}`);
            writeSystemLog(`[SCHEDULER] Triggered reminder alert: "${rem.message}"`, "success", "system");
            return { ...rem, triggered: true };
          }
          return rem;
        });
        if (changed) {
          localStorage.setItem("voicepilot_reminders", JSON.stringify(updated));
          return updated;
        }
        return prev;
      });

      // 2. Monitor Calendar Events (15 min check)
      events.forEach(ev => {
        const startTime = new Date(ev.start_time);
        const diffMs = startTime.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / (60 * 1000));

        if (diffMins === 15 && !notifiedEventIdsRef.current.has(ev.id)) {
          notifiedEventIdsRef.current.add(ev.id);
          triggerDesktopNotification(
            "Upcoming Event",
            `${ev.title} starting in 15 minutes`,
            `Your event ${ev.title} starts in 15 minutes`
          );
          writeSystemLog(`[SCHEDULER] Pre-event 15 minute timer fired: "${ev.title}"`, "info", "system");
        }
      });

      // 3. Monitor Overdue Tasks
      setTasks(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (t.status === "pending" && new Date(t.due_date) < now) {
            changed = true;
            writeSystemLog(`[SCHEDULER] Marked task #${t.id} ("${t.title}") as Overdue.`, "warning", "system");
            return { ...t, status: "overdue" as const };
          }
          return t;
        });
        if (changed) {
          localStorage.setItem("voicepilot_tasks", JSON.stringify(updated));
          return updated;
        }
        return prev;
      });

    }, 5000);

    return () => clearInterval(schedulerInterval);
  }, [events]);

  // Voice Command Productivity matcher
  const handleProductivityVoiceCommand = (query: string): string | null => {
    const clean = query.trim().toLowerCase();

    // Add Task Handler
    if (clean.startsWith("add task ")) {
      const remaining = query.substring(9).trim();
      const datePhrases = ["tomorrow at", "next monday at", "next friday at", "friday at", "at ", "every day at", "every monday at", "in "];
      let titlePart = remaining;
      let datePart = "";

      for (const phrase of datePhrases) {
        const index = remaining.toLowerCase().indexOf(phrase);
        if (index !== -1) {
          titlePart = remaining.substring(0, index).trim();
          datePart = remaining.substring(index).trim();
          break;
        }
      }

      if (titlePart.toLowerCase().endsWith(" at")) {
        titlePart = titlePart.substring(0, titlePart.length - 3).trim();
      }

      const parsed = parseNaturalLanguageDateTime(datePart || "tomorrow");
      const newTask: Task = {
        id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
        title: titlePart || "Voice Task",
        description: `Scheduled via VoicePilot matching engine coordinate: "${datePart || "tomorrow"}"`,
        priority: "medium",
        status: parsed.dateTime < new Date() ? "overdue" : "pending",
        created_at: new Date().toISOString(),
        due_date: parsed.dateTime.toISOString(),
        completed_at: null
      };

      setTasks(prev => {
        const updated = [...prev, newTask];
        localStorage.setItem("voicepilot_tasks", JSON.stringify(updated));
        return updated;
      });

      writeSystemLog(`[SQL ENGINE] Executed: INSERT INTO tasks (title, status) VALUES ('${newTask.title}', 'pending');`, "success", "system");
      return `Task successfully committed: "${newTask.title}" is scheduled for ${parsed.dateTime.toLocaleString()}.`;
    }

    // Toggle Completed Task Handler
    if (clean.includes("mark task ") && (clean.includes("as completed") || clean.includes("completed") || clean.includes("as complete") || clean.includes("complete"))) {
      const match = clean.match(/mark\s+task\s+(\d+)/);
      if (match) {
        const id = parseInt(match[1], 10);
        let taskTitle = "";
        let found = false;

        setTasks(prev => {
          const updated = prev.map(t => {
            if (t.id === id) {
              found = true;
              taskTitle = t.title;
              return { ...t, status: "completed" as const, completed_at: new Date().toISOString() };
            }
            return t;
          });
          if (found) {
            localStorage.setItem("voicepilot_tasks", JSON.stringify(updated));
          }
          return updated;
        });

        if (found) {
          writeSystemLog(`[SQL ENGINE] Executed: UPDATE tasks SET status = 'completed' WHERE id = ${id};`, "success", "system");
          return `I have updated SQLite registers. Marked task ${id}: "${taskTitle}" as completed.`;
        } else {
          return `I could not locate task ${id} in active relational records.`;
        }
      }
    }

    // Delete Task Handler
    if (clean.startsWith("delete task ")) {
      const match = clean.match(/delete\s+task\s+(\d+)/);
      if (match) {
        const id = parseInt(match[1], 10);
        let found = false;

        setTasks(prev => {
          const filtered = prev.filter(t => {
            if (t.id === id) {
              found = true;
              return false;
            }
            return true;
          });
          if (found) {
            localStorage.setItem("voicepilot_tasks", JSON.stringify(filtered));
          }
          return filtered;
        });

        if (found) {
          writeSystemLog(`[SQL ENGINE] Executed: DELETE FROM tasks WHERE id = ${id};`, "warning", "system");
          return `Successfully purged task ${id} from local indices.`;
        } else {
          return `I could not locate task ${id} to remove.`;
        }
      }
    }

    // Show Tasks Handler
    if (clean.includes("show my tasks") || clean.includes("show tasks") || clean.includes("show pending tasks") || clean.includes("show completed tasks") || clean.includes("show overdue tasks")) {
      setActiveTab("tasks");
      if (clean.includes("pending")) {
        const count = tasks.filter(t => t.status === "pending").length;
        return `Loading tasks console. You have ${count} pending tasks awaiting action.`;
      } else if (clean.includes("completed")) {
        const count = tasks.filter(t => t.status === "completed").length;
        return `Loading tasks table. There are ${count} completed items in local history.`;
      } else if (clean.includes("overdue")) {
        const count = tasks.filter(t => t.status !== "completed" && new Date(t.due_date) < new Date()).length;
        return `Warning: Opened tasks grid. You have ${count} overdue tasks unresolved.`;
      }
      return `Loading tasks dashboard. You have a total of ${tasks.length} tasks registered.`;
    }

    // Create Reminder Handler
    if (clean.startsWith("remind me ") || clean.startsWith("create reminder ")) {
      let subject = query;
      let reminderMsg = "";
      let whenPart = "";

      const toIdx = clean.indexOf(" to ");
      
      if (clean.startsWith("remind me tomorrow at ") || clean.startsWith("remind me at ") || clean.startsWith("remind me in ")) {
        if (toIdx !== -1) {
          whenPart = query.substring(10, toIdx).trim();
          reminderMsg = query.substring(toIdx + 4).trim();
        } else {
          reminderMsg = query.substring(10).trim();
          whenPart = "in 15 minutes";
        }
      } else {
        const startOfMsg = clean.startsWith("remind me to ") ? 13 : (clean.startsWith("remind me ") ? 10 : 16);
        const subjectAndDate = query.substring(startOfMsg).trim();
        const dates = [" at ", " tomorrow", " next friday", " every day", " in "];
        let splitIdx = -1;
        for (const d of dates) {
          const idx = subjectAndDate.toLowerCase().indexOf(d);
          if (idx !== -1) {
            splitIdx = idx;
            break;
          }
        }

        if (splitIdx !== -1) {
          reminderMsg = subjectAndDate.substring(0, splitIdx).trim();
          whenPart = subjectAndDate.substring(splitIdx).trim();
        } else {
          reminderMsg = subjectAndDate;
          whenPart = "in 15 minutes";
        }
      }

      const parsed = parseNaturalLanguageDateTime(whenPart);
      const newReminder: Reminder = {
        id: reminders.length > 0 ? Math.max(...reminders.map(r => r.id)) + 1 : 1,
        message: reminderMsg || "Heuristic voice notification",
        reminder_time: parsed.dateTime.toISOString(),
        repeat_type: parsed.repeatType,
        triggered: false,
        created_at: new Date().toISOString()
      };

      setReminders(prev => {
        const updated = [...prev, newReminder];
        localStorage.setItem("voicepilot_reminders", JSON.stringify(updated));
        return updated;
      });

      writeSystemLog(`[SQL ENGINE] Scheduled: INSERT INTO reminders (msg, trigger_time) VALUES ('${newReminder.message}', '${newReminder.reminder_time}');`, "success", "system");
      return `Alert successfully registered: "${newReminder.message}" will ring on ${parsed.dateTime.toLocaleString()}${newReminder.repeat_type !== "none" ? ` repeating ${newReminder.repeat_type}` : ""}.`;
    }

    // List Reminders
    if (clean === "show reminders") {
      setActiveTab("reminders");
      return `Opening Reminders scheduler. You have ${reminders.filter(r => !r.triggered).length} pending thresholds in queue.`;
    }

    // Delete Reminder
    if (clean.startsWith("delete reminder ")) {
      const match = clean.match(/delete\s+reminder\s+(\d+)/);
      if (match) {
        const id = parseInt(match[1], 10);
        let found = false;

        setReminders(prev => {
          const filtered = prev.filter(r => {
            if (r.id === id) {
              found = true;
              return false;
            }
            return true;
          });
          if (found) {
            localStorage.setItem("voicepilot_reminders", JSON.stringify(filtered));
          }
          return filtered;
        });

        if (found) {
          writeSystemLog(`[SQL ENGINE] Executed: DELETE FROM reminders WHERE id = ${id};`, "warning", "system");
          return `Purged reminder entry ${id} from cache registers.`;
        } else {
          return `No reminder found matching index key ${id}.`;
        }
      }
    }

    // Schedule Event / Calendar Meeting
    if (clean.startsWith("schedule meeting ") || clean.startsWith("add event ")) {
      const isMeeting = clean.startsWith("schedule meeting ");
      const subject = query.substring(isMeeting ? 17 : 10).trim();
      const timePhrases = [" tomorrow at", " next monday at", " next friday at", " friday at", " at ", " in "];
      let titlePart = subject;
      let datePart = "";

      for (const phrase of timePhrases) {
        const idx = subject.toLowerCase().indexOf(phrase);
        if (idx !== -1) {
          titlePart = subject.substring(0, idx).trim();
          datePart = subject.substring(idx).trim();
          break;
        }
      }

      const parsed = parseNaturalLanguageDateTime(datePart || "tomorrow at 2 PM");
      const endDateTime = new Date(parsed.dateTime);
      endDateTime.setHours(endDateTime.getHours() + 1);

      const newEvent: CalendarEvent = {
        id: events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1,
        title: titlePart || (isMeeting ? "Scheduled Review" : "Regular Checkpoint"),
        description: `Asynchronous calendar node mapped via transcript: "${datePart || "tomorrow at"}"`,
        start_time: parsed.dateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        location: isMeeting ? "Local Office conference loop" : "Clinic location",
        notes: "Coordinated hands-free.",
        created_at: new Date().toISOString()
      };

      setEvents(prev => {
        const updated = [...prev, newEvent];
        localStorage.setItem("voicepilot_events", JSON.stringify(updated));
        return updated;
      });

      writeSystemLog(`[SQL ENGINE] Mapped Event: INSERT INTO calendar_events (title, start) VALUES ('${newEvent.title}', '${newEvent.start_time}');`, "success", "system");
      return `Calendar entry successful: "${newEvent.title}" on ${parsed.dateTime.toLocaleString()}.`;
    }

    // Show Calendar List
    if (clean.includes("show today's calendar") || clean.includes("show this week's schedule") || clean.includes("what events do i have today") || clean.includes("show calendar")) {
      setActiveTab("calendar");
      const todayCount = events.filter(e => {
        const st = new Date(e.start_time);
        return st.getDate() === new Date().getDate() && st.getMonth() === new Date().getMonth();
      }).length;
      return `Loading your Calendar panel. You have ${todayCount} active meetings registered for today.`;
    }

    // Delete Event Handler
    if (clean.startsWith("delete event ")) {
      const match = clean.match(/delete\s+event\s+(\d+)/);
      if (match) {
        const id = parseInt(match[1], 10);
        let found = false;

        setEvents(prev => {
          const filtered = prev.filter(e => {
            if (e.id === id) {
              found = true;
              return false;
            }
            return true;
          });
          if (found) {
            localStorage.setItem("voicepilot_events", JSON.stringify(filtered));
          }
          return filtered;
        });

        if (found) {
          writeSystemLog(`[SQL ENGINE] Purged: DELETE FROM calendar_events WHERE id = ${id};`, "warning", "system");
          return `Purged event block ${id} from calendar scheduler indexes.`;
        } else {
          return `Could not find event with index key ${id}.`;
        }
      }
    }

    return null;
  };

  // V2 Interactive Desktop states
  const [volume, setVolume] = useState<number>(70); // 0-100%
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showVolumeHUD, setShowVolumeHUD] = useState<boolean>(false);
  const [hudTimeoutId, setHudTimeoutId] = useState<any>(null);

  const [isBrowserOpen, setIsBrowserOpen] = useState<boolean>(false);
  const [isFolderOpen, setIsFolderOpen] = useState<boolean>(false);
  const [browserUrl, setBrowserUrl] = useState<string>("https://ai.studio/build");

  const [shutdownTimer, setShutdownTimer] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimeoutId, setToastTimeoutId] = useState<any>(null);

  // V3 System Monitoring states
  const [cpuLoad, setCpuLoad] = useState<number>(18);
  const [ramLoad, setRamLoad] = useState<number>(44);
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [batteryCharging, setBatteryCharging] = useState<boolean>(true);
  const [diskCapacity, setDiskCapacity] = useState<number>(58); // 58% full -> 242 GB remaining
  const [highlightedStat, setHighlightedStat] = useState<"cpu" | "ram" | "battery" | "disk" | null>(null);
  const [statHighlightTimeout, setStatHighlightTimeout] = useState<any>(null);

  const [settings, setSettings] = useState<VoiceSettings>({
    voiceURI: "",
    rate: 175,
    pitch: 1.0,
    volume: 1.0,
    offlineMode: true,
    wakeWordEnabled: false,
    wakeWord: "voicepilot",
    selectedMic: "default",
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // System fluctuating monitors interval loop
  useEffect(() => {
    const metricsInterval = setInterval(() => {
      setCpuLoad(prev => {
        const offset = Math.floor(Math.random() * 11) - 5; // -5 to +5
        return Math.max(5, Math.min(85, prev + offset));
      });
      setRamLoad(prev => {
        const offset = Math.floor(Math.random() * 3) - 1; // -1 to +1
        return Math.max(38, Math.min(52, prev + offset));
      });
      setBatteryLevel(prev => {
        // Battery drains slowly if unplugged, fluctuates slightly here or stays high
        if (Math.random() > 0.95) {
          return Math.max(15, Math.min(100, prev + (Math.random() > 0.5 ? 1 : -1)));
        }
        return prev;
      });
    }, 2500);

    return () => clearInterval(metricsInterval);
  }, []);

  // System shutdown countdown clock
  useEffect(() => {
    if (shutdownTimer === null) return;
    if (shutdownTimer === 0) {
      setWindowState("closed");
      setShutdownTimer(null);
      return;
    }
    const timer = setTimeout(() => {
      setShutdownTimer(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [shutdownTimer]);

  // Volume HUD helper
  const triggerVolumeHUD = () => {
    setShowVolumeHUD(true);
    if (hudTimeoutId) {
      clearTimeout(hudTimeoutId);
    }
    const id = setTimeout(() => {
      setShowVolumeHUD(false);
    }, 2500);
    setHudTimeoutId(id);
  };

  // Toast Notification helper
  const triggerToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }
    const id = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    setToastTimeoutId(id);
  };

  // Pulse effect trigger for visual V3 monitors
  const triggerMetricHighlight = (stat: "cpu" | "ram" | "battery" | "disk") => {
    setHighlightedStat(stat);
    if (statHighlightTimeout) {
      clearTimeout(statHighlightTimeout);
    }
    const id = setTimeout(() => {
      setHighlightedStat(null);
    }, 4500);
    setStatHighlightTimeout(id);
  };

  // Central command mapping to V2 & V3 state changes
  const handleAction = (actionType: Command["actionType"]): string | void => {
    if (actionType === "volume_up") {
      setIsMuted(false);
      const newVol = Math.min(volume + 10, 100);
      setVolume(newVol);
      triggerVolumeHUD();
      return `System speaker volume increased to ${newVol} percent.`;
    }
    if (actionType === "volume_down") {
      setIsMuted(false);
      const newVol = Math.max(volume - 10, 0);
      setVolume(newVol);
      triggerVolumeHUD();
      return `System speaker volume decreased to ${newVol} percent.`;
    }
    if (actionType === "volume_mute") {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      triggerVolumeHUD();
      return nextMute
        ? "System speaker muted."
        : `System speaker unmuted. Volume restored to ${volume} percent.`;
    }
    if (actionType === "app_browser") {
      setIsBrowserOpen(true);
      triggerToast("Simulated Automation: Launched virtual Chrome web Web browser.");
      return "Launching virtual Chrome web browser.";
    }
    if (actionType === "app_folder") {
      setIsFolderOpen(true);
      triggerToast("Simulated Automation: Loaded Downloads directory index.");
      return "Opening Downloads folder directory.";
    }
    if (actionType === "shutdown") {
      if (shutdownTimer !== null) {
        return "Shutdown countdown is already executing.";
      }
      setShutdownTimer(5);
      return "Alert: System shutdown sequence triggered. Halting host in 5 seconds.";
    }
    if (actionType === "abort") {
      if (shutdownTimer === null) {
        return "There is no active shutdown sequence to abort.";
      }
      setShutdownTimer(null);
      triggerToast("Shutdown sequence aborted.");
      return "Halting routine aborted. Resuming normal operations.";
    }

    // V3 System Monitoring Command Responses
    if (actionType === "cpu_usage") {
      triggerMetricHighlight("cpu");
      triggerToast(`System telemetry requested: Current active CPU utilization is ${cpuLoad}%.`);
      return `Current CPU thread utilization stands at ${cpuLoad} percent with multiple active logical core processors registered.`;
    }
    if (actionType === "memory_usage") {
      triggerMetricHighlight("ram");
      triggerToast(`System telemetry requested: Active RAM allocation is ${ramLoad}%.`);
      const allocatedGigabytes = ((ramLoad / 100) * 16).toFixed(1);
      return `Physical system memory usage is evaluated at ${ramLoad} percent, allocating approximately ${allocatedGigabytes} out of 16 gigabytes.`;
    }
    if (actionType === "battery_status") {
      triggerMetricHighlight("battery");
      triggerToast(`System telemetry requested: Internal battery capacity is ${batteryLevel}%.`);
      return `Internal lithium-ion battery levels are checked at ${batteryLevel} percent capability, registered as plugged-in on AC line current.`;
    }
    if (actionType === "disk_space") {
      triggerMetricHighlight("disk");
      triggerToast(`System telemetry requested: Free unallocated space index checked.`);
      return `Primary Solid State Drive node is running at ${diskCapacity} percent used space capacity, with exactly 242 gigabytes of unallocated blocks remaining.`;
    }
  };

  if (windowState === "closed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center p-8 bg-[#090d13] rounded-xl border border-slate-800">
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-4 shadow-xl">
          <Terminal className="w-8 h-8 text-rose-500 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 font-sans tracking-tight">
          Assistant Terminated Gracefully
        </h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
          The local PyQt6 thread loop is deactivated. All PyAudio mic lines and sqlite descriptors are safely unallocated.
        </p>
        <button
          onClick={() => {
            setWindowState("normal");
            triggerToast("VoicePilot re-initialized successfully.");
          }}
          className="mt-6 px-4 py-2 bg-emerald-950/80 border border-emerald-800 hover:border-emerald-600 text-emerald-300 font-bold rounded text-xs tracking-wide transition cursor-pointer"
        >
          Re-initialize Engine (V2 System Boot)
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col h-full bg-[#030712] rounded-xl shadow-2xl border border-slate-850 overflow-hidden select-none relative animate-fade-in">
      {/* OS Sim Top header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-900 text-slate-400 text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 uppercase tracking-widest text-[10px]">
            VoicePilot Desktop
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <strong className="text-slate-300 font-mono">{systemTime}</strong>
          </span>
        </div>
      </div>

      {/* Main OS Simulator Area */}
      <div className="flex-1 p-4 md:p-6 bg-[#070b13] flex flex-col justify-center min-h-[520px] relative">
        
        {/* Main Application Frame Window */}
        <div className={`w-full bg-[#0a0f1d] border border-slate-800/80 rounded-xl shadow-2xl transition duration-300 flex flex-col overflow-hidden relative ${
          windowState === "minimized" ? "h-12" : "h-[640px]"
        }`}>
          
          {/* Window Titlebar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-850 shrink-0 bg-slate-950/40">
            {/* Window control circles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWindowState("closed")}
                className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition cursor-pointer"
                title="Graceful exit"
              />
              <button
                onClick={() => setWindowState(windowState === "minimized" ? "normal" : "minimized")}
                className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 transition cursor-pointer"
                title={windowState === "minimized" ? "Restore Window" : "Minimize Window"}
              />
              <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono tracking-wide text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              voicepilot_core.exe
            </div>

            <div className="w-12 text-right">
              {/* Quick status shortcut */}
              <span className="text-[10px] bg-slate-900 border border-slate-850 text-slate-400 px-2 py-0.5 rounded font-mono">
                VOL: {isMuted ? "MUTE" : `${volume}%`}
              </span>
            </div>
          </div>

          {windowState !== "minimized" && (
            <>
              {/* Window Tabs Selector navigation */}
              <div className="flex items-center justify-between bg-slate-950 px-4 py-1 border-b border-slate-850 shrink-0 select-none overflow-x-auto">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab("assistant")}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-t-md transition duration-200 tracking-wide font-mono ${
                      activeTab === "assistant"
                        ? "bg-[#0a0f1d] border-t-2 border-emerald-500 text-emerald-300 font-semibold"
                        : "text-slate-400 hover:text-slate-205"
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    Terminal
                  </button>
                  <button
                    onClick={() => setActiveTab("tasks")}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-t-md transition duration-200 tracking-wide font-mono ${
                      activeTab === "tasks"
                        ? "bg-[#0a0f1d] border-t-2 border-emerald-500 text-emerald-300 font-semibold"
                        : "text-slate-400 hover:text-slate-205"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    Tasks Page
                  </button>
                  <button
                    onClick={() => setActiveTab("reminders")}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-t-md transition duration-200 tracking-wide font-mono ${
                      activeTab === "reminders"
                        ? "bg-[#0a0f1d] border-t-2 border-emerald-500 text-emerald-300 font-semibold"
                        : "text-slate-400 hover:text-slate-205"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0 text-[#a855f7]" />
                    Reminders
                  </button>
                  <button
                    onClick={() => setActiveTab("calendar")}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-t-md transition duration-200 tracking-wide font-mono ${
                      activeTab === "calendar"
                        ? "bg-[#0a0f1d] border-t-2 border-emerald-500 text-emerald-300 font-semibold"
                        : "text-slate-400 hover:text-slate-205"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    Calendar Grid
                  </button>
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-t-md transition duration-200 tracking-wide font-mono ${
                      activeTab === "code"
                        ? "bg-[#0a0f1d] border-t-2 border-emerald-500 text-emerald-300 font-semibold"
                        : "text-slate-400 hover:text-slate-205"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 shrink-0" />
                    Python Export
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-t-md transition duration-200 tracking-wide font-mono ${
                      activeTab === "settings"
                        ? "bg-[#0a0f1d] border-t-2 border-emerald-500 text-emerald-300 font-semibold"
                        : "text-slate-400 hover:text-slate-205"
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    Speech Set
                  </button>
                </div>

                {/* V2 OS Application Shortcuts inside Tabs Bar */}
                <div className="flex items-center gap-2 px-2 text-slate-500">
                  <button
                    onClick={() => {
                      setIsBrowserOpen(!isBrowserOpen);
                      triggerToast(isBrowserOpen ? "Closed Web Browser Window" : "Opened Web Browser Window");
                    }}
                    className={`p-1 rounded cursor-pointer transition ${isBrowserOpen ? "bg-blue-950/50 border border-blue-900/50 text-blue-400" : "hover:bg-slate-900 text-slate-400"}`}
                    title="Toggle Google Chrome Browser"
                  >
                    <Chrome className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsFolderOpen(!isFolderOpen);
                      triggerToast(isFolderOpen ? "Closed Downloads Folder Window" : "Opened Downloads Folder Window");
                    }}
                    className={`p-1 rounded cursor-pointer transition ${isFolderOpen ? "bg-emerald-950/50 border border-emerald-900/50 text-emerald-400" : "hover:bg-slate-900 text-slate-400"}`}
                    title="Toggle Downloads File Explorer"
                  >
                    <Folder className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-4 overflow-hidden bg-[#0a0f1d] relative">
                {activeTab === "assistant" && (
                  <VoiceAssistant
                    settings={settings}
                    setSettings={setSettings}
                    onAction={handleAction}
                    onVoiceCommand={handleProductivityVoiceCommand}
                    logs={logs}
                    setLogs={setLogs}
                    writeSystemLog={writeSystemLog}
                  />
                )}
                {activeTab === "tasks" && (
                  <TasksPage
                    tasks={tasks}
                    setTasks={setTasks}
                    triggerToast={triggerToast}
                    writeSystemLog={writeSystemLog}
                  />
                )}
                {activeTab === "reminders" && (
                  <RemindersPage
                    reminders={reminders}
                    setReminders={setReminders}
                    triggerToast={triggerToast}
                    writeSystemLog={writeSystemLog}
                  />
                )}
                {activeTab === "calendar" && (
                  <CalendarPage
                    events={events}
                    setEvents={setEvents}
                    triggerToast={triggerToast}
                    writeSystemLog={writeSystemLog}
                  />
                )}
                {activeTab === "code" && <CodeExplorer />}
                {activeTab === "settings" && (
                  <SettingsPanel settings={settings} setSettings={setSettings} />
                )}

                {/* ==============================================
                    V2 OS VISUAL PLUGINS & INTERACTIVE OVERLAYS
                    ============================================== */}

                {/* A. System Volume HUD Indicator Overlay */}
                <AnimatePresence>
                  {showVolumeHUD && (
                    <motion.div
                      initial={{ y: -20, opacity: 0, scale: 0.95 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -20, opacity: 0, scale: 0.95 }}
                      className="absolute top-4 right-4 z-40 bg-slate-900/95 border border-emerald-500/30 rounded-lg p-3 shadow-2xl flex items-center gap-3 w-64 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0a0f1a] border border-slate-800 shrink-0 text-slate-200">
                        {isMuted ? (
                          <VolumeX className="w-5 h-5 text-rose-400" />
                        ) : (
                          <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] font-bold font-mono tracking-wide text-slate-300">
                          <span>OS MIXER VOLUME</span>
                          <span>{isMuted ? "MUTED" : `${volume}%`}</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1.5 mt-1.5 border border-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-150 ${isMuted ? "bg-slate-700 w-0" : "bg-emerald-500"}`}
                            style={{ width: `${isMuted ? 0 : volume}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* B. Google Chrome Web Browser Window */}
                <AnimatePresence>
                  {isBrowserOpen && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 15 }}
                      className="absolute inset-x-4 sm:inset-x-8 inset-y-6 z-30 bg-[#0c1220]/95 border border-blue-500/25 rounded-xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-md"
                    >
                      {/* Titlebar */}
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-850 shrink-0">
                        <div className="flex items-center gap-2">
                          <Chrome className="w-4 h-4 text-blue-400 animate-spin-slow" />
                          <span className="text-[11px] font-bold font-mono text-slate-300">Google Chrome - OS Sandbox Environment</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="text-[9px] font-mono font-bold bg-blue-950/60 border border-blue-900/60 text-blue-300 px-2 py-0.5 rounded">
                            LOCAL SANDBOX ACTIVE
                          </div>
                          <button
                            onClick={() => setIsBrowserOpen(false)}
                            className="text-slate-400 hover:text-slate-100 p-1 hover:bg-slate-900 rounded cursor-pointer transition shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* URL browser bar */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/40 border-b border-slate-850 shrink-0">
                        <button
                          onClick={() => {
                            setBrowserUrl("https://ai.studio/build");
                            triggerToast("Returning browser to AI Studio build");
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
                          title="Return Home"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 text-[11px] font-mono text-slate-350 flex items-center gap-1.5">
                          <span className="text-emerald-500 text-[10px] select-none font-bold">https://</span>
                          <input
                            type="text"
                            value={browserUrl.replace("https://", "")}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBrowserUrl(val.startsWith("https://") ? val : `https://${val}`);
                            }}
                            className="bg-transparent border-none text-slate-300 flex-1 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Content view page */}
                      <div className="flex-1 overflow-y-auto p-4 md:p-6 text-slate-300 font-sans select-text scrollbar-thin">
                        {browserUrl.includes("ai.studio") ? (
                          <div>
                            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4 mb-4">
                              <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                <Chrome className="w-5 h-5 text-indigo-400" />
                              </div>
                              <div>
                                <h1 className="text-base font-bold text-slate-100 leading-tight">Google AI Studio Build Workspace</h1>
                                <p className="text-[11px] text-slate-500 mt-0.5">Automated offline telemetry coordinates.</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="bg-slate-900/30 border border-slate-800/60 p-4 rounded-lg">
                                <h3 className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5 mb-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                  Vvosk Speech Pipeline
                                </h3>
                                <div className="space-y-2 text-[11px]">
                                  <div className="flex justify-between items-center py-1 border-b border-slate-850">
                                    <span className="text-slate-500">Language model:</span>
                                    <span className="font-mono text-slate-350">VosK small EN</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-850">
                                    <span className="text-slate-500">PyAudio Input index:</span>
                                    <span className="font-mono text-slate-350">Hardware 0 (stereo block)</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1">
                                    <span className="text-slate-500">Latency threshold:</span>
                                    <span className="font-mono text-slate-350 text-emerald-400">12ms (Direct-To-Core)</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-900/30 border border-slate-800/60 p-4 rounded-lg">
                                <h3 className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5 mb-2">
                                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                                  Vosk System Indicators
                                </h3>
                                <div className="space-y-1.5 text-[11px] font-mono">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">[Buffer Length]</span>
                                    <span className="text-slate-350">4000 frame cycles</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">[Voice Synthesizer]</span>
                                    <span className="text-slate-350">pyttsx3 Speech Layer</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">[Automation Hooks]</span>
                                    <span className="text-emerald-400">pyautogui.press() Active</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="border border-slate-850 bg-[#070b13]/80 p-3 rounded text-[11px] font-mono text-slate-400 leading-normal mb-4">
                              <span className="text-emerald-400 font-bold">// VoicePilot V2 Voice Automation Specifications:</span><br/>
                              - "volume up" / "volume down": triggers local system master gain adjustments.<br/>
                              - "mute volume": coordinates speaker muting filters in local databases.<br/>
                              - "open browser" / "open downloads": opens visual applets asynchronously.<br/>
                              - "system shutdown": initiates graceful system loops.
                            </div>

                            <p className="text-[10px] text-slate-500 text-center uppercase tracking-wider font-mono mt-2">
                              System preview page end.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
                              <div className="w-10 h-10 rounded bg-[#0b0f1a] border border-slate-800 flex items-center justify-center shrink-0">
                                <Chrome className="w-5 h-5 text-indigo-400 animate-spin-slow" />
                              </div>
                              <div>
                                <h2 className="text-sm font-bold text-slate-100 font-mono">{browserUrl}</h2>
                                <p className="text-[10px] text-slate-500 font-mono">Virtual simulation route active.</p>
                              </div>
                            </div>

                            <div className="bg-[#070b13]/60 border border-slate-850 p-4 rounded-lg text-xs leading-relaxed max-w-xl text-slate-300">
                              <h3 className="font-bold text-slate-100 mb-2 font-mono text-xs text-indigo-400">Offline Web Renderer Sandbox</h3>
                              <p className="mt-1">
                                You are viewing a local simulated render of the target URL: <span className="text-emerald-400 font-mono">{browserUrl}</span>.
                              </p>
                              <p className="mt-3 text-slate-450 leading-relaxed text-[11px]">
                                In standalone offline PyQt desktop assistant builds, the browser node utilizes localized caching directories or displays built-in QtWebEngine structures for configuration panels. Since external internet connectivity is completely passive, any address inputted compiles local offline system parameters dynamically.
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setBrowserUrl("https://ai.studio/build");
                                triggerToast("Returning browser to AI Studio build");
                              }}
                              className="mt-5 text-[10px] font-mono px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 text-slate-300 rounded cursor-pointer transition font-bold"
                            >
                              &larr; Return to AI Studio Build
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* C. Downloads Folder Explorer Window */}
                <AnimatePresence>
                  {isFolderOpen && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 15 }}
                      className="absolute inset-x-4 sm:inset-x-12 inset-y-12 z-30 bg-[#0c1220]/95 border border-emerald-500/20 rounded-xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-md"
                    >
                      {/* Titlebar */}
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-850 shrink-0">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-emerald-400" />
                          <span className="text-[11px] font-bold font-mono text-slate-300">File Explorer - Downloads</span>
                        </div>
                        <button
                          onClick={() => setIsFolderOpen(false)}
                          className="text-slate-400 hover:text-slate-100 p-1 hover:bg-slate-900 rounded cursor-pointer transition shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* File Explorer Bar */}
                      <div className="bg-[#0a0f1a] px-3 py-1.5 border-b border-slate-850 flex items-center justify-between text-[11px] font-medium text-slate-400 shrink-0 select-none">
                        <div className="font-mono text-slate-500 truncate mr-2">
                          Directory: <span className="text-slate-300">C:\Users\Developer\Downloads</span>
                        </div>
                        <div className="text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900/60 px-2 py-0.5 rounded shrink-0">
                          242 GB FREE (HDD)
                        </div>
                      </div>

                      {/* Directory Files Grid */}
                      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { name: "vosk-model-small-en-us-0.15.zip", size: "40.2 MB", type: "ZIP Archive", desc: "Local acoustic dictionary models" },
                            { name: "voicepilot.db", size: "1.2 MB", type: "SQLite DB File", desc: "Local SQL historical transactions data" },
                            { name: "pyaudio-0.2.14-cp310-win.whl", size: "124 KB", type: "Python Wheel", desc: "Hardware audio binding package" },
                            { name: "main.py", size: "3.4 KB", type: "Python Script", desc: "Application bootstrap coordinate file" },
                            { name: "requirements.txt", size: "130 B", type: "Text File", desc: "Local project dependency bounds" },
                            { name: "assistant_report_v2.pdf", size: "2.1 MB", type: "PDF Document", desc: "V2 Desktop Control automation summary" }
                          ].map((file, idx) => (
                            <div
                              key={idx}
                              className="bg-[#070b13]/60 hover:bg-slate-900 border border-slate-850 hover:border-slate-705 rounded-lg p-3 transition duration-150 cursor-pointer select-none"
                              onClick={() => {
                                triggerToast(`Simulated Opened File: ${file.name} successfully`);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <FileText className="w-5 h-5 text-indigo-400" />
                                <span className="text-[9px] font-mono text-slate-500 font-bold bg-[#090d15] px-1.5 rounded py-0.5 border border-slate-850">
                                  {file.size}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-slate-200 mt-2 truncate font-mono" title={file.name}>
                                {file.name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1 font-sans truncate">
                                {file.desc}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* D. System Shutdown Countdown Overlay Modal */}
                <AnimatePresence>
                  {shutdownTimer !== null && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6"
                    >
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.9 }}
                        className="max-w-md w-full bg-[#0a0f1d] border border-rose-500/40 rounded-xl p-6 shadow-2xl flex flex-col items-center"
                      >
                        <div className="w-16 h-16 rounded-full bg-rose-950 border border-rose-500/60 flex items-center justify-center mb-4 text-rose-400 animate-pulse shadow-glow">
                          <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-bold font-mono tracking-widest text-rose-450 uppercase">
                          PyQt6 Thread Shutdown Sequence
                        </h3>
                        <p className="text-xs text-slate-400 font-sans mt-2 leading-relaxed">
                          The offline voice engine requested main thread close signal codes. Processing SQLite commits and closing microphone capture loops in:
                        </p>
                        <div className="text-6xl font-black font-mono text-rose-500 my-4 tracking-tighter">
                          0:0{shutdownTimer}
                        </div>
                        <div className="w-full bg-slate-950 border border-slate-850 rounded p-3 text-[10px] font-mono text-left text-slate-500 leading-normal mb-5">
                          $ python main.py --force --timeout=5<br />
                          [INFO] Dispatching EXIT_SIGNAL to PyQt GUI<br />
                          [INFO] Terminating vosk speech Recognizer...
                        </div>
                        <button
                          onClick={() => {
                            setShutdownTimer(null);
                            triggerToast("System Auto-destruct / Shutdown cancelled.");
                          }}
                          className="w-full py-2.5 bg-rose-950 border border-rose-800 hover:border-rose-600 hover:bg-rose-900 text-rose-200 font-bold rounded text-xs tracking-widest font-mono uppercase transition cursor-pointer"
                        >
                          Abort System Shutdown
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* E. Toast Messages Alerts Overlay */}
                <AnimatePresence>
                  {toastMessage && (
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 50, opacity: 0 }}
                      className="absolute bottom-4 right-4 z-40 bg-slate-900 border border-emerald-500/30 rounded px-3 py-2 flex items-center gap-2 shadow-2xl text-[11px] text-slate-200 font-mono"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{toastMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* F. Scheduled Reminder Alarm Portal Desktop Pop-up */}
                <AnimatePresence>
                  {activeNotification && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 50 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 50 }}
                      className="absolute bottom-16 right-4 z-50 bg-[#090d16] border border-emerald-500 rounded-lg p-4 shadow-2xl flex items-start gap-3 w-80 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-950 border border-emerald-500 shrink-0 text-emerald-450">
                        <Bell className="w-5 h-5 animate-bounce" />
                      </div>
                      <div className="flex-1 min-w-0 font-sans">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold tracking-widest text-[#2cbe7d] uppercase">
                            {activeNotification.title}
                          </span>
                          <button
                            onClick={() => setActiveNotification(null)}
                            className="text-slate-500 hover:text-slate-350 p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 mt-1.5 leading-snug">
                          {activeNotification.message}
                        </h4>
                        <p className="text-[9px] font-mono text-slate-600 mt-2 flex items-center gap-1 uppercase font-semibold">
                          <Clock className="w-3.5 h-3.5 text-slate-700" /> offline engine service
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </>
          )}

        </div>
        
      </div>
    </div>
  );
};
