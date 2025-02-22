const { WebClient } = require('@slack/web-api');
const logger = require('../config/logger');

class SlackService {
  constructor() {
    this.client = new WebClient(process.env.SLACK_TOKEN);
  }

  async sendMessage({ channel, text, blocks }) {
    try {
      await this.client.chat.postMessage({
        channel,
        text,
        blocks,
        icon_emoji: ':robot_face:',
        username: 'System Bot'
      });
    } catch (error) {
      logger.error('Slack notification failed:', error);
    }
  }
}

module.exports = new SlackService();
