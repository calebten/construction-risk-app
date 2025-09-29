const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Claude AI
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
);

// Risk Thresholds
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

        const coords = extractCoordinates(siteAddress);
        
        // 1. Get weather data
        const weatherData = await getWeatherData(coords, date);
        
        // 2. Calculate risk metrics
        const riskMetrics = calculateRiskMetrics(weatherData);
        
        // 3. Get AI analysis from Claude
        let aiAnalysis;
        try {
            aiAnalysis = await getClaudeAnalysis(weatherData, riskMetrics, siteAddress, date);
            console.log('✅ Claude AI analysis generated');
        } catch (aiError) {
            console.error('⚠️ Claude API error, using fallback:', aiError.message);
            aiAnalysis = generateFallbackAnalysis(weatherData, riskMetrics, siteAddress);
        }
        
        // 4. Determine overall risk level
        const riskCount = Object.values(riskMetrics).filter(v => v).length;
        let riskLevel = 'LOW';
        if (riskCount >= 3) riskLevel = 'HIGH';
        else if (riskCount >= 1) riskLevel = 'MEDIUM';
        
        const assessment = {
            siteAddress,
            date,
            weatherData,
            riskMetrics,
            riskLevel,
            aiAnalysis,
            timestamp: new Date().toISOString()
        };
        
        // 5. Send notifications
        let slackResult = 'failed';
        try {
            if (process.env.SLACK_WEBHOOK_URL && 
                process.env.SLACK_WEBHOOK_URL !== 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL') {
                await sendSlackNotification(assessment);
                slackResult = 'sent';
            }
        } catch (error) {
            console.error('Slack error:', error.message);
        }
        
        // 6. Log to Google Sheets
        let sheetsResult = 'failed';
        try {
            await logToGoogleSheets(assessment);
            sheetsResult = 'logged';
        } catch (error) {
            console.error('Sheets error:', error.message);
        }
        
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

// Get Claude AI Analysis
async function getClaudeAnalysis(weatherData, riskMetrics, address, date) {
    const city = address.split(',')[0].trim();
    
    // Build context for Claude
    const weatherContext = `
        Location: ${address}
        Date: ${date}
        Temperature: ${weatherData.temperature_2m}°C
        Humidity: ${weatherData.relative_humidity_2m}%
        Rain Probability: ${weatherData.precipitation_probability}%
        Wind Speed: ${weatherData.wind_speed_10m} km/h
        
        Risk Factors Detected:
        - Temperature out of range: ${riskMetrics.temperatureOutOfRange ? 'YES' : 'NO'}
        - High humidity (>${THRESHOLDS.humidity}%): ${riskMetrics.exceedsHumidityThreshold ? 'YES' : 'NO'}
        - Rain risk (>${THRESHOLDS.rainProbability}%): ${riskMetrics.exceedsRainThreshold ? 'YES' : 'NO'}
        - High winds (>${THRESHOLDS.windSpeed} km/h): ${riskMetrics.exceedsWindThreshold ? 'YES' : 'NO'}
    `;

    const prompt = `You are a construction expert specializing in concrete pouring risk assessment. 
    Based on the following weather conditions, provide a detailed but concise risk analysis for a concrete pour.
    
    ${weatherContext}
    
    Provide a professional assessment that includes:
    1. Overall risk evaluation (low/medium/high)
    2. Specific concerns based on the conditions
    3. Recommended actions or precautions
    4. Whether to proceed, postpone, or proceed with cautions
    
    Keep the response to 2-3 sentences, professional but clear for construction workers.`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307', // Using Haiku for cost efficiency
            max_tokens: 200,
            temperature: 0.3, // Lower temperature for consistent professional advice
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        return message.content[0].text;
    } catch (error) {
        console.error('Claude API error:', error);
        throw error;
    }
}

