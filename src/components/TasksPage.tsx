import React, { useState, useMemo } from "react";
import { Task } from "../types";
import { 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  Calendar, 
  Check, 
  Clock, 
  HelpCircle, 
  AlertCircle,
  Tag
} from "lucide-react";

interface TasksPageProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  triggerToast: (msg: string) => void;
  writeSystemLog: (msg: string, type: "info" | "success" | "warning" | "error" | "input" | "output", source: "system" | "voice-in" | "voice-out" | "engine" | "automation") => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  tasks,
  setTasks,
  triggerToast,
  writeSystemLog
}) => {
  // Navigation states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    return tomorrow.toISOString().substring(0, 16);
  });

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed" | "overdue">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "medium" | "high" | "urgent">("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "createdAt">("dueDate");

  // Handle task manual form submission
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      triggerToast("Error: Task title is required.");
      return;
    }

    const newTask: Task = {
      id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: new Date(dueDate) < new Date() ? "overdue" : "pending",
      created_at: new Date().toISOString(),
      due_date: new Date(dueDate).toISOString(),
      completed_at: null
    };

    setTasks(prev => {
      const updated = [...prev, newTask];
      localStorage.setItem("voicepilot_tasks", JSON.stringify(updated));
      return updated;
    });

    // Logging & Speech confirmation
    writeSystemLog(`Created manual task ${newTask.id}: "${newTask.title}" via UI Form.`, "success", "system");
    triggerToast(`Task "${newTask.title}" added successfully.`);

    // Reset fields
    setTitle("");
    setDescription("");
    setPriority("medium");
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    tmrw.setHours(17, 0, 0, 0);
    setDueDate(tmrw.toISOString().substring(0, 16));
  };

  // Toggle complete state
  const handleToggleComplete = (id: number) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const isCompleting = t.status !== "completed";
          return {
            ...t,
            status: isCompleting ? "completed" : (new Date(t.due_date) < new Date() ? "overdue" : "pending") as Task["status"],
            completed_at: isCompleting ? new Date().toISOString() : null
          };
        }
        return t;
      });
      localStorage.setItem("voicepilot_tasks", JSON.stringify(updated));
      return updated;
    });
    
    const item = tasks.find(t => t.id === id);
    if (item) {
      const logState = item.status === "completed" ? "pending/overdue" : "completed";
      writeSystemLog(`Task ID ${id} status toggled manually to: ${logState}.`, "info", "system");
      triggerToast(`Task flags synchronized: ${item.title}`);
    }
  };

  // Delete task
  const handleDeleteTask = (id: number) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem("voicepilot_tasks", JSON.stringify(updated));
      return updated;
    });
    writeSystemLog(`Deleted task item ${id} safely from SQLite environment mockup.`, "warning", "system");
    triggerToast("Task deleted.");
  };

  // Utility priority weight helper
  const getPriorityWeight = (p: Task["priority"]): number => {
    switch(p) {
      case "urgent": return 4;
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
    }
  };

  // Computed filtered & sorted tasks
  const processedTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              t.description.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchesStatus = true;
        const isCurrentlyOverdue = t.status !== "completed" && new Date(t.due_date) < now;
        
        if (statusFilter === "completed") {
          matchesStatus = t.status === "completed";
        } else if (statusFilter === "pending") {
          matchesStatus = t.status === "pending" && !isCurrentlyOverdue;
        } else if (statusFilter === "overdue") {
          matchesStatus = isCurrentlyOverdue || t.status === "overdue";
        }

        const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === "dueDate") {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        } else if (sortBy === "priority") {
          return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
        } else {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  }, [tasks, searchQuery, statusFilter, priorityFilter, sortBy]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[560px] text-slate-350">
      
      {/* Left Column: Create Form */}
      <div className="lg:col-span-5 flex flex-col bg-slate-950 border border-slate-850 rounded-lg p-4 overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-850">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-250 uppercase tracking-widest font-mono">
            New Task Form
          </span>
        </div>

        <form onSubmit={handleCreateTask} className="space-y-4 font-sans text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Schedule team coordination layout"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
              Task Description
            </label>
            <textarea
              placeholder="Provide exact details or command arguments..."
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-0 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Priority Index
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Task["priority"])}
                className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-2 py-2 text-slate-300 focus:outline-none"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Due Date / Clock
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none text-[11px]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-emerald-950/80 hover:bg-emerald-950 text-emerald-300 font-bold border border-emerald-800 hover:border-emerald-500 py-2.5 rounded tracking-widest font-mono uppercase transition cursor-pointer text-[10px]"
          >
            Commit Task to database
          </button>
        </form>

        <div className="mt-auto pt-4 border-t border-slate-900 text-[10px] text-slate-500 leading-normal font-mono">
          <div className="text-slate-450 uppercase font-bold tracking-wider mb-1">SQLite SQL Query Triggered:</div>
          <code className="block bg-slate-900/60 p-2 rounded text-[9px] text-[#2cbe7d] font-mono leading-tight">
            INSERT INTO tasks (title, desc, priority, status, due_date) VALUES (?, ?, ?, 'pending', ?);
          </code>
        </div>
      </div>

      {/* Right Column: List & Filters */}
      <div className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-850 rounded-lg p-4 overflow-hidden">
        
        {/* Navigation & Search bar */}
        <div className="flex flex-col gap-3 pb-3 mb-3 border-b border-slate-850 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SQL registry records..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#080d16] border border-slate-800 focus:border-emerald-500 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none"
              />
            </div>
            
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-850 rounded text-[10px] font-mono text-slate-400 px-2 py-1.5 focus:outline-none"
            >
              <option value="dueDate">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="createdAt">Sort: Created Time</option>
            </select>
          </div>

          {/* Quick Filters tab strip */}
          <div className="flex flex-wrap items-center gap-1.5 text-[9px] sm:text-[10px] font-mono">
            <span className="text-slate-500 flex items-center gap-1 uppercase mr-1">
              <Filter className="w-3 h-3 text-emerald-400" /> State:
            </span>
            {(["all", "pending", "completed", "overdue"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2 py-1 rounded transition border uppercase font-semibold ${
                  statusFilter === tab 
                    ? "bg-[#0c1e19] text-emerald-300 border-emerald-800/80" 
                    : "bg-[#090d15] text-slate-400 border-slate-850 hover:border-slate-705"
                }`}
              >
                {tab}
              </button>
            ))}

            <div className="w-full sm:w-auto h-0 sm:h-4 border-l border-slate-900 hidden sm:block mx-1" />

            <span className="text-slate-500 flex items-center gap-1 uppercase mr-1">
              <Tag className="w-3 h-3 text-emerald-400" /> Tier:
            </span>
            {(["all", "low", "medium", "high", "urgent"] as const).map(tier => (
              <button
                key={tier}
                onClick={() => setPriorityFilter(tier)}
                className={`px-2 py-1 rounded transition border uppercase font-semibold ${
                  priorityFilter === tier 
                    ? "bg-[#0c1825] text-indigo-300 border-indigo-900/60" 
                    : "bg-[#090d15] text-slate-500 border-slate-850 hover:border-slate-705"
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable list content */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {processedTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs italic">
              No tasks found in SQLite local context block.
            </div>
          ) : (
            processedTasks.map(task => {
              const overdue = task.status !== "completed" && new Date(task.due_date) < new Date();
              let priorityColor = "bg-slate-900 border-slate-800 text-slate-400";
              
              if (task.priority === "urgent") priorityColor = "bg-rose-950/30 border-rose-900 text-rose-450";
              else if (task.priority === "high") priorityColor = "bg-amber-950/30 border-amber-900 text-amber-450";
              else if (task.priority === "medium") priorityColor = "bg-indigo-950/35 border-indigo-900/40 text-indigo-300";

              return (
                <div 
                  key={task.id} 
                  className={`flex gap-3 items-start p-3 bg-[#080d15]/55 border transition rounded-lg ${
                    task.status === "completed" 
                      ? "border-slate-900 scale-[0.99] bg-[#070b12]/30" 
                      : overdue 
                      ? "border-rose-950/65 bg-rose-950/5/40" 
                      : "border-slate-850 hover:border-slate-755"
                  }`}
                >
                  {/* Select complete checkbox */}
                  <button
                    onClick={() => handleToggleComplete(task.id)}
                    className={`mt-0.5 rounded-full w-4.5 h-4.5 border flex items-center justify-center transition cursor-pointer shrink-0 ${
                      task.status === "completed"
                        ? "bg-emerald-950/80 border-emerald-500 text-emerald-400"
                        : overdue
                        ? "bg-rose-950/10 border-rose-900 hover:border-rose-600 text-transparent"
                        : "bg-slate-950 border-slate-800 hover:border-slate-600 text-transparent hover:text-slate-500"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>

                  {/* Text details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-500 font-bold select-none shrink-0">
                        #{task.id}
                      </span>
                      <h4 className={`text-xs font-semibold leading-tight truncate ${
                        task.status === "completed" 
                          ? "text-slate-500 line-through font-normal" 
                          : "text-slate-200"
                      }`}>
                        {task.title}
                      </h4>
                      
                      {/* Priority Tag */}
                      <span className={`text-[8px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded border select-none shrink-0 ${priorityColor}`}>
                        {task.priority}
                      </span>
                    </div>

                    {task.description && (
                      <p className={`text-[11px] mt-1 line-clamp-2 leading-normal ${
                        task.status === "completed" ? "text-slate-600" : "text-slate-450"
                      }`}>
                        {task.description}
                      </p>
                    )}

                    {/* Meta dates footer */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[9px] font-mono font-medium text-slate-500">
                      <span className="flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3 text-slate-600" />
                        Due: <span className={overdue ? "text-rose-450 font-bold" : "text-slate-400"}>
                          {new Date(task.due_date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>

                      {task.status === "completed" && task.completed_at && (
                        <span className="text-emerald-500 shrink-0 select-none">
                          Done: {new Date(task.completed_at).toLocaleDateString()}
                        </span>
                      )}

                      {overdue && (
                        <span className="text-rose-450 font-bold flex items-center gap-0.5 uppercase tracking-wider text-[8px] border border-rose-900/50 bg-rose-950/20 px-1.5 rounded select-none shrink-0">
                          <AlertCircle className="w-2.5 h-2.5" /> OVERDUE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Deletion btn */}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 rounded bg-slate-950/60 border border-slate-900 hover:border-red-900 hover:text-rose-400 text-slate-500 cursor-pointer transition shrink-0 self-center"
                    title="Purge Task from system DB"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
        
      </div>

    </div>
  );
};
