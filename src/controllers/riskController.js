const WeatherService = require('../services/weatherService');
const AIService = require('../services/aiService');
const SlackService = require('../services/slackService');
const SheetsService = require('../services/sheetsService');
const RiskAssessment = require('../models/RiskAssessment');
const { getCoordinates } = require('../utils/geocoding');
const { validateAssessmentRequest } = require('../utils/validation');
const config = require('../config');

class RiskController {
  constructor() {
    this.weatherService = new WeatherService();
    this.aiService = new AIService();
    this.slackService = new SlackService();
    this.sheetsService = new SheetsService();
  }

  async assessRisk(req, res) {
    try {
      // Validate input
      const { error, value } = validateAssessmentRequest(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { siteAddress, date } = value;

      // Step 1: Get coordinates from address
      console.log(`Getting coordinates for: ${siteAddress}`);
      const coordinates = await getCoordinates(siteAddress);

      // Step 2: Fetch weather data
      console.log(`Fetching weather data for coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
      const weatherData = await this.weatherService.getWeatherData(
        coordinates.latitude,
        coordinates.longitude,
        date
      );

      // Step 3: Calculate risk metrics
      const riskMetrics = RiskAssessment.createRiskMetrics(weatherData, config.thresholds);
      const riskLevel = RiskAssessment.calculateRiskLevel(riskMetrics);

      // Step 4: Generate AI analysis
      console.log('Generating AI risk analysis...');
      const assessmentData = {
        siteAddress,
        date,
        coordinates,
        weatherData,
        riskMetrics,
        riskLevel
      };

      const aiAnalysis = await this.aiService.generateRiskBrief(assessmentData);

      // Step 5: Create final assessment
      const finalAssessment = new RiskAssessment({
        ...assessmentData,
        aiAnalysis
      });

      // Step 6: Send notifications and log data (in parallel)
      const notifications = await Promise.allSettled([
        this.slackService.postRiskAlert(finalAssessment),
        this.sheetsService.logAssessment(finalAssessment)
      ]);

      // Check notification results
      const slackResult = notifications[0];
      const sheetsResult = notifications[1];

      res.json({
        success: true,
        assessment: {
          siteAddress: finalAssessment.siteAddress,
          date: finalAssessment.date,
          riskLevel: finalAssessment.riskLevel,
          weatherData: finalAssessment.weatherData,
          riskMetrics: finalAssessment.riskMetrics,
          aiAnalysis: finalAssessment.aiAnalysis,
          timestamp: finalAssessment.timestamp
        },
        notifications: {
          slack: slackResult.status === 'fulfilled' ? 'sent' : 'failed',
          sheets: sheetsResult.status === 'fulfilled' ? 'logged' : 'failed'
        }
      });

    } catch (error) {
      console.error('Risk assessment error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getHealthCheck(req, res) {
    res.json({
      success: true,
      status: 'Construction Risk Assessment API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
}

module.exports = RiskController;
