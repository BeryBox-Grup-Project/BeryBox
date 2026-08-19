'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Items', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      ownerId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      type: { allowNull: false, type: Sequelize.STRING },
      title: { allowNull: false, type: Sequelize.STRING },
      description: { allowNull: false, type: Sequelize.TEXT },
      condition: { allowNull: false, type: Sequelize.STRING },
      category: { allowNull: false, type: Sequelize.STRING },
      creditValue: { allowNull: false, defaultValue: 0, type: Sequelize.INTEGER },
      latitude: { type: Sequelize.FLOAT },
      longitude: { type: Sequelize.FLOAT },
      addressLabel: { type: Sequelize.STRING },
      imageUrl: { type: Sequelize.STRING },
      status: { allowNull: false, defaultValue: 'available', type: Sequelize.STRING },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Items');
  },
};
