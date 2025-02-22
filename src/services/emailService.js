const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Mailgun auth
const auth = {
  auth: {
    api_key: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
  }
};

// Create transporter
const transporter = nodemailer.createTransport(mg(auth));

// Load and compile templates
const templates = {
  verification: loadTemplate('verification.hbs'),
  passwordReset: loadTemplate('password-reset.hbs'),
  welcome: loadTemplate('welcome.hbs')
};

function loadTemplate(templateName) {
  const templatePath = path.join(__dirname, '../emails/templates', templateName);
  const source = fs.readFileSync(templatePath, 'utf8');
  return handlebars.compile(source);
}

class EmailService {
  async sendVerificationEmail(email, name, verificationUrl) {
    const html = templates.verification({
      name,
      verificationUrl,
      supportEmail: process.env.SUPPORT_EMAIL
    });

    return this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      html
    });
  }

  async sendPasswordResetEmail(email, name, resetUrl) {
    const html = templates.passwordReset({
      name,
      resetUrl,
      supportEmail: process.env.SUPPORT_EMAIL
    });

    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html
    });
  }

  async sendWelcomeEmail(email, name) {
    const html = templates.welcome({
      name,
      supportEmail: process.env.SUPPORT_EMAIL
    });

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Our Platform!',
      html
    });
  }

  async sendEmail({ to, subject, html }) {
    return transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    });
  }
}

module.exports = new EmailService();
