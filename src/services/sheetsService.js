const { google } = require('googleapis');
const config = require('../config');

class SheetsService {
  constructor() {
    this.sheets = null;
    this.initializeClient();
  }

  async initializeClient() {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.apis.google.clientEmail,
          private_key: config.apis.google.privateKey
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error('Google Sheets authentication error:', error.message);
    }
  }

  async logAssessment(assessmentData) {
    if (!this.sheets) {
      throw new Error('Google Sheets not initialized');
    }

    const { siteAddress, date, riskLevel, riskMetrics, weatherData, aiAnalysis, timestamp } = assessmentData;

    const row = [
      timestamp,
      siteAddress,
      date,
      riskLevel,
      weatherData.temperature_2m,
      weatherData.relative_humidity_2m,
      weatherData.precipitation_probability,
      weatherData.wind_speed_10m,
      riskMetrics.exceedsRainThreshold ? 'YES' : 'NO',
      riskMetrics.exceedsHumidityThreshold ? 'YES' : 'NO',
      riskMetrics.exceedsWindThreshold ? 'YES' : 'NO',
      riskMetrics.temperatureOutOfRange ? 'YES' : 'NO',
      aiAnalysis
    ];

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: config.apis.google.sheetId,
        range: 'Sheet1!A:M',
        valueInputOption: 'RAW',
        resource: {
          values: [row]
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Google Sheets API error:', error.message);
      throw new Error('Failed to log to Google Sheets');
    }
  }

  async initializeSheet() {
    if (!this.sheets) return;

    const headers = [
      'Timestamp',
      'Site Address',
      'Date',
      'Risk Level',
      'Temperature (°C)',
      'Humidity (%)',
      'Rain Probability (%)',
      'Wind Speed (km/h)',
      'Rain Risk',
      'Humidity Risk',
      'Wind Risk',
      'Temperature Risk',
      'AI Analysis'
    ];

    try {
      // Check if headers exist
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.apis.google.sheetId,
        range: 'Sheet1!1:1'
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: config.apis.google.sheetId,
          range: 'Sheet1!1:1',
          valueInputOption: 'RAW',
          resource: {
            values: [headers]
          }
        });
      }
    } catch (error) {
      console.error('Sheet initialization error:', error.message);
    }
  }
}

module.exports = SheetsService;
