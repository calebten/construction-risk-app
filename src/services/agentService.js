/**
 * Agentic Risk Assessment Service
 *
 * Instead of sending a single prompt and getting back text, Claude is given a
 * set of tools it can call. It decides what to investigate, calls tools in
 * sequence, and only returns a final recommendation after reasoning through
 * all relevant data — including hourly forecasts and optimal pour windows.
 */

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WEATHER_BASE = process.env.WEATHER_API_BASE_URL || 'https://api.open-meteo.com/v1';

const THRESHOLDS = {
  rainProbability: parseInt(process.env.RAIN_PROBABILITY_THRESHOLD) || 30,
  humidity:        parseInt(process.env.HUMIDITY_THRESHOLD)         || 85,
  windSpeed:       parseInt(process.env.WIND_SPEED_THRESHOLD)       || 25,
  minTemp:         parseInt(process.env.MIN_TEMPERATURE)            || 5,
  maxTemp:         parseInt(process.env.MAX_TEMPERATURE)            || 35
};

// ─── Tool definitions (what Claude can call) ────────────────────────────────

const TOOLS = [
  {
    name: 'get_weather_snapshot',
    description: 'Get weather conditions at noon on a specific date for a location.',
    input_schema: {
      type: 'object',
      properties: {
        latitude:  { type: 'number', description: 'Latitude of the site' },
        longitude: { type: 'number', description: 'Longitude of the site' },
        date:      { type: 'string', description: 'Date in YYYY-MM-DD format' }
      },
      required: ['latitude', 'longitude', 'date']
    }
  },
  {
    name: 'get_hourly_forecast',
    description: 'Get hour-by-hour weather for a full day. Use this to find safer windows for the pour.',
    input_schema: {
      type: 'object',
      properties: {
        latitude:  { type: 'number' },
        longitude: { type: 'number' },
        date:      { type: 'string', description: 'Date in YYYY-MM-DD format' }
      },
      required: ['latitude', 'longitude', 'date']
    }
  },
  {
    name: 'calculate_risk_score',
    description: 'Calculate a structured risk score from weather conditions against safety thresholds.',
    input_schema: {
      type: 'object',
      properties: {
        temperature:       { type: 'number', description: 'Temperature in °C' },
        humidity:          { type: 'number', description: 'Relative humidity %' },
        rainProbability:   { type: 'number', description: 'Precipitation probability %' },
        windSpeed:         { type: 'number', description: 'Wind speed km/h' }
      },
      required: ['temperature', 'humidity', 'rainProbability', 'windSpeed']
    }
  },
  {
    name: 'find_best_pour_window',
    description: 'Given hourly forecasts, return the safest 2-hour window for a concrete pour.',
    input_schema: {
      type: 'object',
      properties: {
        hourlyData: {
          type: 'array',
          description: 'Array of hourly weather objects with time, temp, humidity, rain, wind',
          items: { type: 'object' }
        }
      },
      required: ['hourlyData']
    }
  }
];

// ─── Tool implementations ────────────────────────────────────────────────────

async function get_weather_snapshot({ latitude, longitude, date }) {
  const response = await axios.get(`${WEATHER_BASE}/forecast`, {
    params: {
      latitude, longitude,
      hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m',
      start_date: date, end_date: date,
      timezone: 'America/New_York'
    }
  });

  const d = response.data.hourly;
  const noon = 12; // index for 12:00
  return {
    time: `${date}T12:00`,
    temperature:     Math.round(d.temperature_2m[noon]),
    humidity:        d.relative_humidity_2m[noon],
    rainProbability: d.precipitation_probability?.[noon] ?? 0,
    windSpeed:       Math.round(d.wind_speed_10m[noon])
  };
}

async function get_hourly_forecast({ latitude, longitude, date }) {
  const response = await axios.get(`${WEATHER_BASE}/forecast`, {
    params: {
      latitude, longitude,
      hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m',
      start_date: date, end_date: date,
      timezone: 'America/New_York'
    }
  });

  const d = response.data.hourly;
  return d.time.map((t, i) => ({
    time:            t,
    temperature:     Math.round(d.temperature_2m[i]),
    humidity:        d.relative_humidity_2m[i],
    rainProbability: d.precipitation_probability?.[i] ?? 0,
    windSpeed:       Math.round(d.wind_speed_10m[i])
  }));
}

function calculate_risk_score({ temperature, humidity, rainProbability, windSpeed }) {
  const flags = {
    temperatureOutOfRange: temperature < THRESHOLDS.minTemp || temperature > THRESHOLDS.maxTemp,
    highHumidity:          humidity > THRESHOLDS.humidity,
    highRainRisk:          rainProbability > THRESHOLDS.rainProbability,
    highWind:              windSpeed > THRESHOLDS.windSpeed
  };

  const count = Object.values(flags).filter(Boolean).length;
  const level = count >= 3 ? 'HIGH' : count >= 1 ? 'MEDIUM' : 'LOW';

  return { flags, riskLevel: level, riskCount: count, thresholds: THRESHOLDS };
}

