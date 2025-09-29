class RiskAssessment {
  constructor(data) {
    this.siteAddress = data.siteAddress;
    this.date = data.date;
    this.coordinates = data.coordinates;
    this.weatherData = data.weatherData;
    this.riskMetrics = data.riskMetrics;
    this.riskLevel = data.riskLevel;
    this.aiAnalysis = data.aiAnalysis;
    this.timestamp = new Date().toISOString();
  }

  static createRiskMetrics(weatherData, thresholds) {
    return {
      rainProbability: weatherData.precipitation_probability || 0,
      humidity: weatherData.relative_humidity_2m || 0,
      windSpeed: weatherData.wind_speed_10m || 0,
      temperature: weatherData.temperature_2m || 0,
      exceedsRainThreshold: (weatherData.precipitation_probability || 0) > thresholds.rainProbability,
      exceedsHumidityThreshold: (weatherData.relative_humidity_2m || 0) > thresholds.humidity,
      exceedsWindThreshold: (weatherData.wind_speed_10m || 0) > thresholds.windSpeed,
      temperatureOutOfRange: (weatherData.temperature_2m || 0) < thresholds.minTemperature || 
                            (weatherData.temperature_2m || 0) > thresholds.maxTemperature
    };
  }

  static calculateRiskLevel(riskMetrics) {
    const riskFactors = [
      riskMetrics.exceedsRainThreshold,
      riskMetrics.exceedsHumidityThreshold,
      riskMetrics.exceedsWindThreshold,
      riskMetrics.temperatureOutOfRange
    ].filter(Boolean).length;

    if (riskFactors === 0) return 'LOW';
    if (riskFactors === 1) return 'MEDIUM';
    if (riskFactors >= 2) return 'HIGH';
    return 'UNKNOWN';
  }
}

module.exports = RiskAssessment;
