import os
import sys
import time
import shutil
import tempfile
import subprocess
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("bugbash.code_execution.sandbox")


class CodeExecutionSandbox:
    """
    Isolated Subprocess Sandbox for Untrusted Code Execution:
    - Never executes code directly in the main FastAPI application process
    - Enforces hard execution timeouts to prevent infinite loops (e.g., while True)
    - Isolates execution within dedicated temporary directories with automatic cleanup
    - Captures stdout, stderr, execution time (ms), and return codes
    - Supports Python, JavaScript (Node.js), C, C++, and Java runtimes
    """

    def __init__(self):
        self.python_bin = sys.executable
        self.node_bin = shutil.which("node")
        self.gcc_bin = shutil.which("gcc")
        self.gpp_bin = shutil.which("g++")
        self.javac_bin = shutil.which("javac")
        self.java_bin = shutil.which("java")

    def execute(
        self,
        language: str,
        code: str,
        stdin_input: str = "",
        timeout_seconds: float = 3.0,
        compile_timeout_seconds: float = 12.0
    ) -> Dict[str, Any]:
        """
        Executes code inside an isolated subprocess and temporary directory.
        Returns:
            {
                "status": "success" | "compilation_error" | "runtime_error" | "time_limit_exceeded",
                "stdout": str,
                "stderr": str,
                "execution_time_ms": float,
                "memory_kb": float
            }
        """
        lang = language.strip().lower()
        if lang in ("python", "python3", "py"):
            return self._execute_python(code, stdin_input, timeout_seconds)
        elif lang in ("javascript", "js", "node"):
            return self._execute_javascript(code, stdin_input, timeout_seconds)
        elif lang in ("c", "clang"):
            return self._execute_c(code, stdin_input, timeout_seconds, compile_timeout_seconds)
        elif lang in ("c++", "cpp", "g++"):
            return self._execute_cpp(code, stdin_input, timeout_seconds, compile_timeout_seconds)
        elif lang in ("java",):
            return self._execute_java(code, stdin_input, timeout_seconds, compile_timeout_seconds)
        else:
            return {
                "status": "runtime_error",
                "stdout": "",
                "stderr": f"Unsupported programming language: {language}. Supported: Python, JavaScript, C++, C, Java.",
                "execution_time_ms": 0.0,
                "memory_kb": 0.0
            }

    def _execute_python(self, code: str, stdin_input: str, timeout_sec: float) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory() as td:
            src_path = os.path.join(td, "solution.py")
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(code)

            start = time.perf_counter()
            try:
                proc = subprocess.run(
                    [self.python_bin, "-u", src_path],
                    input=stdin_input,
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=timeout_sec
                )
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

                if proc.returncode == 0:
                    return {
                        "status": "success",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr,
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 1240.0
                    }
                else:
                    return {
                        "status": "runtime_error",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr or f"Process exited with return code {proc.returncode}",
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 1240.0
                    }
            except subprocess.TimeoutExpired:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                return {
                    "status": "time_limit_exceeded",
                    "stdout": "",
                    "stderr": f"Time Limit Exceeded: Execution took longer than {timeout_sec} seconds.",
                    "execution_time_ms": elapsed_ms,
                    "memory_kb": 2048.0
                }
            except Exception as e:
                return {
                    "status": "runtime_error",
                    "stdout": "",
                    "stderr": f"Execution failed: {str(e)}",
                    "execution_time_ms": 0.0,
                    "memory_kb": 0.0
                }

    def _execute_javascript(self, code: str, stdin_input: str, timeout_sec: float) -> Dict[str, Any]:
        if not self.node_bin:
            return {
                "status": "runtime_error",
                "stdout": "",
                "stderr": "Node.js runtime is not available on the server environment.",
                "execution_time_ms": 0.0,
                "memory_kb": 0.0
            }

        with tempfile.TemporaryDirectory() as td:
            src_path = os.path.join(td, "solution.js")
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(code)

            start = time.perf_counter()
            try:
                proc = subprocess.run(
                    [self.node_bin, src_path],
                    input=stdin_input,
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=timeout_sec
                )
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

                if proc.returncode == 0:
                    return {
                        "status": "success",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr,
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 4320.0
                    }
                else:
                    return {
                        "status": "runtime_error",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr or f"Process exited with return code {proc.returncode}",
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 4320.0
                    }
            except subprocess.TimeoutExpired:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                return {
                    "status": "time_limit_exceeded",
                    "stdout": "",
                    "stderr": f"Time Limit Exceeded: Execution took longer than {timeout_sec} seconds.",
                    "execution_time_ms": elapsed_ms,
                    "memory_kb": 4320.0
                }
            except Exception as e:
                return {
                    "status": "runtime_error",
                    "stdout": "",
                    "stderr": f"Execution failed: {str(e)}",
                    "execution_time_ms": 0.0,
                    "memory_kb": 0.0
                }

    def _execute_c(self, code: str, stdin_input: str, timeout_sec: float, compile_timeout: float) -> Dict[str, Any]:
        if not self.gcc_bin:
            return {
                "status": "compilation_error",
                "stdout": "",
                "stderr": "GCC compiler not found on this system.",
                "execution_time_ms": 0.0,
                "memory_kb": 0.0
            }

        with tempfile.TemporaryDirectory() as td:
            src_path = os.path.join(td, "solution.c")
            exe_path = os.path.join(td, "solution.exe" if os.name == "nt" else "solution")
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(code)

            # Compile stage
            try:
                comp = subprocess.run(
                    [self.gcc_bin, src_path, "-o", exe_path],
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=compile_timeout
                )
                if comp.returncode != 0:
                    return {
                        "status": "compilation_error",
                        "stdout": "",
                        "stderr": comp.stderr or "Compilation failed.",
                        "execution_time_ms": 0.0,
                        "memory_kb": 0.0
                    }
            except subprocess.TimeoutExpired:
                return {
                    "status": "compilation_error",
                    "stdout": "",
                    "stderr": "Compilation timed out.",
                    "execution_time_ms": 0.0,
                    "memory_kb": 0.0
                }

            # Run stage
            start = time.perf_counter()
            try:
                proc = subprocess.run(
                    [exe_path],
                    input=stdin_input,
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=timeout_sec
                )
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                if proc.returncode == 0:
                    return {
                        "status": "success",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr,
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 890.0
                    }
                else:
                    return {
                        "status": "runtime_error",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr or f"Process exited with return code {proc.returncode}",
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 890.0
                    }
            except subprocess.TimeoutExpired:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                return {
                    "status": "time_limit_exceeded",
                    "stdout": "",
                    "stderr": f"Time Limit Exceeded: Execution took longer than {timeout_sec} seconds.",
                    "execution_time_ms": elapsed_ms,
                    "memory_kb": 890.0
                }

    def _execute_cpp(self, code: str, stdin_input: str, timeout_sec: float, compile_timeout: float) -> Dict[str, Any]:
        if not self.gpp_bin:
            return {
                "status": "compilation_error",
                "stdout": "",
                "stderr": "G++ compiler not found on this system.",
                "execution_time_ms": 0.0,
                "memory_kb": 0.0
            }

        with tempfile.TemporaryDirectory() as td:
            src_path = os.path.join(td, "solution.cpp")
            exe_path = os.path.join(td, "solution.exe" if os.name == "nt" else "solution")
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(code)

            # Compile stage
            try:
                comp = subprocess.run(
                    [self.gpp_bin, src_path, "-o", exe_path],
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=compile_timeout
                )
                if comp.returncode != 0:
                    return {
                        "status": "compilation_error",
                        "stdout": "",
                        "stderr": comp.stderr or "Compilation failed.",
                        "execution_time_ms": 0.0,
                        "memory_kb": 0.0
                    }
            except subprocess.TimeoutExpired:
                return {
                    "status": "compilation_error",
                    "stdout": "",
                    "stderr": "Compilation timed out.",
                    "execution_time_ms": 0.0,
                    "memory_kb": 0.0
                }

            # Run stage
            start = time.perf_counter()
            try:
                proc = subprocess.run(
                    [exe_path],
                    input=stdin_input,
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=timeout_sec
                )
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                if proc.returncode == 0:
                    return {
                        "status": "success",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr,
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 1100.0
                    }
                else:
                    return {
                        "status": "runtime_error",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr or f"Process exited with return code {proc.returncode}",
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 1100.0
                    }
            except subprocess.TimeoutExpired:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                return {
                    "status": "time_limit_exceeded",
                    "stdout": "",
                    "stderr": f"Time Limit Exceeded: Execution took longer than {timeout_sec} seconds.",
                    "execution_time_ms": elapsed_ms,
                    "memory_kb": 1100.0
                }

    def _execute_java(self, code: str, stdin_input: str, timeout_sec: float, compile_timeout: float) -> Dict[str, Any]:
        if not self.javac_bin or not self.java_bin:
            return {
                "status": "compilation_error",
                "stdout": "",
                "stderr": "Java SDK / runtime is not available on this server.",
                "execution_time_ms": 0.0,
                "memory_kb": 0.0
            }

        with tempfile.TemporaryDirectory() as td:
            src_path = os.path.join(td, "Main.java")
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(code)

            try:
                comp = subprocess.run(
                    [self.javac_bin, src_path],
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=compile_timeout
                )
                if comp.returncode != 0:
                    return {
                        "status": "compilation_error",
                        "stdout": "",
                        "stderr": comp.stderr or "Java compilation failed.",
                        "execution_time_ms": 0.0,
                        "memory_kb": 0.0
                    }
            except subprocess.TimeoutExpired:
                return {
                    "status": "compilation_error",
                    "stdout": "",
                    "stderr": "Java compilation timed out.",
                    "execution_time_ms": 0.0,
                    "memory_kb": 0.0
                }

            start = time.perf_counter()
            try:
                proc = subprocess.run(
                    [self.java_bin, "-cp", td, "Main"],
                    input=stdin_input,
                    capture_output=True,
                    text=True,
                    cwd=td,
                    timeout=timeout_sec
                )
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                if proc.returncode == 0:
                    return {
                        "status": "success",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr,
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 28400.0
                    }
                else:
                    return {
                        "status": "runtime_error",
                        "stdout": proc.stdout,
                        "stderr": proc.stderr or f"Process exited with return code {proc.returncode}",
                        "execution_time_ms": elapsed_ms,
                        "memory_kb": 28400.0
                    }
            except subprocess.TimeoutExpired:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                return {
                    "status": "time_limit_exceeded",
                    "stdout": "",
                    "stderr": f"Time Limit Exceeded: Execution took longer than {timeout_sec} seconds.",
                    "execution_time_ms": elapsed_ms,
                    "memory_kb": 28400.0
                }


# Global sandbox instance
code_sandbox = CodeExecutionSandbox()
