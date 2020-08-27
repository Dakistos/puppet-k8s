/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('cookies', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    value: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    pageUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    requestUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    hostOs: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    requestId: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    sameSite: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    secure: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cookiesCount: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    updatedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'cookies'
  });
};
