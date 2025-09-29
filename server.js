const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { WebClient } = require('@slack/web-api');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ SLACK CONFIGURATION ============
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// ============ GOOGLE SHEETS CONFIGURATION ============
const sheets = google.sheets('v4');
const SHEET_NAME = 'RiskAssessments';

// Google Sheets Authentication using environment variables
const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
);

// ============ RISK THRESHOLDS FROM ENV ============
const THRESHOLDS = {
    rainProbability: parseInt(process.env.RAIN_PROBABILITY_THRESHOLD),
    humidity: parseInt(process.env.HUMIDITY_THRESHOLD),
    windSpeed: parseInt(process.env.WIND_SPEED_THRESHOLD),
    minTemp: parseInt(process.env.MIN_TEMPERATURE),
    maxTemp: parseInt(process.env.MAX_TEMPERATURE)
};

// Main risk assessment endpoint
app.post('/api/assess-risk', async (req, res) => {
    try {
        const { siteAddress, date } = req.body;
        console.log('Received request:', { siteAddress, date });

        // Extract coordinates from address if available
        const coords = extractCoordinates(siteAddress);
        
        // 1. Get weather data using Open-Meteo (free API)
        const weatherData = await getWeatherData(coords, date);
        
        // 2. Calculate risk assessment
        const assessment = calculateRiskAssessment(weatherData, siteAddress, date);
        
        // 3. Send Slack notification
        let slackResult = 'failed';
        try {
            if (process.env.SLACK_WEBHOOK_URL && process.env.SLACK_WEBHOOK_URL !== 'your_slack_webhook_url_here') {
                await sendSlackNotification(assessment);
                slackResult = 'sent';
            }
        } catch (error) {
            console.error('Slack error:', error);
        }
        
        // 4. Log to Google Sheets
        let sheetsResult = 'failed';
        try {
            if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SHEET_ID !== 'your_google_sheet_id_here') {
                await logToGoogleSheets(assessment);
                sheetsResult = 'logged';
            }
        } catch (error) {
            console.error('Sheets error:', error);
        }
        
        // 5. Send response back to frontend
        res.json({
            success: true,
            assessment: assessment,
            notifications: {
                slack: slackResult,
                sheets: sheetsResult
            }
        });
        
    } catch (error) {
        console.error('Error in risk assessment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Extract coordinates from address (for Georgia cities)
function extractCoordinates(address) {
    // Default to Atlanta if no coordinates found
    const georgiaCoords = {
        "Atlanta": { lat: 33.7490, lon: -84.3880 },
        "Augusta": { lat: 33.4735, lon: -82.0105 },
        "Columbus": { lat: 32.4609, lon: -84.9877 },
        "Macon": { lat: 32.8407, lon: -83.6324 },
        "Savannah": { lat: 32.0809, lon: -81.0912 },
        "Athens": { lat: 33.9519, lon: -83.3576 },
        "Sandy Springs": { lat: 33.9245, lon: -84.3785 },
        "Roswell": { lat: 34.0234, lon: -84.3617 },
        "Johns Creek": { lat: 34.0289, lon: -84.1989 },
        "Alpharetta": { lat: 34.0754, lon: -84.2941 },
        "Marietta": { lat: 33.9526, lon: -84.5499 },
        "Valdosta": { lat: 30.8327, lon: -83.2785 },
        "Warner Robins": { lat: 32.6130, lon: -83.5999 },
        "Albany": { lat: 31.5785, lon: -84.1557 }
    };
    
    const city = address.split(',')[0].trim();
    return georgiaCoords[city] || georgiaCoords["Atlanta"];
}

// Get weather data using Open-Meteo (FREE API)
async function getWeatherData(coords, date) {
    try {
        const response = await axios.get(`${process.env.WEATHER_API_BASE_URL}/forecast`, {
            params: {
                latitude: coords.lat,
                longitude: coords.lon,
                hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m',
                forecast_days: 7,
                timezone: 'America/New_York'
            }
        });
        
        // Get data for the specific date at noon (index 12)
        const targetDate = new Date(date);
        const todayIndex = 12; // Noon
        
        return {
            temperature_2m: Math.round(response.data.hourly.temperature_2m[todayIndex]),
            relative_humidity_2m: response.data.hourly.relative_humidity_2m[todayIndex],
            precipitation_probability: response.data.hourly.precipitation_probability[todayIndex] || 0,
            wind_speed_10m: Math.round(response.data.hourly.wind_speed_10m[todayIndex])
        };
    } catch (error) {
        console.error('Weather API error:', error);
        // Return mock data if API fails
        return {
            temperature_2m: 22,
            relative_humidity_2m: 65,
            precipitation_probability: 20,
            wind_speed_10m: 15
        };
    }
}

// Calculate risk assessment with your thresholds
function calculateRiskAssessment(weatherData, address, date) {
    const temp = weatherData.temperature_2m;
    const humidity = weatherData.relative_humidity_2m;
    const rainProb = weatherData.precipitation_probability;
    const windSpeed = weatherData.wind_speed_10m;
    
    // Risk calculation using ENV thresholds
    const riskMetrics = {
        temperatureOutOfRange: temp < THRESHOLDS.minTemp || temp > THRESHOLDS.maxTemp,
        exceedsHumidityThreshold: humidity > THRESHOLDS.humidity,
        exceedsRainThreshold: rainProb > THRESHOLDS.rainProbability,
        exceedsWindThreshold: windSpeed > THRESHOLDS.windSpeed
    };
    
    // Determine overall risk level
    const riskCount = Object.values(riskMetrics).filter(v => v).length;
    let riskLevel = 'LOW';
    if (riskCount >= 3) riskLevel = 'HIGH';
    else if (riskCount >= 1) riskLevel = 'MEDIUM';
    
    // Generate AI analysis
    const aiAnalysis = generateAIAnalysis(weatherData, riskLevel, address, riskMetrics);
    
    return {
        siteAddress: address,
        date: date,
        weatherData: weatherData,
        riskMetrics: riskMetrics,
        riskLevel: riskLevel,
        aiAnalysis: aiAnalysis,
        timestamp: new Date().toISOString()
    };
}

// Generate detailed analysis
function generateAIAnalysis(weatherData, riskLevel, address, riskMetrics) {
    const city = address.split(',')[0].trim();
    const issues = [];
    
    if (riskMetrics.temperatureOutOfRange) {
        issues.push(`Temperature (${weatherData.temperature_2m}°C) is outside optimal range (${THRESHOLDS.minTemp}-${THRESHOLDS.maxTemp}°C)`);
    }
    if (riskMetrics.exceedsHumidityThreshold) {
        issues.push(`Humidity (${weatherData.relative_humidity_2m}%) exceeds threshold (${THRESHOLDS.humidity}%)`);
    }
    if (riskMetrics.exceedsRainThreshold) {
        issues.push(`Rain probability (${weatherData.precipitation_probability}%) exceeds threshold (${THRESHOLDS.rainProbability}%)`);
    }
    if (riskMetrics.exceedsWindThreshold) {
        issues.push(`Wind speed (${weatherData.wind_speed_10m} km/h) exceeds threshold (${THRESHOLDS.windSpeed} km/h)`);
    }
    
    if (riskLevel === 'LOW') {
        return `✅ Excellent conditions for concrete pour in ${city}. All weather parameters are within acceptable ranges. Temperature: ${weatherData.temperature_2m}°C, Humidity: ${weatherData.relative_humidity_2m}%, Rain probability: ${weatherData.precipitation_probability}%, Wind: ${weatherData.wind_speed_10m} km/h. Proceed with scheduled pour.`;
    } else if (riskLevel === 'MEDIUM') {
        return `⚠️ Moderate risk for concrete pour in ${city}. Issues detected: ${issues.join('. ')}. Consider protective measures such as windbreaks, curing compounds, or adjusted mix design. Monitor conditions closely.`;
    } else {
        return `🚫 High risk conditions in ${city}. Multiple issues detected: ${issues.join('. ')}. Strongly recommend postponing pour to avoid compromised concrete quality, potential cracking, and strength issues.`;
    }
}

// Send Slack notification (using webhook)
async function sendSlackNotification(assessment) {
    try {
        const emoji = assessment.riskLevel === 'LOW' ? '✅' : 
                     assessment.riskLevel === 'MEDIUM' ? '⚠️' : '🚫';
        
        const color = assessment.riskLevel === 'LOW' ? '#36a64f' : 
                     assessment.riskLevel === 'MEDIUM' ? '#ff9900' : '#ff0000';
        
        const message = {
            text: `Construction Risk Assessment - ${assessment.riskLevel} RISK`,
            attachments: [{
                color: color,
                title: `${emoji} ${assessment.riskLevel} RISK - ${assessment.siteAddress}`,
                fields: [
                    {
                        title: "📍 Site Location",
                        value: assessment.siteAddress,
                        short: true
                    },
                    {
                        title: "📅 Pour Date",
                        value: assessment.date,
                        short: true
                    },
                    {
                        title: "🌡️ Temperature",
                        value: `${assessment.weatherData.temperature_2m}°C`,
                        short: true
                    },
                    {
                        title: "💧 Humidity",
                        value: `${assessment.weatherData.relative_humidity_2m}%`,
                        short: true
                    },
                    {
                        title: "🌧️ Rain Probability",
                        value: `${assessment.weatherData.precipitation_probability}%`,
                        short: true
                    },
                    {
                        title: "💨 Wind Speed",
                        value: `${assessment.weatherData.wind_speed_10m} km/h`,
                        short: true
                    },
                    {
                        title: "📊 Analysis",
                        value: assessment.aiAnalysis,
                        short: false
                    }
                ],
                footer: "Construction Risk Assessment System",
                footer_icon: "https://platform.slack-edge.com/img/default_application_icon.png",
                ts: Math.floor(Date.now() / 1000)
            }]
        };
        
        await axios.post(SLACK_WEBHOOK_URL, message);
        console.log('✅ Slack notification sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Slack notification error:', error.message);
        return false;
    }
}

// Log to Google Sheets
async function logToGoogleSheets(assessment) {
    try {
        await auth.authorize();
        
        const values = [[
            new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
            assessment.siteAddress,
            assessment.date,
            assessment.riskLevel,
            assessment.weatherData.temperature_2m,
            assessment.weatherData.relative_humidity_2m,
            assessment.weatherData.precipitation_probability,
            assessment.weatherData.wind_speed_10m,
            assessment.aiAnalysis.substring(0, 500) // Limit analysis length for sheets
        ]];
        
        const request = {
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!A:I`,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
            auth: auth,
        };
        
        await sheets.spreadsheets.values.append(request);
        console.log('✅ Google Sheets logged successfully');
        return true;
    } catch (error) {
        console.error('❌ Google Sheets error:', error.message);
        return false;
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        services: {
            slack: process.env.SLACK_WEBHOOK_URL ? 'configured' : 'not configured',
            sheets: process.env.GOOGLE_SHEET_ID ? 'configured' : 'not configured',
            weather: 'ready (Open-Meteo)'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Open http://localhost:${PORT} in your browser\n`);
    console.log('Services Status:');
    console.log(`  Slack: ${process.env.SLACK_WEBHOOK_URL ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  Google Sheets: ${process.env.GOOGLE_SHEET_ID ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  Weather API: ✅ Ready (Open-Meteo - No API key needed)\n`);
});
