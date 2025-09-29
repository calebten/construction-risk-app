const axios = require('axios');

/**
 * Get coordinates from address using OpenStreetMap Nominatim API (free)
 */
async function getCoordinates(address) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'ConstructionRiskApp/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name
      };
    }

    throw new Error('Address not found');
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw new Error('Failed to geocode address');
  }
}

module.exports = { getCoordinates };
