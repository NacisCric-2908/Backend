const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Compra = sequelize.define('Compra', {
  id_compra: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_cliente: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  id_producto: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
    },
  },
}, {
  tableName: 'compra',
  timestamps: false,
});

module.exports = Compra;
