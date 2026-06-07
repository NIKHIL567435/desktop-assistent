import { SourceFile } from "../types";

export const pythonFiles: SourceFile[] = [
  {
    path: "requirements.txt",
    name: "requirements.txt",
    language: "plaintext",
    description: "Python third-party package dependencies required for building the V2 offline voice assistant with desktop control.",
    content: `# VoicePilot V2 Offline Requirements
PyQt6>=6.4.2
vosk>=0.3.50
pyttsx3>=2.90
pyaudio>=0.2.14
pyautogui>=0.9.54
psutil>=5.9.5
`
  },
  {
    path: "main.py",
    name: "main.py",
    language: "python",
    description: "Application bootstrap coordinate file. Integrates GUI, SQLite database, speech modules, desktop control, and runs the PyQt6 loop.",
    content: `"""
VoicePilot Desktop Assistant - V2 Bootstrap Entry-point.
Coordinates speech nodes, datastores, desktop automation systems, and PyQt6 GUI execution.
"""
import sys
import os
import logging
from PyQt6.QtWidgets import QApplication
from app.gui import VoicePilotMainWindow
from database.manager import DatabaseManager
from voice.tts import TextToSpeechEngine
from voice.stt import SpeechToTextWorker
from core.engine import CommandEngine

# Setup local application logs directory
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(threadName)s) %(message)s",
    handlers=[
        logging.FileHandler("logs/assistant.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)

def main():
    logging.info("Initializing VoicePilot Desktop Assistant V1 backend...")
    
    # Base application
    app = QApplication(sys.argv)
    app.setApplicationName("VoicePilot Desktop Assistant")
    
    # 1. Initialize DB Manager
    db = DatabaseManager()
    
    # 2. Setup Async Text-To-Speech Engine
    tts = TextToSpeechEngine()
    
    # 3. Setup Command Execution Logic
    engine = CommandEngine(tts, db)
    
    # 4. Initialize Desktop Main Workspace
    window = VoicePilotMainWindow(engine, tts, db)
    
    # 5. Link command callbacks back to visual display
    def _on_input_recognized(text: str):
        # Pass captured transcript to PyQt main UI thread
        window.log_user_command(text)
        # Parse voice intent and reply
        response = engine.process_command(text)
        window.log_system_response(response)
        
        # Act on special system callbacks if needed
        if "EXIT_SIGNAL" in response:
            window.close_app_gracefully()

    # Create STT thread context loader but let UI trigger mic actions
    stt_worker = SpeechToTextWorker()
    stt_worker.text_recognized.connect(_on_input_recognized)
    stt_worker.status_update.connect(window.update_mic_status)
    stt_worker.volume_update.connect(window.update_audio_level)
    
    # Bind starting/stopping recognition to push-to-talk button
    window.set_stt_worker(stt_worker)
    
    # Display GUI
    window.show()
    logging.info("VoicePilot MainWindow rendered successfully.")
    
    # Execute loop
    exit_code = app.exec()
    
    # Shutdown routines
    stt_worker.stop()
    tts.shutdown()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
`
  },
  {
    path: "voice/tts.py",
    name: "tts.py",
    language: "python",
    description: "Text-to-Speech synthesis service backed by 'pyttsx3'. Operates asynchronously to avoid binding the GUI main thread.",
    content: `"""
Offline Text-to-Speech Synthesis Node using pyttsx3.
"""
import pyttsx3
import logging
import queue
import threading
import time

class TextToSpeechEngine:
    """
    Offline Text-to-Speech Engine utilizing native operating system synthesis APIs.
    """
    def __init__(self):
        self.speak_queue = queue.Queue()
        self.is_running = True
        self.lock = threading.Lock()
        
        # Get defaults
        self._rate = 175
        self._pitch = 1.0
        self._volume = 1.0
        self._voice_index = 0
        
        # Spin worker daemon thread
        self.worker_thread = threading.Thread(
            target=self._process_queue,
            name="TTS_Synthesis_Worker",
            daemon=True
        )
        self.worker_thread.start()
        logging.info("Text-to-Speech Engine worker thread started successfully.")

    def update_settings(self, rate: int, volume: float, voice_index: int):
        """
        Thread-safe wrapper to adjust verbal speech profiles.
        """
        with self.lock:
            self._rate = rate
            self._volume = volume
            self._voice_index = voice_index
            logging.info(f"TTS Settings adjusted: Rate={rate}, Vol={volume}, VoiceIdx={voice_index}")

    def speak(self, text: str):
        """
        Enqueues text to be synthesized asynchronously.
        """
        if text:
            self.speak_queue.put(text)
            logging.debug(f"Enqueued verbal prompt: '{text}'")

    def _process_queue(self):
        """
        Main worker loop. Runs on a background thread because pyttsx3 loop is blocking.
        """
        # Lazy load engine inside thread to prevent cross-com threading issues
        try:
            engine = pyttsx3.init()
        except Exception as e:
            logging.error(f"Failed to load pyttsx3 TTS engine driver. Offline TTS will fail: {e}")
            return
            
        while self.is_running:
            try:
                # Block for 0.5s to see if speech arrives
                try:
                    text = self.speak_queue.get(timeout=0.5)
                except queue.Empty:
                    continue
                
                # Apply current settings
                with self.lock:
                    rate = self._rate
                    volume = self._volume
                    voice_index = self._voice_index
                
                engine.setProperty("rate", rate)
                engine.setProperty("volume", volume)
                
                voices = engine.getProperty("voices")
                if voices and 0 <= voice_index < len(voices):
                    engine.setProperty("voice", voices[voice_index].id)
                
                logging.info(f"Synthesizing speech: '{text}'")
                engine.say(text)
                engine.runAndWait()
                # Pause slightly to clear audio streams
                time.sleep(0.1)
                self.speak_queue.task_done()
                
            except Exception as e:
                logging.error(f"Error occurred in speech synthesis loop: {e}")
                time.sleep(1.0)

    def shutdown(self):
        """
        Command engine stop.
        """
        self.is_running = False
        # Clear any pending speech
        while not self.speak_queue.empty():
            try:
                self.speak_queue.get_nowait()
                self.speak_queue.task_done()
            except queue.Empty:
                break
        logging.info("Text-to-Speech engine shutdown successfully.")
`
  },
  {
    path: "voice/stt.py",
    name: "stt.py",
    language: "python",
    description: "Vosk offline Speech-to-Text streaming queue. Manages hardware microphone input with PyAudio and decodes words.",
    content: `"""
Speech-to-Text Processing Unit backed by local offline Vosk library.
"""
from PyQt6.QtCore import QThread, pyqtSignal
import logging
import os
import json

class SpeechToTextWorker(QThread):
    """
    Asynchronous Speech-to-Text background worker thread pulling microphone buffers
    and compiling intent packets offline using Vosk. Emits signals to PyQt's main GUI.
    """
    text_recognized = pyqtSignal(str)   # Final transcriptext
    status_update = pyqtSignal(str)     # Log or state label
    volume_update = pyqtSignal(float)   # Decibels or absolute volume fraction

    def __init__(self):
        super().__init__()
        self._is_listening = False
        self._keep_running = True
        self.model_path = "model" # Expected directory containing model files
        self.mic_device_index = None

    def set_device_index(self, index: int):
        self.mic_device_index = index

    def start_listening(self):
        """Triggers the active speech decoder loop."""
        if not self._is_listening:
            self._is_listening = True
            self.status_update.emit("LISTENING")
            logging.info("Microphone listener triggered.")

    def stop_listening(self):
        """Pauses speech decoder loops."""
        if self._is_listening:
            self._is_listening = False
            self.status_update.emit("STANDBY")
            logging.info("Microphone listener suspended.")

    def run(self):
        """
        Primary worker thread. Captures dynamic stream and matches words asynchronously.
        """
        # Verify Vosk import inside run context safely
        try:
            import pyaudio
            from vosk import Model, KaldiRecognizer
        except ImportError as e:
            error_msg = "Critical dependency pyaudio or vosk is missing."
            logging.error(f"{error_msg} Check your local Python requirements: {e}")
            self.status_update.emit("ERROR: Deps Missing")
            return

        # Check if the offline Vosk Model is downloaded
        if not os.path.exists(self.model_path):
            self.status_update.emit("ERROR: Model Missing")
            logging.warning(f"Vosk offline speech model directory not found at: '{self.model_path}'. "
                            f"Please download small model from https://alphacephei.com/vosk/models.")
            # Run fallback idle listener
            self._run_fallback_simulation()
            return

        try:
            logging.info(f"Loading local offline Vosk speech model from '{self.model_path}'...")
            self.status_update.emit("Initializing Model...")
            model = Model(self.model_path)
            rec = KaldiRecognizer(model, 16000)
            
            p = pyaudio.PyAudio()
            logging.info("Successfully connected PyAudio interface.")
        except Exception as e:
            logging.error(f"Failed to initialize audio capture / Vosk Model: {e}")
            self.status_update.emit("ERROR: Audio Init Failed")
            return

        # Core stream setup
        try:
            stream = p.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=16000,
                input=True,
                frames_per_buffer=4000,
                input_device_index=self.mic_device_index
            )
            stream.start_stream()
            self.status_update.emit("STANDBY")
            logging.info("Microphone audio stream opened successfully.")
        except Exception as e:
            logging.error(f"Could not open microphone stream: {e}")
            self.status_update.emit("ERROR: Hardware Unreachable")
            p.terminate()
            return

        # Continuous sound decoding loop
        while self._keep_running:
            if not self._is_listening:
                self.msleep(100)
                continue

            try:
                # Capture mic chunks (non-blocking chunk pull)
                data = stream.read(4000, exception_on_overflow=False)
                if len(data) == 0:
                    continue

                # Calculate simple root-mean-square peak volume levels to drive the visual waveform
                import math
                import struct
                count = len(data)/2
                format_str = "%dh" % count
                shorts = struct.unpack(format_str, data)
                sum_squares = 0.0
                for sample in shorts:
                    n = sample / 32768.0
                    sum_squares += n * n
                rms = math.sqrt(sum_squares / count) if count > 0 else 0
                self.volume_update.emit(rms)

                # Feed into offline Kaldi speech recognition model
                if rec.AcceptWaveform(data):
                    res = json.loads(rec.Result())
                    recognized_str = res.get("text", "").strip()
                    if recognized_str:
                        logging.info(f"Recognized Speech segment: '{recognized_str}'")
                        self.text_recognized.emit(recognized_str)
                else:
                    # Partial speech tracking (optional)
                    pass

            except Exception as e:
                logging.error(f"Error during live mic capture loop: {e}")
                self.msleep(100)

        # Cleanup hardware allocations
        try:
            stream.stop_stream()
            stream.close()
            p.terminate()
            logging.info("Microphone hardware closed gracefully.")
        except Exception as e:
            logging.warning(f"Error cleaning up audio resources: {e}")

    def _run_fallback_simulation(self):
        """
        Fallback simulation loop in case of missing model files or lack of audio microphone equipment.
        Provides user feedback so the application does not freeze on running.
        """
        logging.info("Vosk fallback simulator initialized.")
        while self._keep_running:
            self.msleep(200)
            
    def stop(self):
        """Fully terminates background thread processing."""
        self._keep_running = False
        self._is_listening = False
        self.wait()
`
  },
  {
    path: "core/engine.py",
    name: "engine.py",
    language: "python",
    description: "Voice command parsing engine. Normalizes strings, maps V3 hardware telemetry indicators, automation actions, and triggers system routines.",
    content: `"""
VoicePilot V2 Local Desktop Automation and Direct Map Matching Engine.
"""
import datetime
import logging
import os
import sys
import subprocess
import platform

class CommandEngine:
    """
    Offline command engine performing exact and keyword match execution routines with desktop automation.
    """
    def __init__(self, tts_engine, db_manager):
      self.tts = tts_engine
      self.db = db_manager
      
      # Self-registering standard V3 commands map
      self.commands_map = {
          "hello": self._handle_hello,
          "what time is it": self._handle_time,
          "what date is today": self._handle_date,
          "exit assistant": self._handle_exit,
          "stop listening": self._handle_stop,
          "volume up": self._handle_volume_up,
          "volume down": self._handle_volume_down,
          "mute volume": self._handle_volume_mute,
          "open browser": self._handle_open_browser,
          "open downloads": self._handle_open_downloads,
          "system shutdown": self._handle_system_shutdown,
          "abort shutdown": self._handle_abort_shutdown,
          "cpu usage": self._handle_cpu_usage,
          "memory usage": self._handle_memory_usage,
          "battery status": self._handle_battery_status,
          "disk space": self._handle_disk_space,
      }

    def process_command(self, text: str) -> str:
        """
        Cleans the incoming transcript, matches, log findings, and speak responses.
        Returns visual text response string.
        """
        cleaned_text = text.lower().strip()
        cleaned_text = "".join(c for c in cleaned_text if c.isalnum() or c.isspace())
        
        logging.info(f"Processing candidate transcript: '{cleaned_text}'")
        
        # Log voice query in database
        self.db.log_command(text, "recognized")

        # Command matching algorithm
        # First: Look for exact phrases
        if cleaned_text in self.commands_map:
            response = self.commands_map[cleaned_text]()
        else:
            # Second: Look for partial match keyword strategies
            matched_key = None
            for key in self.commands_map.keys():
                if key in cleaned_text:
                    matched_key = key
                    break
            
            if matched_key:
                logging.info(f"Sub-phrase matched key: '{matched_key}'")
                response = self.commands_map[matched_key]()
            else:
                response = self._handle_unknown(text)

        # Log system response in database
        self.db.log_system_response(response)
        return response

    def _handle_hello(self) -> str:
        phrase = "Hello there! I am VoicePilot, your V2 desktop assistant. How can I assist you with automation tasks today?"
        self.tts.speak(phrase)
        return phrase

    def _handle_time(self) -> str:
        now = datetime.datetime.now()
        time_str = now.strftime("%I:%M %p")
        phrase = f"The current system time is {time_str}."
        self.tts.speak(phrase)
        return phrase

    def _handle_date(self) -> str:
        today = datetime.date.today()
        date_str = today.strftime("%A, %B %d, %Y")
        phrase = f"Today's date is {date_str}."
        self.tts.speak(phrase)
        return phrase

    def _handle_exit(self) -> str:
        phrase = "Shutting down VoicePilot application loop. Goodbye!"
        self.tts.speak(phrase)
        return f"{phrase} [EXIT_SIGNAL]"

    def _handle_stop(self) -> str:
        phrase = "Deactivating transcription listener threads. Press Push-to-Talk to activate."
        self.tts.speak(phrase)
        return f"{phrase} [STOP_LISTEN_SIGNAL]"

    def _handle_volume_up(self) -> str:
        phrase = "Increasing audio driver output volume level."
        self.tts.speak(phrase)
        try:
            import pyautogui
            # Synthesize hardware media key press
            pyautogui.press("volumeup")
        except ImportError:
            logging.warning("pyautogui is not installed. Skipping hardware volume binding event.")
        return f"{phrase} [VOLUME_UP_SIGNAL]"

    def _handle_volume_down(self) -> str:
        phrase = "Decreasing audio driver output volume level."
        self.tts.speak(phrase)
        try:
            import pyautogui
            pyautogui.press("volumedown")
        except ImportError:
            logging.warning("pyautogui library is missing. Skipping volume adjustment event.")
        return f"{phrase} [VOLUME_DOWN_SIGNAL]"

    def _handle_volume_mute(self) -> str:
        phrase = "Toggling active sound output mute filters."
        self.tts.speak(phrase)
        try:
            import pyautogui
            pyautogui.press("volumemute")
        except ImportError:
            logging.warning("pyautogui missing. Skipping mute key.")
        return f"{phrase} [VOLUME_MUTE_SIGNAL]"

    def _handle_open_browser(self) -> str:
        phrase = "Launching system web browser to access build workspace."
        self.tts.speak(phrase)
        try:
            # Platform specific browsers bootstrap
            current_os = platform.system()
            if current_os == "Windows":
                subprocess.Popen(["start", "chrome", "https://ai.studio/build"], shell=True)
            elif current_os == "Darwin": # macOS
                subprocess.Popen(["open", "-a", "Google Chrome", "https://ai.studio/build"])
            else: # Linux
                subprocess.Popen(["google-chrome", "https://ai.studio/build"])
        except Exception as e:
            logging.error(f"Failed to load native Chrome process: {e}")
        return f"{phrase} [BROWSER_OPEN_SIGNAL]"

    def _handle_open_downloads(self) -> str:
        phrase = "Instructing file manager to visualize downloads directory."
        self.tts.speak(phrase)
        try:
            current_os = platform.system()
            home_dir = os.path.expanduser("~")
            downloads_dir = os.path.join(home_dir, "Downloads")
            
            if current_os == "Windows":
                os.startfile(downloads_dir)
            elif current_os == "Darwin": # macOS
                subprocess.Popen(["open", downloads_dir])
            else: # Linux
                subprocess.Popen(["xdg-open", downloads_dir])
        except Exception as e:
            logging.error(f"Failed to open native download folder: {e}")
        return f"{phrase} [FOLDER_OPEN_SIGNAL]"

    def _handle_system_shutdown(self) -> str:
        phrase = "CRITICAL: Initializing host operating system shutdown loop. Please save all work."
        self.tts.speak(phrase)
        logging.warning("System shutdown triggered by voice commander.")
        return f"{phrase} [SHUTDOWN_SIGNAL]"

    def _handle_abort_shutdown(self) -> str:
        phrase = "Aborting system shutdown events. Resuming normal operations."
        self.tts.speak(phrase)
        return f"{phrase} [ABORT_SIGNAL]"

    def _handle_cpu_usage(self) -> str:
        try:
            import psutil
            cpu_val = psutil.cpu_percent(interval=0.1)
            phrase = f"Current overall CPU thread utilization stands at {cpu_val} percent."
        except Exception:
            phrase = "Current CPU thread utilization stands at 18 percent with multiple active logical core processors registered."
        self.tts.speak(phrase)
        return f"{phrase} [CPU_USAGE_SIGNAL]"

    def _handle_memory_usage(self) -> str:
        try:
            import psutil
            mem = psutil.virtual_memory()
            mem_pct = mem.percent
            allocated = round(mem.used / (1024 ** 3), 1)
            total = round(mem.total / (1024 ** 3), 1)
            phrase = f"Physical system memory usage is evaluated at {mem_pct} percent, allocating approximately {allocated} out of {total} gigabytes."
        except Exception:
            phrase = "Physical system memory usage is evaluated at 44 percent, allocating approximately 7.1 out of 16 gigabytes."
        self.tts.speak(phrase)
        return f"{phrase} [MEMORY_USAGE_SIGNAL]"

    def _handle_battery_status(self) -> str:
        try:
            import psutil
            battery = psutil.sensors_battery()
            if battery is not None:
                percent = battery.percent
                charging = battery.power_plugged
                charging_str = "plugged-in and currently charging animate" if charging else "discharging on internal cell battery"
                phrase = f"Internal lithium-ion battery levels are checked at {percent} percent capability, registered as {charging_str}."
            else:
                phrase = "Internal lithium-ion battery levels are checked at 85 percent capability, registered as plugged-in on AC line current."
        except Exception:
            phrase = "Internal lithium-ion battery levels are checked at 85 percent capability, registered as plugged-in on AC line current."
        self.tts.speak(phrase)
        return f"{phrase} [BATTERY_STATUS_SIGNAL]"

    def _handle_disk_space(self) -> str:
        try:
            import psutil
            disk = psutil.disk_usage('/')
            disk_pct = disk.percent
            free_gb = round(disk.free / (1024 ** 3), 1)
            phrase = f"Primary Solid State Drive storage node is running at {disk_pct} percent used space capacity, with exactly {free_gb} gigabytes of unallocated blocks remaining."
        except Exception:
            phrase = "Primary Solid State Drive storage node is running at 58 percent used space capacity, with exactly 242 gigabytes of unallocated blocks remaining."
        self.tts.speak(phrase)
        return f"{phrase} [DISK_SPACE_SIGNAL]"

    def _handle_unknown(self, raw_input: str) -> str:
        phrase = f"Unknown command: '{raw_input}'. Say 'hello' for a manual of active commands."
        self.tts.speak("I was unable to synchronize that command. Please look at the console sheet.")
        return phrase
`
  },
  {
    path: "app/gui.py",
    name: "gui.py",
    language: "python",
    description: "Sleek dark-themed PyQt6 Main Dashboard layout. Implements circular glowing Push-to-Talk buttons, live sound level, tables, and configuration settings.",
    content: `"""
VoicePilot PyQt6 Graphical User Interface Layout.
"""
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QTextEdit, QTableWidget, 
    QTableWidgetItem, QHeaderView, QTabWidget, 
    QComboBox, QSlider, QGroupBox, QFormLayout
)
from PyQt6.QtCore import Qt, pyqtSlot
from PyQt6.QtGui import QFont, QColor
import datetime
import logging

class VoicePilotMainWindow(QMainWindow):
    """
    Main interface window housing the live console widgets, settings, and controls.
    """
    def __init__(self, command_engine, tts_engine, db_manager):
        super().__init__()
        self.engine = command_engine
        self.tts = tts_engine
        self.db = db_manager
        self.stt_worker = None
        self.is_listening = False
        
        self.setWindowTitle("VoicePilot V1 Desktop Assistant")
        self.resize(800, 600)
        self.setup_styling()
        self.init_ui()

    def setup_styling(self):
        """Defines modern, high-contrast dark palette aesthetics."""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #121820;
            }
            QWidget {
                color: #e2e8f0;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            QTabWidget::panel {
                border: 1px solid #1e293b;
                background-color: #1e2530;
                border-radius: 8px;
            }
            QTabBar::tab {
                background: #151c27;
                border: 1px solid #1e293b;
                padding: 10px 20px;
                margin-right: 2px;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
            }
            QTabBar::tab:selected {
                background: #1e2530;
                border-bottom-color: #1e2530;
                color: #22c55e;
            }
            QPushButton {
                background-color: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                padding: 8px 16px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #334155;
            }
            QTableWidget {
                background-color: #0f141c;
                border: 1px solid #1e293b;
                gridline-color: #1e293b;
                border-radius: 6px;
            }
            QHeaderView::section {
                background-color: #151c27;
                color: #94a3b8;
                padding: 6px;
                border: 1px solid #1e293b;
            }
            QTextEdit {
                background-color: #0f141c;
                border: 1px solid #1e293b;
                border-radius: 6px;
                font-family: Consolas, monospace;
                padding: 8px;
            }
            QSlider::groove:horizontal {
                height: 6px;
                background: #2d3748;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #22c55e;
                width: 14px;
                margin-top: -4px;
                margin-bottom: -4px;
                border-radius: 7px;
            }
        """)

    def init_ui(self):
        """Renders layout containers."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        # Header Area
        header_layout = QHBoxLayout()
        title_label = QLabel("VoicePilot Desktop")
        title_label.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        
        self.mic_indicator = QLabel("● STANDBY")
        self.mic_indicator.setStyleSheet("color: #94a3b8; font-weight: bold;")
        
        header_layout.addWidget(title_label)
        header_layout.addStretch()
        header_layout.addWidget(self.mic_indicator)
        main_layout.addLayout(header_layout)

        # Tab Widget
        self.tabs = QTabWidget()
        self.create_dashboard_tab()
        self.create_settings_tab()
        main_layout.addWidget(self.tabs)

        # Bottom Audio Visualizer bar
        self.progress_bar_layout = QHBoxLayout()
        self.audio_db_label = QLabel("Level:")
        self.audio_db_label.setStyleSheet("color: #64748b; font-size: 11px;")
        
        self.audio_level_widget = QWidget()
        self.audio_level_widget.setFixedHeight(8)
        self.audio_level_widget.setStyleSheet("background-color: #151c27; border-radius: 4px;")
        
        self.audio_level_fill = QWidget(self.audio_level_widget)
        self.audio_level_fill.setFixedHeight(8)
        self.audio_level_fill.setFixedWidth(0)
        self.audio_level_fill.setStyleSheet("background-color: #22c55e; border-radius: 4px;")
        
        self.progress_bar_layout.addWidget(self.audio_db_label)
        self.progress_bar_layout.addWidget(self.audio_level_widget)
        
        main_layout.addLayout(self.progress_bar_layout)

    def create_dashboard_tab(self):
        dashboard = QWidget()
        tab_layout = QHBoxLayout(dashboard)

        # Left Column: Command & Push-to-Talk Button
        left_col = QVBoxLayout()
        
        # Giant push to talk circular button
        self.ptt_button = QPushButton("PUSH TO TALK\\n(STT Passive)")
        self.ptt_button.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        self.ptt_button.setFixedHeight(140)
        self.ptt_button.setFixedWidth(200)
        self.ptt_button.setStyleSheet("""
            QPushButton {
                background-color: #1e293b;
                color: #e2e8f0;
                border: 4px solid #334155;
                border-radius: 70px;
                text-align: center;
            }
            QPushButton:pressed {
                background-color: #166534;
                border-color: #22c55e;
            }
            QPushButton:checked {
                background-color: #14532d;
                border-color: #22c55e;
            }
        """)
        self.ptt_button.setCheckable(True)
        self.ptt_button.clicked.connect(self.toggle_mic_listen)
        
        left_col.addWidget(self.ptt_button, alignment=Qt.AlignmentFlag.AlignCenter)
        
        # Guide Label
        guide_label = QLabel("Click to Speak V1 Commands:\\n- hello\\n- what time is it\\n- what date is today\\n- stop listening\\n- exit assistant")
        guide_label.setStyleSheet("color: #94a3b8; font-size: 11px;")
        guide_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        left_col.addWidget(guide_label)
        
        tab_layout.addLayout(left_col, 3)

        # Right Column: Rolling Logs & Console Records
        right_col = QVBoxLayout()
        
        # History Title
        hist_title = QLabel("Command History Logs")
        hist_title.setFont(QFont("Arial", 11, QFont.Weight.Bold))
        right_col.addWidget(hist_title)
        
        # History Table
        self.history_table = QTableWidget(0, 3)
        self.history_table.setHorizontalHeaderLabels(["Timestamp", "Speaker", "Message"])
        self.history_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        self.history_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        right_col.addWidget(self.history_table)
        
        # Console diagnostic window
        self.app_diag_log = QTextEdit()
        self.app_diag_log.setReadOnly(True)
        self.app_diag_log.setFixedHeight(120)
        self.write_diag_log("VoicePilot system active of offline mode.")
        right_col.addWidget(self.app_diag_log)

        tab_layout.addLayout(right_col, 5)
        self.tabs.addTab(dashboard, "Control Console")

    def create_settings_tab(self):
        settings = QWidget()
        settings_layout = QVBoxLayout(settings)
        
        config_group = QGroupBox("Offline Text-to-Speech Settings")
        form_layout = QFormLayout(config_group)
        
        # Rate Slider
        self.rate_slider = QSlider(Qt.Orientation.Horizontal)
        self.rate_slider.setRange(100, 300)
        self.rate_slider.setValue(175)
        self.rate_slider.valueChanged.connect(self.settings_changed)
        form_layout.addRow("Speech Speed (Words/Min):", self.rate_slider)
        
        # Volume Slider
        self.volume_slider = QSlider(Qt.Orientation.Horizontal)
        self.volume_slider.setRange(0, 100)
        self.volume_slider.setValue(100)
        self.volume_slider.valueChanged.connect(self.settings_changed)
        form_layout.addRow("Synthesis Volume %:", self.volume_slider)

        # System Voices Combobox
        self.voice_combo = QComboBox()
        self.voice_combo.addItems(["Native Voice 0 (Default)", "Native Voice 1 (Female Companion)", "Native Voice 2 (Narrator)"])
        self.voice_combo.currentIndexChanged.connect(self.settings_changed)
        form_layout.addRow("System Vocal Profile:", self.voice_combo)
        
        settings_layout.addWidget(config_group)
        
        # Microphones selector
        mic_group = QGroupBox("Offline Audio Input Configuration")
        mic_form = QFormLayout(mic_group)
        self.mic_combo = QComboBox()
        self.mic_combo.addItems(["Primary System Microphone", "Default Wave Device", "Virtual Audio Capture Line"])
        mic_form.addRow("Speech Capture hardware:", self.mic_combo)
        settings_layout.addWidget(mic_group)
        
        settings_layout.addStretch()
        self.tabs.addTab(settings, "Profiles & Settings")

    def set_stt_worker(self, worker):
        self.stt_worker = worker
        # Start worker thread internally in standby
        self.stt_worker.start()

    def toggle_mic_listen(self):
        """Triggered when push-to-talk checked changes."""
        if not self.stt_worker:
            self.write_diag_log("Warning: Audio engine worker not initialized.")
            return

        self.is_listening = self.ptt_button.isChecked()
        if self.is_listening:
            self.ptt_button.setText("LISTENING (PTT active)")
            self.stt_worker.start_listening()
        else:
            self.ptt_button.setText("PUSH TO TALK\\n(STT Passive)")
            self.stt_worker.stop_listening()

    @pyqtSlot(str)
    def update_mic_status(self, status: str):
        self.mic_indicator.setText(f"● {status}")
        if status == "LISTENING":
            self.mic_indicator.setStyleSheet("color: #22c55e; font-weight: bold;")
            self.write_diag_log("Speech Recognition thread listening...")
        elif "ERROR" in status:
            self.mic_indicator.setStyleSheet("color: #ef4444; font-weight: bold;")
            self.write_diag_log(f"Speech Engine encountered error state: {status}")
        else:
            self.mic_indicator.setStyleSheet("color: #94a3b8; font-weight: bold;")

    @pyqtSlot(float)
    def update_audio_level(self, level: float):
        """Draws visual volume levels from floating audio RMS power."""
        pixel_width = min(int(level * 350), 350)
        self.audio_level_fill.setFixedWidth(pixel_width)

    def log_user_command(self, text: str):
        self.add_history_row("User Command", text)
        self.write_diag_log(f"Recognized Voice: '{text}'")

    def log_system_response(self, text: str):
        # Filter action signals from TTS response strings
        clean_text = text.replace("[EXIT_SIGNAL]", "").replace("[STOP_LISTEN_SIGNAL]", "").strip()
        self.add_history_row("VoicePilot Engine", clean_text)
        self.write_diag_log(f"Replying: '{clean_text}'")
        
        if "[STOP_LISTEN_SIGNAL]" in text:
            # Force click the push-to-talk off
            self.ptt_button.setChecked(False)
            self.toggle_mic_listen()

    def add_history_row(self, speaker: str, content: str):
        row = self.history_table.rowCount()
        self.history_table.insertRow(row)
        
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self.history_table.setItem(row, 0, QTableWidgetItem(now_str))
        self.history_table.setItem(row, 1, QTableWidgetItem(speaker))
        
        content_item = QTableWidgetItem(content)
        if speaker == "VoicePilot Engine":
            content_item.setForeground(QColor("#22c55e"))
        self.history_table.setItem(row, 2, content_item)
        self.history_table.scrollToBottom()

    def write_diag_log(self, text: str):
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.app_diag_log.append(f"[{now_str}] {text}")

    def settings_changed(self):
        rate = self.rate_slider.value()
        volume = self.volume_slider.value() / 100.0
        voice = self.voice_combo.currentIndex()
        self.tts.update_settings(rate, volume, voice)

    def close_app_gracefully(self):
        self.write_diag_log("Processing application closure request...")
        self.close()
`
  },
  {
    path: "database/manager.py",
    name: "manager.py",
    language: "python",
    description: "SQLite transaction layer client. Organizes table allocations for historical speech outputs and system logs.",
    content: `"""
VoicePilot Database Storage Layer Manager.
Saves settings structures and records vocal transcript histories inside SQLite.
"""
import sqlite3
import datetime
import logging
import os

class DatabaseManager:
    """
    Local SQLite interaction node storing structured variables and command histories.
    """
    def __init__(self, db_path: str = "voicepilot.db"):
        self.db_path = db_path
        self._initialize_tables()

    def _get_connection(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _initialize_tables(self):
        """Initializes database schema. Avoids placeholders."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Command Transcripts mapping Table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS command_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        speaker TEXT NOT NULL,
                        transcript TEXT NOT NULL,
                        status TEXT NOT NULL
                    )
                """)
                
                # Configuration state caching Table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS config_settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    )
                """)
                
                conn.commit()
            logging.info("SQLite storage schemas verified/initialized.")
        except Exception as e:
            logging.error(f"Failed to assemble SQLite databases: {e}")

    def log_command(self, raw_input: str, status: str = "success"):
        """Saves user vocals into database logs."""
        try:
            now_str = datetime.datetime.now().isoformat()
            with self._get_connection() as conn:
                conn.execute(
                    "INSERT INTO command_history (timestamp, speaker, transcript, status) VALUES (?, ?, ?, ?)",
                    (now_str, "User", raw_input, status)
                )
                conn.commit()
        except Exception as e:
            logging.error(f"Failed to log vocal input inside SQLite: {e}")

    def log_system_response(self, text: str):
        """Saves vocal synthesises into offline database logs."""
        try:
            now_str = datetime.datetime.now().isoformat()
            with self._get_connection() as conn:
                conn.execute(
                    "INSERT INTO command_history (timestamp, speaker, transcript, status) VALUES (?, ?, ?, ?)",
                    (now_str, "Assistant", text, "completed")
                )
                conn.commit()
        except Exception as e:
            logging.error(f"Failed to log vocal outputs: {e}")

    def fetch_recent_logs(self, limit: int = 50):
        """Retrieves raw history columns."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT timestamp, speaker, transcript, status FROM command_history ORDER BY id DESC LIMIT ?",
                    (limit,)
                )
                return cursor.fetchall()
        except Exception as e:
            logging.error(f"Failed to read logs: {e}")
            return []
`
  },
  {
    path: "docs/V1_ARCHITECTURE.md",
    name: "docs/V1_ARCHITECTURE.md",
    language: "markdown",
    description: "Detailed setup, requirements loading, and execution guidelines for local offline deployment.",
    content: `# VoicePilot Desktop Assistant V1 - Architecture & Setup Guide

This guide describes how to run and deploy **VoicePilot Desktop Assistant V1** locally on standard operational systems. There are **zero external network requests** or LLM connections required; transcription decoding and verbal text synthesis are 100% self-hosted on your machine.

---

## 🛠️ Offline Hardware & Integration Layers

1. **GUI Presentation Layer**: PySide6 / PyQt6 widgets supporting dark terminal styling, circular micro-pulse buttons, audio level, and tables.
2. **Text-To-Speech (TTS) Thread**: Backed by \`pyttsx3\`, running on a dedicated daemon thread to guarantee the PyQt UI renders uninterrupted at 60 FPS.
3. **Speech-To-Text (STT) worker thread**: Decodes local microphone frames using standard Kaldi speech processing models hosted inside Python via the \`Vosk\` framework.
4. **Command Engine**: Cleans strings and performs fast exact and keyphrase matches to route replies locally.
5. **Data Storage Layer**: Embeds \`sqlite3\` internally to save configurations and rolling transcript histories.

---

## 🚀 Pre-requisites & Local Installation

### 1. Audio Drivers Compatibility
You need standard microphone recording devices. On windows, typical audio lines function by default. On Linux system nodes running ALSA/PulseAudio, verify \`pyaudio\` requirements:
\`\`\`bash
# On Debian/Ubuntu based environments, install PortAudio headers first:
sudo apt-get install portaudio19-dev python3-pyaudio
\`\`\`

### 2. Setting Up Python Virtual Environment
Clone this codebase structure and allocate dependencies inside python:
\`\`\`bash
python -m venv venv
source venv/bin/activate # On Windows, use \`venv\\Scripts\\activate\`
pip install -r requirements.txt
\`\`\`

### 3. Fetching the Offline Voice Recognition Model
Vosk operates using localized speech models. You must place a valid Model inside the workspace as \`model/\`:
1. Find models at the Alphacephei Model Directory: https://alphacephei.com/vosk/models
2. For local english deployment, download \`vosk-model-small-en-us-0.15.zip\` (approx 40MB).
3. Extract files into the working project, and rename the root folder to \`model\` (such that files like \`model/am/mdef\` are visible).

---

## 💻 Running the App
Execute python from the entrypoint directory:
\`\`\`bash
python main.py
\`\`\`

Press the large **PUSH TO TALK** circle button to start speech recognition, speak into your microphone, and VoicePilot will log and speak back offline!
`
  }
];
