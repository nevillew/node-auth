'use strict';

// This migration is now empty since these columns were already added
// in migration 20250222000003-add-user-activity-tracking
module.exports = {
  async up(queryInterface, Sequelize) {
    // Columns already exist
  },

  async down(queryInterface, Sequelize) {
    // Do nothing since we didn't add the columns
  }
};
