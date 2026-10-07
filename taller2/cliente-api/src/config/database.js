const path = require('path');
const { Sequelize } = require('sequelize');

// Carga variables locales si existen, o desde la raíz de taller2
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'taller2_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

module.exports = sequelize;
