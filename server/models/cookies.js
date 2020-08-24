/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('cookies', {
    domain: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    date: {
      type: DataTypes.DATEONLY,
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
    name: {
      type: DataTypes.STRING(255),
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
