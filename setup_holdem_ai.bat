@echo off
echo Setting up Holdem AI...

rem 0. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH.
    echo Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

cd ai/holdem

rem 1. Clean Virtual Environment
if exist venv (
    echo Removing old virtual environment...
    rmdir /s /q venv
)

echo Creating virtual environment using Python 3.13...
py -3.13 -m venv venv
if %errorlevel% neq 0 (
    echo Error: Failed to create venv with Python 3.13.
    echo Please ensure you have Python 3.13 installed - e.g. via 'winget install Python.Python.3.13'.
    pause
    exit /b 1
)

rem 2. Install dependencies
call venv\Scripts\activate
echo Installing dependencies (torch, numpy, onnx, onnxscript)...
pip install torch numpy onnx onnxscript

rem 3. Export ONNX
echo Exporting model...
set PYTHONIOENCODING=utf-8
python export_onnx.py

rem 4. Copy to Backend
if exist holdem_model.onnx (
    echo Copying model to Java resources...
    copy /Y holdem_model.onnx ..\..\backend\control\src\main\resources\onnx\
    if exist holdem_model.onnx.data (
        echo Copying external data file...
        copy /Y holdem_model.onnx.data ..\..\backend\control\src\main\resources\onnx\
    )
    echo.
    echo SUCCESS: Model exported and copied.
    echo Please RESTART the Java Backend Application now.
) else (
    echo.
    echo ERROR: holdem_model.onnx was not generated. Check python errors above.
)

pause
