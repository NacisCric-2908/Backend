const express = require('express');
const sequelize = require('./config/database');
const comprasRoutes = require('./routes/compras.routes');

const app = express();

app.use(express.json());

// Ruta Health Check
app.get('/', async (req, res) => {
  try {
    const [resultado] = await sequelize.query('SELECT NOW() AS now');
    res.status(200).json({
      mensaje: 'Conexion exitosa, compra-api activa',
      fechaPostgres: resultado[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error conectando con PostgreSQL',
      detalle: error.message,
    });
  }
});

// Rutas de compras
app.use('/compras', comprasRoutes);

module.exports = app;