// Fallback analysis if Claude fails
function generateFallbackAnalysis(weatherData, riskMetrics, address) {
    const city = address.split(',')[0].trim();
    const issues = [];
    
    if (riskMetrics.temperatureOutOfRange) {
        issues.push(`temperature (${weatherData.temperature_2m}°C)`);
    }
    if (riskMetrics.exceedsHumidityThreshold) {
        issues.push(`humidity (${weatherData.relative_humidity_2m}%)`);
    }
    if (riskMetrics.exceedsRainThreshold) {
        issues.push(`rain risk (${weatherData.precipitation_probability}%)`);
    }
    if (riskMetrics.exceedsWindThreshold) {
        issues.push(`wind (${weatherData.wind_speed_10m} km/h)`);
    }
    
    const riskCount = issues.length;
    
    if (riskCount === 0) {
        return `Conditions in ${city} are favorable for concrete pouring. All weather parameters within acceptable ranges. Proceed with standard procedures.`;
    } else if (riskCount <= 2) {
        return `Moderate risk in ${city} due to ${issues.join(' and ')}. Consider protective measures such as windbreaks, curing compounds, or adjusted mix design. Monitor conditions closely.`;
    } else {
        return `High risk in ${city} with multiple adverse conditions: ${issues.join(', ')}. Strongly recommend postponing pour to avoid compromised concrete quality.`;
    }
}

// Calculate risk metrics
function calculateRiskMetrics(weatherData) {
    return {
        temperatureOutOfRange: weatherData.temperature_2m < THRESHOLDS.minTemp || 
                               weatherData.temperature_2m > THRESHOLDS.maxTemp,
        exceedsHumidityThreshold: weatherData.relative_humidity_2m > THRESHOLDS.humidity,
        exceedsRainThreshold: weatherData.precipitation_probability > THRESHOLDS.rainProbability,
        exceedsWindThreshold: weatherData.wind_speed_10m > THRESHOLDS.windSpeed
    };
}

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

// Get weather data from Open-Meteo
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
        
        const noonIndex = 12;
        return {
            temperature_2m: Math.round(response.data.hourly.temperature_2m[noonIndex]),
            relative_humidity_2m: response.data.hourly.relative_humidity_2m[noonIndex],
            precipitation_probability: response.data.hourly.precipitation_probability?.[noonIndex] || 0,
            wind_speed_10m: Math.round(response.data.hourly.wind_speed_10m[noonIndex])
        };
    } catch (error) {
        console.error('Weather API error:', error);
        return {
            temperature_2m: 22,
            relative_humidity_2m: 65,
            precipitation_probability: 20,
            wind_speed_10m: 15
        };
    }
}

// Send Slack notification
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
                        title: "📍 Location",
                        value: assessment.siteAddress,
                        short: true
                    },
                    {
                        title: "📅 Date",
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
                        title: "🌧️ Rain Risk",
                        value: `${assessment.weatherData.precipitation_probability}%`,
                        short: true
                    },
                    {
                        title: "💨 Wind",
                        value: `${assessment.weatherData.wind_speed_10m} km/h`,
                        short: true
                    },
                    {
                        title: "🤖 AI Analysis",
                        value: assessment.aiAnalysis,
                        short: false
                    }
                ],
                footer: "AI-Powered Risk Assessment",
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
        
        const values = [[
            new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
            assessment.siteAddress,
            assessment.date,
            assessment.riskLevel,
            assessment.weatherData.temperature_2m,
            assessment.weatherData.relative_humidity_2m,
            assessment.weatherData.precipitation_probability,
            assessment.weatherData.wind_speed_10m,
            assessment.aiAnalysis
        ]];
        
        const request = {
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!A:I`,
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
    console.log(`  🤖 AI: ${process.env.ANTHROPIC_API_KEY ? '✅ Claude AI Ready' : '❌ Add Anthropic API key'}`);
    console.log(`  📢 Slack: ${process.env.SLACK_WEBHOOK_URL ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  📊 Google Sheets: ✅ Configured`);
    console.log(`  🌤️ Weather API: ✅ Ready\n`);
});
