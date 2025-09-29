const axios = require('axios');
const config = require('../config');

class WeatherService {
  constructor() {
    this.baseUrl = config.apis.weather.baseUrl;
  }
async getWeatherData(latitude, longitude, date) {
  try {
    // Safely format date to YYYY-MM-DD format
    let formattedDate;
    if (typeof date === 'string') {
      formattedDate = date.split('T')[0]; // Remove time if present
    } else if (date instanceof Date) {
      formattedDate = date.toISOString().split('T')[0];
    } else {
      formattedDate = String(date).split('T')[0];
    }
    
    console.log('Original date:', date);
    console.log('Formatted date:', formattedDate);
    console.log('API URL:', `${this.baseUrl}/forecast`);
    
    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        latitude: latitude,
        longitude: longitude,
        start_date: formattedDate,
        end_date: formattedDate,
        hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m',
        timezone: 'auto'
      }
    });

    console.log('Weather API response status:', response.status);

    // Get the average of the day's hourly data
    const hourlyData = response.data.hourly;
    const dayData = this.calculateDayAverages(hourlyData);

    return dayData;
  } catch (error) {
    console.error('Weather API error details:', error.response?.data || error.message);
    console.error('Weather API error status:', error.response?.status);
    throw new Error('Failed to fetch weather data');
  }
}

  calculateDayAverages(hourlyData) {
    const hours = hourlyData.time.length;
    
    const avgTemp = this.average(hourlyData.temperature_2m);
    const avgHumidity = this.average(hourlyData.relative_humidity_2m);
    const maxRainProb = Math.max(...hourlyData.precipitation_probability);
    const avgWindSpeed = this.average(hourlyData.wind_speed_10m);

    return {
      temperature_2m: Math.round(avgTemp * 10) / 10,
      relative_humidity_2m: Math.round(avgHumidity),
      precipitation_probability: maxRainProb,
      wind_speed_10m: Math.round(avgWindSpeed * 10) / 10
    };
  }

  average(array) {
    const validValues = array.filter(val => val !== null && val !== undefined);
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }
}

module.exports = WeatherService;
