import React, { useState } from "react";
import { pythonFiles } from "../data/pythonCode";
import { SourceFile } from "../types";
import { Folder, FileCode, Copy, Check, Download, Info, Terminal } from "lucide-react";

export const CodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<SourceFile>(pythonFiles[1]); // Default to main.py
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([selectedFile.content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = selectedFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const filteredFiles = pythonFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Simple syntax colors for python
  const highlightCode = (code: string, lang: string) => {
    if (lang !== "python" && lang !== "json" && lang !== "markdown") {
      return <span>{code}</span>;
    }
    
    // Simplistic clean line by line rendering to maintain fast performance and neat styling
    const lines = code.split("\n");
    return (
      <div className="font-mono text-[12px] leading-relaxed text-slate-300">
        {lines.map((line, idx) => {
          let lineClass = "";
          if (line.trim().startsWith("#") || line.trim().startsWith('"""') || line.trim().startsWith('"')) {
            lineClass = "text-slate-500 italic"; // Comment
          } else if (line.includes("def ") || line.includes("class ") || line.includes("import ")) {
            lineClass = "text-emerald-400 font-semibold";
          } else if (line.includes("self.") || line.includes("return ")) {
            lineClass = "text-blue-300";
          }
          return (
            <div key={idx} className="flex hover:bg-slate-900/60 transition-colors py-[1px] px-2 rounded">
              <span className="w-10 text-slate-600 select-none text-right pr-4 font-mono select-none border-r border-slate-800 mr-4">
                {idx + 1}
              </span>
              <span className={`whitespace-pre-wrap ${lineClass}`}>
                {line}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div id="code-explorer" className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[560px]">
      {/* Directory Tree Column */}
      <div id="code-sidebar" className="lg:col-span-4 flex flex-col bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-hidden">
        <div className="flex items-center gap-2 pb-3 mb-1 border-b border-slate-800">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            V1 File Workspace
          </span>
        </div>

        {/* Search */}
        <div className="my-2">
          <input
            type="text"
            placeholder="Search module..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Directory Listings */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-1 font-mono text-xs">
          {/* Virtual Directories structure */}
          <div className="text-[11px] text-slate-500 font-bold px-1 py-1 uppercase tracking-wider flex items-center gap-1">
            <Folder className="w-3.5 h-3.5 text-slate-600" />
            voicepilot_v1/
          </div>

          <div className="pl-3 space-y-1">
            {filteredFiles.map((file) => {
              const isSelected = file.path === selectedFile.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded transition duration-150 ${
                    isSelected
                      ? "bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 font-semibold"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-emerald-400" : "text-slate-500"}`} />
                  <span className="truncate">{file.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Setup banner */}
        <div className="mt-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-md">
          <div className="flex gap-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            V1 Command Scope
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Pre-registered triggers: <code className="text-emerald-400 bg-emerald-950/20 px-1 py-0.5 rounded font-mono">"hello"</code>, <code className="text-emerald-400 bg-emerald-950/20 px-1 py-0.5 rounded">"what time is it"</code>, <code className="text-emerald-400 bg-emerald-950/20 px-1 py-0.5 rounded">"what date is today"</code>, <code className="text-emerald-400 bg-emerald-950/20 px-1 py-0.5 rounded">"exit assistant"</code>, <code className="text-emerald-400 bg-emerald-950/20 px-1 py-0.5 rounded">"stop listening"</code>.
          </p>
        </div>
      </div>

      {/* Editor Column */}
      <div id="code-content" className="lg:col-span-8 flex flex-col bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        {/* Editor Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/40">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-200 font-mono">
              {selectedFile.path}
            </span>
            <span className="text-[11px] text-slate-500 font-semibold font-sans mt-0.5">
              {selectedFile.description}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 hover:text-slate-100 transition"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-emerald-950/40 border border-emerald-900 hover:border-emerald-700 text-emerald-300 rounded hover:bg-emerald-900/40 transition"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Editor Viewer */}
        <div className="flex-1 overflow-auto bg-[#0a0d13] p-4 select-text">
          {highlightCode(selectedFile.content, selectedFile.language)}
        </div>
      </div>
    </div>
  );
};
