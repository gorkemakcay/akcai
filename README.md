<div align="center">
  <h1>🎼 akcai (Loop Orchestra)</h1>
  <p><b>An Autonomous Multi-Agent Orchestrator for Seamless Coding & Testing</b></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
  [![Docker](https://img.shields.io/badge/Docker-Native-blue.svg)](https://www.docker.com/)
  <br/>
</div>

---

## 🌟 What is `akcai`?

`akcai` (formerly Loop Orchestra) is a robust, autonomous orchestration layer designed to manage AI coding agents (like Claude Code, Codex, etc.). 

Instead of letting AI agents randomly override your files or hallucinate code without testing, `akcai` assigns tasks to **isolated Git Worktrees**, provisions **ephemeral Docker databases**, and strictly enforces **Quality Gates** (tests) before ever merging code into your `develop` branch.

It is built for the **"Night Shift"**: you queue up your `tasks.json`, go to sleep, and let `akcai` safely build, test, and merge features while pacing its token usage.

---

## ✨ Key Features

- 🌳 **Worktree Manager (`core/worktree-manager.js`)**
  Allocates a lock-free, isolated Git worktree slot for every active task. Multiple agents can work in parallel without file conflicts.
  
- 🐳 **Ephemeral Docker DBs**
  If a task requires a database (`db_required: true`), `akcai` instantly spins up a local, isolated Docker container just for that specific worktree slot. When the task is done, the DB is destroyed.
  
- 🛡️ **Quota Guard (`core/quota-guard.js`)**
  Monitors token usage across different AI tiers. Features a **Dynamic Quota Pacing** system: if you hit a hard API limit at 3 AM, it pauses execution and safely "sleeps" until the quota resets, preventing half-finished tasks.
  
- 🚦 **Quality Gates & Fail-Closed Merging**
  Code is **never** merged blindly. Agents must pass deterministic tests (e.g., `npm run test`) inside their isolated slots. If they fail after a set `max_retries`, the task is escalated to a smarter agent or safely "dead-lettered" for human review.
  
- 🎭 **Specialized Subagent Prompts**
  Includes battle-tested system prompts for different AI personas:
  - 🧠 **Architect (Tier 3):** Breaks down epics into sub-tasks and defines strict tests.
  - 👷 **Implementer (Tier 2):** Writes the feature code and passes tests without altering architecture.
  - 🕵️ **Test Writer (Tier 1/2):** Writes mocked, deterministic unit/integration tests.

---

## 🚀 Quick Start (BYOS - Bring Your Own System)

`akcai` is designed to be easily injected into any of your existing projects.

### 1. Initialize the Orchestrator
Clone this repository and run the setup script targeting your actual project directory:

```bash
git clone https://github.com/gorkemakcay/akcai.git
cd akcai
chmod +x init.sh
./init.sh ../your-target-project
```

### 2. Configure Environment Secrets
Navigate to your project, where `akcai` just created a `.loop-orchestra` folder. 
**Note:** AI Agents will *never* see this file. Only the Dispatcher reads it.

```bash
cd ../your-target-project/.loop-orchestra
cp .env.example .env
# Open .env and add your API keys / Telegram Bot Tokens
```

### 3. Start the Orchestra 🎵
Install the minimal dependencies (like `dotenv`) and start the dispatcher:

```bash
npm install
npm start
```

---

## 📂 Architecture Overview

```text
.loop-orchestra/
├── core/
│   ├── dispatcher.js         # The main brain: loops through tasks & enforces rules
│   ├── worktree-manager.js   # Handles Git slots and Docker lifecycles
│   ├── quota-guard.js        # Token pacing & sleep logic
│   ├── watchdog.sh           # Keeps the session alive overnight
│   ├── task-schema.json      # JSON schema for AI task definitions
│   └── prompts/              # System prompts for Architect, Implementer, Test Writer
├── agent-slots/              # (Git Ignored) Auto-generated isolated worktrees
├── tasks.json                # Your queue of epics and tasks
├── progress.jsonl            # Event sourcing log of all AI actions
└── .env                      # (Git Ignored) API keys and secrets
```

---

## 🤝 Contributing
This project is open-source and built for the AI-coding community. Feel free to open issues, submit Pull Requests, or fork it for your own autonomous setups!

<div align="center">
  <i>Built with ❤️ by Görkem Akçay & Antigravity</i>
</div>
