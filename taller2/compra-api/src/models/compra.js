const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// El orden de los campos aquí define el orden en el que Sequelize
// serializa cada compra en JSON (GET, POST y PUT). Mantenerlo igual
// al de init.sql evita que la API devuelva los datos en un orden
// distinto al documentado.
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
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
    },
  },
  // Monto total de la compra: precio del producto (al momento de comprar) x cantidad.
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'compra',
  timestamps: false,
});

module.exports = Compra;
