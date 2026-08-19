'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      username: { allowNull: false, unique: true, type: Sequelize.STRING },
      email: { allowNull: false, unique: true, type: Sequelize.STRING },
      password: { allowNull: false, type: Sequelize.STRING },
      role: { allowNull: false, defaultValue: 'user', type: Sequelize.STRING },
      latitude: { allowNull: false, type: Sequelize.FLOAT },
      longitude: { allowNull: false, type: Sequelize.FLOAT },
      addressLabel: { type: Sequelize.STRING },
      creditBalance: { allowNull: false, defaultValue: 0, type: Sequelize.INTEGER },
      ratingAvg: { allowNull: false, defaultValue: 0, type: Sequelize.FLOAT },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Users');
  },
};
