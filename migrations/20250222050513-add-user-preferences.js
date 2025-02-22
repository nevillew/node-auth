'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'preferences', {
      type: Sequelize.JSON,
      defaultValue: {
        theme: 'light',
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        accessibility: {
          highContrast: false,
          fontSize: 'normal'
        },
        privacy: {
          profileVisibility: 'public',
          activityVisibility: 'private'
        }
      }
    });

    await queryInterface.addColumn('Users', 'emailPreferences', {
      type: Sequelize.JSON,
      defaultValue: {
        marketing: true,
        updates: true,
        security: true,
        newsletter: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'preferences');
    await queryInterface.removeColumn('Users', 'emailPreferences');
  }
};
