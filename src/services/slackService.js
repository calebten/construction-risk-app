const { WebClient } = require('@slack/web-api');
const config = require('../config');

class SlackService {
  constructor() {
    this.client = new WebClient(config.apis.slack.botToken);
    this.channelId = config.apis.slack.channelId;
  }

  async postRiskAlert(assessmentData) {
    const { siteAddress, date, riskLevel, aiAnalysis, riskMetrics } = assessmentData;
    
    const message = this.formatSlackMessage(siteAddress, date, riskLevel, aiAnalysis, riskMetrics);

    try {
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        ...message
      });

      return { success: true, messageId: result.ts };
    } catch (error) {
      console.error('Slack API error:', error.message);
      throw new Error('Failed to post to Slack');
    }
  }

  formatSlackMessage(siteAddress, date, riskLevel, aiAnalysis, riskMetrics) {
    const riskEmoji = {
      'LOW': '🟢',
      'MEDIUM': '🟡',
      'HIGH': '🔴'
    };

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${riskEmoji[riskLevel]} Concrete Pour Risk Alert`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Site:* ${siteAddress}`
          },
          {
            type: 'mrkdwn',
            text: `*Date:* ${date}`
          },
          {
            type: 'mrkdwn',
            text: `*Risk Level:* ${riskLevel}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*AI Analysis:*\n${aiAnalysis}`
        }
      }
    ];

    // Add weather details
    const weatherFields = [];
    if (riskMetrics.exceedsRainThreshold) weatherFields.push('⚠️ High rain probability');
    if (riskMetrics.exceedsHumidityThreshold) weatherFields.push('⚠️ High humidity');
    if (riskMetrics.exceedsWindThreshold) weatherFields.push('⚠️ High wind speed');
    if (riskMetrics.temperatureOutOfRange) weatherFields.push('⚠️ Temperature concerns');

    if (weatherFields.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Risk Factors:*\n${weatherFields.join('\n')}`
        }
      });
    }

    return { blocks };
  }
}

module.exports = SlackService;
