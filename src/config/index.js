require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  apis: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    },
    weather: {
      baseUrl: process.env.WEATHER_API_BASE_URL || 'https://api.open-meteo.com/v1'
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      channelId: process.env.SLACK_CHANNEL_ID
    },
    google: {
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
      sheetId: process.env.GOOGLE_SHEET_ID
    }
  },

  thresholds: {
    rainProbability: parseInt(process.env.RAIN_PROBABILITY_THRESHOLD) || 30,
    humidity: parseInt(process.env.HUMIDITY_THRESHOLD) || 85,
    windSpeed: parseInt(process.env.WIND_SPEED_THRESHOLD) || 25,
    minTemperature: parseInt(process.env.MIN_TEMPERATURE) || 5,
    maxTemperature: parseInt(process.env.MAX_TEMPERATURE) || 35
  }
};

module.exports = config;
