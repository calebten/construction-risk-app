# 🏗️ Construction Risk App

🎥 **Demo video (1m):** [Watch on Loom](https://www.loom.com/share/9d751034497d470d854435f5c399bf51?sid=de96b48b-841e-4cf3-91c3-75faec959578) 
📂 **Repository:** This page  

---

## 🚀 Overview
Construction risk assessment app — pulls weather data, generates AI analysis with **Claude**, posts to Slack, and logs to Google Sheets.  

It pulls **live weather data**, evaluates it against risk thresholds (rain, humidity, wind, temperature), and generates a **risk assessment**. Results are displayed in a clean web interface, with optional notifications via **Slack** and **Google Sheets logging** for project tracking.  

With **Claude**, the app also provides a concise **AI-generated summary** with suggested mitigations.  

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

- ✅ Risk scoring engine using configurable weather thresholds.  
- 🧠 AI-powered narrative analysis of site conditions (Claude).  
- 🔔 Slack notifications to keep teams informed.  
- 📊 Google Sheets logging for ongoing risk tracking.  
- 🌐 Simple browser interface with real-time updates.  
- 🛡️ Error handling, health check endpoint, and secure environment variable management.  

---

## 🛠️ Setup & Installation

Clone and run locally:  
```bash
git clone https://github.com/calebten/construction-risk-app.git
cd construction-risk-app
npm install
npm start


### 🔑 Environment Setup

This app requires environment variables. A sample file is included as `.env.example`.

1. Copy `.env.example` → `.env`
2. Fill in your own values:

```env
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

