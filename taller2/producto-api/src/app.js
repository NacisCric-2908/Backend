const express = require('express');
const sequelize = require('./config/database');
const productosRoutes = require('./routes/productos.routes');

const app = express();

app.use(express.json());

// Ruta Health Check
app.get('/', async (req, res) => {
  try {
    const [resultado] = await sequelize.query('SELECT NOW() AS now');
    res.status(200).json({
      mensaje: 'Conexion exitosa, producto-api activa',
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

// Rutas de productos
app.use('/productos', productosRoutes);

module.exports = app;
