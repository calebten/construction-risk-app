# 🏗️ Construction Risk App

🎥 **Demo video (1m):** [Watch on Loom](https://www.loom.com/share/your-demo-link-here)  
📂 **Repository:** This page  

---

## 🚀 Overview
The **Construction Risk App** helps project teams anticipate and mitigate weather-related risks on construction sites.  

It pulls **live weather data**, evaluates it against risk thresholds (rain, humidity, wind, temperature), and generates a **risk assessment**. Results are displayed in a clean web interface, with optional notifications via **Slack** and **Google Sheets logging** for project tracking.  

With **OpenAI integration**, the app also provides a concise **AI-generated summary** with suggested mitigations.  

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
- OpenAI SDK  

---

## 🔌 APIs & Integrations

- **[Open-Meteo API](https://open-meteo.com/)** – Free weather API, no key required (temperature, humidity, wind, precipitation).  
- **[OpenAI API](https://platform.openai.com/)** – Generates natural-language analysis of risk factors and mitigation steps.  
- **[Slack Web API](https://api.slack.com/)** – Posts alerts directly into a project Slack channel.  
- **[Google Sheets API](https://developers.google.com/sheets/api/)** – Logs risk assessments for tracking and reporting.  

---

## ⚡ Features

- ✅ Risk scoring engine using configurable weather thresholds.  
- 🧠 AI-powered narrative analysis of site conditions.  
- 🔔 Slack notifications to keep teams informed.  
- 📊 Google Sheets logging for ongoing risk tracking.  
- 🌐 Simple browser interface with real-time updates.  
- 🛡️ Error handling, health check endpoint, and secure environment variable management.  

---

## 🛠️ Setup & Installation

Clone and run locally:  
```bash
git clone https://github.com/yourusername/construction-risk-app.git
cd construction-risk-app
npm install
npm start
