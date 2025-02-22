const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const Email = require('email-templates');
const path = require('path');
const logger = require('../utils/logger');

const auth = {
  auth: {
    api_key: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
  }
};

const transporter = nodemailer.createTransport(mg(auth));

const email = new Email({
  message: {
    from: process.env.EMAIL_FROM
  },
  transport: transporter,
  views: {
    root: path.join(__dirname, '../templates/emails'),
    options: {
      extension: 'hbs'
    }
  },
  preview: process.env.NODE_ENV !== 'production',
  send: true
});

class EmailService {
  async sendTenantInvitation(to, { tenantName, invitedBy, invitationUrl, expiresAt }) {
    try {
      await email.send({
        template: 'tenant-invitation',
        message: { to },
        locals: {
          tenantName,
          invitedBy,
          invitationUrl,
          expiresAt: new Date(expiresAt).toLocaleDateString()
        }
      });
      logger.info(`Tenant invitation sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send tenant invitation:', error);
      throw error;
    }
  }

  async sendTenantDeletionNotice(to, { tenantName, deletedBy, date }) {
    try {
      await email.send({
        template: 'tenant-deleted',
        message: { to },
        locals: {
          tenantName,
          deletedBy,
          date: new Date(date).toLocaleDateString()
        }
      });
      logger.info(`Tenant deletion notice sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send tenant deletion notice:', error);
      throw error;
    }
  }

  async sendSecurityAlert(to, { type, details }) {
    try {
      await email.send({
        template: 'security-alert',
        message: { to },
        locals: {
          alertType: type,
          ...details,
          timestamp: new Date().toLocaleString()
        }
      });
      logger.info(`Security alert sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send security alert:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
