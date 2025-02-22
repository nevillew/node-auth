const { User } = require('../models');
const emailService = require('./emailService');

class NotificationService {
  async sendEmailNotification(userId, subject, message) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    return emailService.sendEmail({
      to: user.email,
      subject,
      html: message
    });
  }

  async sendSystemNotification(userId, message) {
    try {
      await Notification.create({
        userId,
        message,
        read: false
      });
    } catch (error) {
      console.error('Notification error:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
