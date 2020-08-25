/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('cookies', {
    domain: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    name: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    value: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    hostOs: {
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
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    tableName: 'cookies'
  });
};
