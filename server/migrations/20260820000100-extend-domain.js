'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'active',
    });
    await queryInterface.addColumn('Users', 'warningCount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Users', 'photoUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('Organizations', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('Organizations', 'source', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'manual',
    });
    await queryInterface.addColumn('Organizations', 'googlePlaceId', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('Organizations', 'photoUrl', { type: Sequelize.STRING });
    await queryInterface.addColumn('Organizations', 'galleryUrls', { type: Sequelize.JSON, allowNull: true });
    await queryInterface.addColumn('Organizations', 'website', { type: Sequelize.STRING });
    await queryInterface.addColumn('Organizations', 'phone', { type: Sequelize.STRING });
    await queryInterface.addColumn('Organizations', 'email', { type: Sequelize.STRING });

    await queryInterface.addColumn('Items', 'wantedTitle', { type: Sequelize.STRING });
    await queryInterface.addColumn('Items', 'wantedDescription', { type: Sequelize.TEXT });
    await queryInterface.addColumn('Items', 'wantedImageUrl', { type: Sequelize.STRING });
    await queryInterface.addColumn('Items', 'wantedCategory', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.createTable('Notifications', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: { allowNull: false, type: Sequelize.STRING },
      requestId: { allowNull: true, type: Sequelize.INTEGER },
      conversationId: { allowNull: true, type: Sequelize.INTEGER },
      message: { allowNull: false, type: Sequelize.STRING },
      readAt: { allowNull: true, type: Sequelize.DATE },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('Shipments', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      requestId: {
        allowNull: false,
        unique: true,
        type: Sequelize.INTEGER,
        references: { model: 'Requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      method: { allowNull: true, type: Sequelize.STRING },
      payer: { allowNull: false, defaultValue: 'from_user', type: Sequelize.STRING },
      paymentStatus: { allowNull: false, defaultValue: 'not_required', type: Sequelize.STRING },
      trackingStatus: { allowNull: false, defaultValue: 'awaiting_method', type: Sequelize.STRING },
      midtransOrderId: { allowNull: true, type: Sequelize.STRING },
      snapToken: { allowNull: true, type: Sequelize.TEXT },
      grossAmount: { allowNull: false, defaultValue: 0, type: Sequelize.INTEGER },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Shipments');
    await queryInterface.dropTable('Notifications');
    await queryInterface.removeColumn('Items', 'wantedCategory');
    await queryInterface.removeColumn('Items', 'wantedImageUrl');
    await queryInterface.removeColumn('Items', 'wantedDescription');
    await queryInterface.removeColumn('Items', 'wantedTitle');
    await queryInterface.removeColumn('Organizations', 'email');
    await queryInterface.removeColumn('Organizations', 'phone');
    await queryInterface.removeColumn('Organizations', 'website');
    await queryInterface.removeColumn('Organizations', 'galleryUrls');
    await queryInterface.removeColumn('Organizations', 'photoUrl');
    await queryInterface.removeColumn('Organizations', 'googlePlaceId');
    await queryInterface.removeColumn('Organizations', 'source');
    await queryInterface.changeColumn('Organizations', 'userId', {
      type: queryInterface.sequelize.Sequelize.INTEGER,
      allowNull: false,
      unique: true,
    });
    await queryInterface.removeColumn('Users', 'photoUrl');
    await queryInterface.removeColumn('Users', 'warningCount');
    await queryInterface.removeColumn('Users', 'status');
  },
};
