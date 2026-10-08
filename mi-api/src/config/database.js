const { Sequelize } = require('sequelize');

// Sequelize lee las variables de entorno para construir la conexión.
// En local vienen del archivo .env (cargado por dotenv en index.js).
// En Docker Compose o en la VM vienen de las variables del contenedor o del sistema.
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // cambia a true si quieres ver las consultas SQL que genera Sequelize
  }
);

module.exports = sequelize;
