# Makao AI - Reinforcement Learning Module

This directory contains the complete pipeline for training, evaluating, and exporting a Reinforcement Learning (RL) agent for the card game Makao. The AI is trained using **Proximal Policy Optimization (PPO)** with **Action Masking** to ensure valid moves.

## 📂 Project Structure

- **`makao_game.py`**: Core game logic (Python port of Java backend).
- **`makao_env.py`**: Gymnasium environment for RL training (Self-Play setup).
- **`train.py`**: Script to train the PPO model.
- **`evaluate.py`**: Script to test the trained model against a random agent.
- **`play_vs_ai.py`**: Interactive console game to play against the bot.
- **`export_onnx.py`**: Exports the trained model to ONNX format for Java integration.
- **`requirements.txt`**: Python dependencies.

## 🚀 Setup & Installation

**Important:** Use **Python 3.10** to ensure compatibility with ONNX and PyTorch.

1. **Create Virtual Environment:**

   ```powershell
   # Remove old venv if exists
   Remove-Item -Recurse -Force venv

   # Create new venv with Python 3.10
   py -3.10 -m venv venv
   ```

2. **Activate Environment:**

   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

3. **Install Dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

## 🧠 Training the Model

To train the AI agent from scratch:

```powershell
python train.py
```

- This will train the agent for 1,000,000 timesteps (approx. 30-60 mins).
- The model will be saved as `makao_ppo_model.zip`.

## 📊 Evaluation & Testing

To check the win rate against a random player:

```powershell
python evaluate.py
```

To play a game against the bot yourself in the console:

```powershell
python play_vs_ai.py
```

## 📦 Exporting to Java (ONNX)

To use the model in the Java backend, it must be exported to ONNX format.

1. **Run the export script:**

   ```powershell
   python export_onnx.py
   ```

   _Note: This script automatically downgrades the IR version to ensure compatibility with Java ONNX Runtime._

2. **Copy the model to the backend:**
   The file `makao_model.onnx` must be placed in the backend resources:

   ```powershell
   Copy-Item makao_model.onnx ../backend/control/src/main/resources/onnx/ -Force
   ```

3. **Rebuild the Backend:**
   You must rebuild the Java project so the new resource file is included in the build:
   ```powershell
   cd ../backend
   mvn clean install
   ```

## 🛠️ Troubleshooting

- **"Unsupported model IR version"**: Ensure you run `export_onnx.py` which applies the compatibility fix (IR Version 8).
- **"Session is null" in Java**: The ONNX file is missing from `target/classes`. Run `mvn clean install` to force a resource update.
- **"ModuleNotFoundError"**: Ensure you have activated the virtual environment (`venv`) before running scripts.
