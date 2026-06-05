# 🏗️ Construction Risk App

🎥 **Demo video (1m):** [Watch on Loom](https://www.loom.com/share/9d751034497d470d854435f5c399bf51?sid=de96b48b-841e-4cf3-91c3-75faec959578) 
📂 **Repository:** This page  

---

## 🚀 Overview
Autonomous construction risk assessment agent — monitors registered job sites on a daily schedule, runs a multi-step AI reasoning loop, and delivers Slack alerts and Google Sheets logs with zero human intervention.

The app operates in two modes:

**Autonomous (agentic):** At 6am each morning the monitoring service wakes up, checks every registered job site for the day's concrete pour risk, and fires Slack/Sheets notifications — no one has to touch the app.

**On-demand:** Submit a site address and date through the web interface for an immediate assessment.

In both modes, Claude doesn't just receive a prompt and write back a paragraph. It runs a **tool-use agent loop** — calling tools to fetch weather snapshots, inspect hourly forecasts, calculate risk scores, and find the safest pour window — before returning a structured recommendation. The model decides what to investigate and when it has enough information.

---

## 📚 Languages & Tech Stack

- **JavaScript** – Backend (Node.js + Express APIs, risk logic, integrations) and frontend (dynamic UI updates).  
- **HTML** – UI structure (form, results panel, layout).  
- **CSS** – Styling (risk badges, weather metrics, and alerts).  

**Frameworks & Tools**  
- Node.js, Express  
- Helmet, CORS, Morgan, Dotenv  
- Google APIs client library  
- Slack SDK  
- **Anthropic Claude SDK**  

---

## 🔌 APIs & Integrations

- **[Open-Meteo API](https://open-meteo.com/)** – Free weather API, no key required (temperature, humidity, wind, precipitation).  
- **[Claude (Anthropic API)](https://www.anthropic.com/)** – Generates natural-language analysis of risk factors and mitigation steps.  
- **[Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)** – Posts alerts directly into a project Slack channel.  
- **[Google Sheets API](https://developers.google.com/sheets/api/)** – Logs risk assessments for tracking and reporting.  

---

## ⚡ Features

- 🤖 **Agentic AI loop** — Claude calls tools (`get_weather_snapshot`, `get_hourly_forecast`, `calculate_risk_score`, `find_best_pour_window`) in sequence, reasoning across multiple steps before producing a recommendation.
- ⏰ **Autonomous monitoring** — cron-style scheduler wakes up at 6am daily and checks all registered sites with no human trigger. Configure the hour via `MONITOR_HOUR` env var.
- 📋 **Job site registry** — register sites once via `POST /api/sites`; the agent monitors them automatically every day (or only on scheduled pour dates).
- 🪟 **Best pour window** — when risk is elevated, the agent identifies the safest 2-hour window in working hours rather than just flagging a problem.
- 🔔 Slack alerts with risk level, agent analysis, and recommended window.
- 📊 Google Sheets logging for ongoing risk tracking.
- 🌐 Web interface for on-demand assessments.
- 🛡️ Error handling, health check endpoint, and secure environment variable management.

---

## 🔗 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/assess-risk` | On-demand risk assessment (agent loop) |
| `GET` | `/api/sites` | List all registered job sites |
| `POST` | `/api/sites` | Register a site for autonomous monitoring |
| `DELETE` | `/api/sites/:id` | Remove a site from monitoring |
| `PATCH` | `/api/sites/:id/pour-dates` | Update scheduled pour dates for a site |
| `POST` | `/api/monitor/run` | Manually trigger a monitoring cycle |
| `GET` | `/health` | Health check |

**Register a site example:**
```bash
curl -X POST http://localhost:3000/api/sites \
  -H "Content-Type: application/json" \
  -d '{"address": "Atlanta, GA", "label": "Site A", "pourDates": ["2026-06-10"]}'
```

---

## 🛠️ Setup, Installation & Environment

Clone, install dependencies, and set environment variables:

```bash
# Clone repo
git clone https://github.com/calebten/construction-risk-app.git
cd construction-risk-app
npm install

# Start server
npm start

# Create .env file (copy from .env.example)
# Fill in your own values below:

# Claude API
ANTHROPIC_API_KEY=your-claude-api-key

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Google Sheets
GOOGLE_SHEETS_ID=your-sheet-id
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Weather provider API key
WEATHER_API_KEY=your-weather-api-key
