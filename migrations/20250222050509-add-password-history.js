'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'passwordHistory', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      defaultValue: []
    });

    await queryInterface.addColumn('Users', 'passwordChangedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('Users', 'failedLoginAttempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });

    await queryInterface.addColumn('Users', 'accountLockedUntil', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'passwordHistory');
    await queryInterface.removeColumn('Users', 'passwordChangedAt');
    await queryInterface.removeColumn('Users', 'failedLoginAttempts');
    await queryInterface.removeColumn('Users', 'accountLockedUntil');
  }
};
