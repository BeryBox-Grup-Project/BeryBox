'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Reports');
    if (table.requestId) return;

    await queryInterface.addColumn('Reports', 'requestId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Requests', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Reports');
    if (!table.requestId) return;
    await queryInterface.removeColumn('Reports', 'requestId');
  },
};
