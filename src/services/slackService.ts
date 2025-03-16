import { WebClient } from '@slack/web-api';
import { Result, success, failure, ErrorCode } from '../utils/errors';
import logger from '../config/logger';

// Types for Slack service
interface SlackMessageParams {
  channel: string;
  text: string;
  blocks?: any[];
}

// Initialize Slack client
const client = new WebClient(process.env.SLACK_TOKEN);

/**
 * Send a message to a Slack channel
 */
export const sendMessage = async (
  params: SlackMessageParams
): Promise<Result<boolean>> => {
  try {
    const { channel, text, blocks } = params;
    
    await client.chat.postMessage({
      channel,
      text,
      blocks,
      icon_emoji: ':robot_face:',
      username: 'System Bot'
    });
    
    return success(true);
  } catch (err) {
    logger.error('Slack notification failed:', { error: err });
    
    // Don't throw - best effort delivery
    return success(false);
  }
};
