'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      Review.belongsTo(models.Request, { foreignKey: 'requestId' });
    }
  }

  Review.init({
    requestId: { type: DataTypes.INTEGER, allowNull: false },
    fromUserId: { type: DataTypes.INTEGER, allowNull: false },
    toUserId: { type: DataTypes.INTEGER, allowNull: false },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [5] },
    },
  }, {
    sequelize,
    modelName: 'Review',
    indexes: [{ unique: true, fields: ['requestId', 'fromUserId'] }],
  });

  return Review;
};
