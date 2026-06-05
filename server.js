const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

// Agentic services
const { runRiskAgent } = require('./src/services/agentService');
const registry = require('./src/services/jobSiteRegistry');
const { scheduleDailyMonitoring, runMonitoringCycle } = require('./src/services/monitoringService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Google Sheets Configuration
const sheets = google.sheets('v4');
const SHEET_NAME = 'RiskAssessments';

const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
);


// ─── Risk Assessment (now powered by agent loop) ─────────────────────────────
app.post('/api/assess-risk', async (req, res) => {
    try {
        const { siteAddress, date } = req.body;
        console.log('Received request:', { siteAddress, date });

        const coords = extractCoordinates(siteAddress);

        // Run the agentic loop — Claude calls tools, reasons, returns structured result
        console.log('🤖 Starting agent loop...');
        const agentResult = await runRiskAgent({
            siteAddress,
            latitude:  coords.lat,
            longitude: coords.lon,
            date
        });
        console.log(`✅ Agent complete. Risk: ${agentResult.riskLevel}. Tools called: ${agentResult.toolCallLog?.length}`);

        const assessment = {
            siteAddress,
            date,
            riskLevel:   agentResult.riskLevel,
            aiAnalysis:  agentResult.summary,
            bestWindow:  agentResult.bestWindow  || null,
            riskMetrics: agentResult.flags        || {},
            toolCallLog: agentResult.toolCallLog  || [],
            timestamp:   new Date().toISOString()
        };

        // Send notifications
        let slackResult = 'skipped';
        try {
            if (process.env.SLACK_WEBHOOK_URL &&
                process.env.SLACK_WEBHOOK_URL !== 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL') {
                await sendSlackNotification(assessment);
                slackResult = 'sent';
            }
        } catch (error) {
            console.error('Slack error:', error.message);
            slackResult = 'failed';
        }

        let sheetsResult = 'failed';
        try {
            await logToGoogleSheets(assessment);
            sheetsResult = 'logged';
        } catch (error) {
            console.error('Sheets error:', error.message);
        }

        res.json({
            success: true,
            assessment,
            notifications: { slack: slackResult, sheets: sheetsResult }
        });

    } catch (error) {
        console.error('Error in risk assessment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Job Site Registry endpoints ─────────────────────────────────────────────

// GET /api/sites — list all monitored sites
app.get('/api/sites', (req, res) => {
    res.json({ success: true, sites: registry.getAll() });
});

// POST /api/sites — register a new site for autonomous monitoring
app.post('/api/sites', (req, res) => {
    const { address, label, pourDates } = req.body;
    if (!address) return res.status(400).json({ success: false, error: 'address required' });
    const site = registry.add({ address, label, pourDates });
    res.json({ success: true, site });
});

// DELETE /api/sites/:id — remove a site from monitoring
app.delete('/api/sites/:id', (req, res) => {
    registry.remove(req.params.id);
    res.json({ success: true });
});

// PATCH /api/sites/:id/pour-dates — update scheduled pour dates
app.patch('/api/sites/:id/pour-dates', (req, res) => {
    const site = registry.updatePourDates(req.params.id, req.body.pourDates || []);
    res.json({ success: true, site });
});

// POST /api/monitor/run — manually trigger a monitoring cycle (useful for testing)
app.post('/api/monitor/run', async (req, res) => {
    console.log('Manual monitoring cycle triggered');
    const results = await runMonitoringCycle({
        sendSlack: process.env.SLACK_WEBHOOK_URL ? sendSlackNotification : null,
        logSheets: logToGoogleSheets
    });
    res.json({ success: true, results });
});


// Extract coordinates (Georgia cities)
function extractCoordinates(address) {
    const georgiaCoords = {
        "Atlanta": { lat: 33.7490, lon: -84.3880 },
        "Athens": { lat: 33.9519, lon: -83.3576 },
        "Augusta": { lat: 33.4735, lon: -82.0105 },
        "Columbus": { lat: 32.4609, lon: -84.9877 },
        "Macon": { lat: 32.8407, lon: -83.6324 },
        "Savannah": { lat: 32.0809, lon: -81.0912 },
        "Albany": { lat: 31.5785, lon: -84.1557 },
        "Marietta": { lat: 33.9526, lon: -84.5499 },
        "Roswell": { lat: 34.0234, lon: -84.3617 },
        "Sandy Springs": { lat: 33.9245, lon: -84.3785 },
        "Johns Creek": { lat: 34.0289, lon: -84.1989 },
        "Alpharetta": { lat: 34.0754, lon: -84.2941 },
        "Kennesaw": { lat: 34.0234, lon: -84.6155 },
        "Valdosta": { lat: 30.8327, lon: -83.2785 }
    };
    
    const city = address.split(',')[0].trim();
    return georgiaCoords[city] || georgiaCoords["Atlanta"];
}

// Send Slack notification
async function sendSlackNotification(assessment) {
    try {
        const emoji = assessment.riskLevel === 'LOW' ? '✅' :
                     assessment.riskLevel === 'MEDIUM' ? '⚠️' : '🚫';
        const color = assessment.riskLevel === 'LOW' ? '#36a64f' :
                     assessment.riskLevel === 'MEDIUM' ? '#ff9900' : '#ff0000';

        const riskFlags = assessment.riskMetrics || {};
        const flagLines = [
            riskFlags.highRainRisk          ? '🌧️ High rain probability' : null,
            riskFlags.highHumidity          ? '💧 High humidity'         : null,
            riskFlags.highWind              ? '💨 High wind speed'       : null,
            riskFlags.temperatureOutOfRange ? '🌡️ Temperature out of range' : null
        ].filter(Boolean);

        const fields = [
            { title: '📍 Location', value: assessment.siteAddress, short: true },
            { title: '📅 Date',     value: assessment.date,        short: true },
            { title: '🤖 Agent Analysis', value: assessment.aiAnalysis, short: false }
        ];

        if (assessment.bestWindow) {
            fields.push({
                title: '⏰ Best Pour Window',
                value: `${assessment.bestWindow.startTime} → ${assessment.bestWindow.endTime}`,
                short: false
            });
        }

        if (flagLines.length) {
            fields.push({ title: '⚠️ Risk Factors', value: flagLines.join('\n'), short: false });
        }

        const message = {
            text: `Construction Risk Assessment — ${assessment.riskLevel} RISK`,
            attachments: [{
                color,
                title: `${emoji} ${assessment.riskLevel} RISK — ${assessment.siteAddress}`,
                fields,
                footer: 'Autonomous Risk Agent',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        await axios.post(process.env.SLACK_WEBHOOK_URL, message);
        console.log('✅ Slack notification sent');
        return true;
    } catch (error) {
        console.error('❌ Slack error:', error.message);
        return false;
    }
}

// Log to Google Sheets
async function logToGoogleSheets(assessment) {
    try {
        await auth.authorize();
        
        const flags = assessment.riskMetrics || {};
        const values = [[
            new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
            assessment.siteAddress,
            assessment.date,
            assessment.riskLevel,
            flags.temperatureOutOfRange ? 'YES' : 'NO',
            flags.highHumidity          ? 'YES' : 'NO',
            flags.highRainRisk          ? 'YES' : 'NO',
            flags.highWind              ? 'YES' : 'NO',
            assessment.bestWindow ? `${assessment.bestWindow.startTime} - ${assessment.bestWindow.endTime}` : 'N/A',
            assessment.aiAnalysis
        ]];
        
        const request = {
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!A:J`,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
            auth: auth,
        };
        
        await sheets.spreadsheets.values.append(request);
        console.log('✅ Google Sheets logged');
        return true;
    } catch (error) {
        console.error('❌ Sheets error:', error.message);
        throw error;
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        services: {
            ai: process.env.ANTHROPIC_API_KEY ? 'Claude AI configured' : 'AI not configured',
            slack: process.env.SLACK_WEBHOOK_URL ? 'configured' : 'not configured',
            sheets: 'configured',
            weather: 'ready'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Open http://localhost:${PORT} in your browser\n`);
    console.log('Services Status:');
    console.log(`  🤖 AI: ${process.env.ANTHROPIC_API_KEY ? '✅ Claude Agent Ready (tool-use loop)' : '❌ Add Anthropic API key'}`);
    console.log(`  📢 Slack: ${process.env.SLACK_WEBHOOK_URL ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  📊 Google Sheets: ✅ Configured`);
    console.log(`  🌤️ Weather API: ✅ Ready`);
    console.log(`  📋 Registered sites: ${registry.getAll().length}\n`);

    // Start autonomous monitoring — runs daily at 6am without any human trigger
    scheduleDailyMonitoring({
        targetHour: parseInt(process.env.MONITOR_HOUR) || 6,
        callbacks: {
            sendSlack: process.env.SLACK_WEBHOOK_URL ? sendSlackNotification : null,
            logSheets: logToGoogleSheets
        }
    });
});
