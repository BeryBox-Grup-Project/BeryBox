'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Organizations" ALTER COLUMN "userId" DROP NOT NULL',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM "Organizations" WHERE "userId" IS NULL
    `);
    await queryInterface.sequelize.query(
      'ALTER TABLE "Organizations" ALTER COLUMN "userId" SET NOT NULL',
    );
  },
};