function find_best_pour_window({ hourlyData }) {
  // Typical pour window: 6am–4pm
  const workingHours = hourlyData.filter(h => {
    const hour = new Date(h.time).getHours();
    return hour >= 6 && hour <= 16;
  });

  // Score each 2-hour window
  let best = null;
  let bestScore = Infinity;

  for (let i = 0; i < workingHours.length - 1; i++) {
    const window = workingHours.slice(i, i + 2);
    const avg = {
      temperature:     window.reduce((s, h) => s + h.temperature, 0) / 2,
      humidity:        window.reduce((s, h) => s + h.humidity, 0) / 2,
      rainProbability: window.reduce((s, h) => s + h.rainProbability, 0) / 2,
      windSpeed:       window.reduce((s, h) => s + h.windSpeed, 0) / 2
    };

    // Lower score = safer (penalise each risk factor)
    const score =
      (avg.rainProbability / THRESHOLDS.rainProbability) +
      (avg.humidity / THRESHOLDS.humidity) +
      (avg.windSpeed / THRESHOLDS.windSpeed) +
      (Math.abs(avg.temperature - 20) / 10); // ideal ~20°C

    if (score < bestScore) {
      bestScore = score;
      best = { startTime: window[0].time, endTime: window[1].time, conditions: avg, score: Math.round(score * 100) / 100 };
    }
  }

  return best || { error: 'No suitable window found in working hours' };
}

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

async function dispatchTool(name, input) {
  switch (name) {
    case 'get_weather_snapshot':  return await get_weather_snapshot(input);
    case 'get_hourly_forecast':   return await get_hourly_forecast(input);
    case 'calculate_risk_score':  return calculate_risk_score(input);
    case 'find_best_pour_window': return find_best_pour_window(input);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Agent loop ───────────────────────────────────────────────────────────────

/**
 * Run the agentic risk assessment.
 * Claude calls tools as needed, reasons across multiple steps,
 * and returns a structured final assessment.
 */
async function runRiskAgent({ siteAddress, latitude, longitude, date }) {
  const systemPrompt = `You are an autonomous construction safety agent specialising in concrete pour risk assessment.

You have tools to fetch weather data, calculate risk scores, and find optimal pour windows.
Use them in a logical sequence to build a complete picture before giving your final recommendation.

Your job:
1. Get the weather snapshot for the requested date
2. If any risk factors exist, get the hourly forecast to look for safer windows
3. Calculate the risk score
4. If risk is MEDIUM or HIGH, find the best pour window
5. Return your final assessment as a JSON object with these fields:
   - riskLevel: "LOW" | "MEDIUM" | "HIGH"
   - summary: 2-3 sentence plain-English recommendation for construction workers
   - bestWindow: the recommended pour time (or null if conditions are fine all day)
   - flags: the risk flags object from calculate_risk_score

Return ONLY valid JSON in your final message. Do not wrap it in markdown.`;

  const userMessage = `Assess concrete pour risk for:
Site: ${siteAddress}
Coordinates: ${latitude}, ${longitude}
Date: ${date}`;

  const messages = [{ role: 'user', content: userMessage }];
  const toolCallLog = [];

  // Agentic loop — continue until Claude stops calling tools
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages
    });

    // Add assistant turn to conversation
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      // Extract the JSON result from the final text block
      const textBlock = response.content.find(b => b.type === 'text');
      const raw = textBlock?.text?.trim() ?? '{}';
      const result = JSON.parse(raw);
      return { ...result, toolCallLog };
    }

    if (response.stop_reason === 'tool_use') {
      // Execute each tool Claude requested
      const toolResults = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        console.log(`  🔧 Agent calling tool: ${block.name}`, JSON.stringify(block.input));
        let output;
        try {
          output = await dispatchTool(block.name, block.input);
          toolCallLog.push({ tool: block.name, input: block.input, output });
        } catch (err) {
          output = { error: err.message };
          toolCallLog.push({ tool: block.name, input: block.input, error: err.message });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(output)
        });
      }

      // Feed results back into the conversation
      messages.push({ role: 'user', content: toolResults });
    } else {
      // Unexpected stop reason — break to avoid infinite loop
      break;
    }
  }

  return { riskLevel: 'UNKNOWN', summary: 'Agent loop ended unexpectedly.', toolCallLog };
}

module.exports = { runRiskAgent };
