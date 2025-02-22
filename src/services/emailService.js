const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const logger = require('../config/logger');
const Email = require('email-templates');
const path = require('path');
const { emailQueue, bounceQueue } = require('./emailQueueService');

// Mailgun auth with webhooks
const auth = {
  auth: {
    api_key: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
  },
  webhookUrl: process.env.EMAIL_WEBHOOK_URL
};

// Create transporter
const transporter = nodemailer.createTransport(mg(auth));

// Configure email templates
const email = new Email({
  message: {
    from: process.env.EMAIL_FROM
  },
  transport: transporter,
  views: {
    root: path.join(__dirname, '../emails/templates'),
    options: {
      extension: 'hbs'
    }
  },
  preview: process.env.NODE_ENV !== 'production',
  send: true
});

class EmailService {
  async sendVerificationEmail(email, name, verificationUrl) {
    return emailQueue.add({
      template: 'verification',
      to: email,
      subject: 'Verify your email address',
      context: {
        name,
        verificationUrl,
        supportEmail: process.env.SUPPORT_EMAIL
      }
    });
  }

  async sendPasswordResetEmail(email, name, resetUrl) {
    return emailQueue.add({
      template: 'password-reset',
      to: email,
      subject: 'Password Reset Request',
      context: {
        name,
        resetUrl,
        supportEmail: process.env.SUPPORT_EMAIL
      }
    });
  }

  async sendWelcomeEmail(email, name) {
    return emailQueue.add({
      template: 'welcome',
      to: email,
      subject: 'Welcome to Our Platform!',
      context: {
        name,
        supportEmail: process.env.SUPPORT_EMAIL
      }
    });
  }

  async sendEmail({ to, subject, template, context, trackingId }) {
    // Add tracking pixel and click tracking
    context.trackingPixel = `${process.env.API_URL}/email/track/${trackingId}/open`;
    
    // Wrap links with tracking
    if (context.verificationUrl) {
      context.verificationUrl = `${process.env.API_URL}/email/track/${trackingId}/click?url=${encodeURIComponent(context.verificationUrl)}`;
    }
    if (context.resetUrl) {
      context.resetUrl = `${process.env.API_URL}/email/track/${trackingId}/click?url=${encodeURIComponent(context.resetUrl)}`;
    }

    return email.send({
      template,
      message: {
        to,
        subject,
      },
      locals: context
    });
  }

  // Webhook handlers
  async handleBounce(data) {
    return bounceQueue.add({
      email: data.recipient,
      reason: data.error,
      category: data.category
    });
  }

  async handleDelivery(data) {
    return emailQueue.getJob(data.trackingId).then(job => {
      if (job) {
        job.update({ delivered: true, deliveredAt: new Date() });
      }
    });
  }
}

module.exports = new EmailService();
