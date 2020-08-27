/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('requests', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    pageUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    requestId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    interceptionId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    initialPriority: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'requests'
  });
};
