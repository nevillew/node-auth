const nodemailer = require('nodemailer');
const { User } = require('../models');

class NotificationService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendEmailNotification(userId, subject, message) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject,
        html: message
      });
    } catch (error) {
      console.error('Notification error:', error);
      throw error;
    }
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
