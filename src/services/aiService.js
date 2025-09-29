const OpenAI = require('openai');
const config = require('../config');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.apis.openai.apiKey
    });
  }

  async generateRiskBrief(assessmentData) {
    const { siteAddress, date, weatherData, riskMetrics, riskLevel } = assessmentData;

    const prompt = this.createPrompt(siteAddress, date, weatherData, riskMetrics, riskLevel);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a construction safety expert specializing in concrete pouring operations. Provide concise, actionable risk assessments.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('AI service error:', error.message);
      return this.generateFallbackBrief(riskLevel, riskMetrics);
    }
  }

  createPrompt(siteAddress, date, weatherData, riskMetrics, riskLevel) {
    return `Generate a Concrete Pour Risk Brief for:
Location: ${siteAddress}
Date: ${date}
Risk Level: ${riskLevel}

Weather Conditions:
- Temperature: ${weatherData.temperature_2m}°C
- Humidity: ${weatherData.relative_humidity_2m}%
- Rain Probability: ${weatherData.precipitation_probability}%
- Wind Speed: ${weatherData.wind_speed_10m} km/h

Risk Factors:
${riskMetrics.exceedsRainThreshold ? '⚠️ High rain probability' : '✅ Low rain risk'}
${riskMetrics.exceedsHumidityThreshold ? '⚠️ High humidity' : '✅ Normal humidity'}
${riskMetrics.exceedsWindThreshold ? '⚠️ High wind speed' : '✅ Normal wind'}
${riskMetrics.temperatureOutOfRange ? '⚠️ Temperature out of range' : '✅ Good temperature'}

Provide a brief assessment (2-3 sentences) and specific mitigation recommendations if needed.`;
  }

  generateFallbackBrief(riskLevel, riskMetrics) {
    const risks = [];
    if (riskMetrics.exceedsRainThreshold) risks.push('rain');
    if (riskMetrics.exceedsHumidityThreshold) risks.push('humidity');
    if (riskMetrics.exceedsWindThreshold) risks.push('wind');
    if (riskMetrics.temperatureOutOfRange) risks.push('temperature');

    if (riskLevel === 'LOW') {
      return 'Weather conditions are favorable for concrete pouring. Proceed with normal operations.';
    }

    return `${riskLevel} risk detected due to ${risks.join(', ')}. Consider postponing pour or implementing additional safety measures.`;
  }
}

module.exports = AIService;
