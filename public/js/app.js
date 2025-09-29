class RiskAssessmentApp {
    constructor() {
        this.form = document.getElementById('riskForm');
        this.loading = document.getElementById('loading');
        this.results = document.getElementById('results');
        this.error = document.getElementById('error');
        this.submitBtn = document.getElementById('submitBtn');
        
        this.initializeEventListeners();
        this.setDefaultDate();
    }

    initializeEventListeners() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    setDefaultDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('date').value = tomorrow.toISOString().split('T')[0];
    }

    async handleSubmit(event) {
        event.preventDefault();
        console.log('Form submitted!');
        
        this.showLoading();
        this.hideResults();
        this.hideError();

        const formData = new FormData(this.form);
        const requestData = {
            siteAddress: formData.get('siteAddress'),
            date: formData.get('date')
        };

        console.log('Request data:', requestData);

        try {
            console.log('Sending request to /api/assess-risk');
            const response = await fetch('/api/assess-risk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('Response received:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (data.success) {
                this.displayResults(data.assessment, data.notifications);
            } else {
                this.showError(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Request failed:', error);
            this.showError('Network error: Unable to connect to the server. Error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    showLoading() {
        this.loading.classList.remove('hidden');
        this.submitBtn.disabled = true;
        this.submitBtn.textContent = 'Analyzing...';
    }

    hideLoading() {
        this.loading.classList.add('hidden');
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = 'Assess Risk';
    }

    displayResults(assessment, notifications) {
        // Set risk level badge
        const riskBadge = document.getElementById('riskBadge');
        riskBadge.textContent = `${assessment.riskLevel} Risk`;
        riskBadge.className = `risk-badge risk-${assessment.riskLevel.toLowerCase()}`;

        // Display weather data
        this.displayWeatherData(assessment.weatherData, assessment.riskMetrics);

        // Display AI analysis
        document.getElementById('aiAnalysis').textContent = assessment.aiAnalysis;

        // Display notifications
        this.displayNotifications(notifications);

        this.showResults();
    }

    displayWeatherData(weatherData, riskMetrics) {
        const weatherGrid = document.getElementById('weatherData');
        
        const weatherItems = [
            {
                label: 'Temperature',
                value: `${weatherData.temperature_2m}°C`,
                isRisk: riskMetrics.temperatureOutOfRange
            },
            {
                label: 'Humidity',
                value: `${weatherData.relative_humidity_2m}%`,
                isRisk: riskMetrics.exceedsHumidityThreshold
            },
            {
                label: 'Rain Probability',
                value: `${weatherData.precipitation_probability}%`,
                isRisk: riskMetrics.exceedsRainThreshold
            },
            {
                label: 'Wind Speed',
                value: `${weatherData.wind_speed_10m} km/h`,
                isRisk: riskMetrics.exceedsWindThreshold
            }
        ];

        weatherGrid.innerHTML = weatherItems.map(item => `
            <div class="weather-item">
                <div class="weather-label">${item.label} ${item.isRisk ? '⚠️' : '✅'}</div>
                <div class="weather-value">${item.value}</div>
            </div>
        `).join('');
    }

    displayNotifications(notifications) {
        const notificationsDiv = document.getElementById('notifications');
        
        const items = [
            {
                service: 'Slack Alert',
                status: notifications.slack,
                icon: notifications.slack === 'sent' ? '✅' : '❌'
            },
            {
                service: 'Google Sheets Log',
                status: notifications.sheets,
                icon: notifications.sheets === 'logged' ? '✅' : '❌'
            }
        ];

        notificationsDiv.innerHTML = items.map(item => `
            <div class="notification-item notification-${item.status === 'sent' || item.status === 'logged' ? 'success' : 'failed'}">
                ${item.icon} ${item.service}: ${item.status}
            </div>
        `).join('');
    }

    showResults() {
        this.results.classList.remove('hidden');
    }

    hideResults() {
        this.results.classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        this.error.classList.remove('hidden');
    }

    hideError() {
        this.error.classList.add('hidden');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new RiskAssessmentApp();
});
