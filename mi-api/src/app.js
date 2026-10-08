const express = require('express');
const app = express();

app.use(express.json());

// Endpoint de bienvenida / verificación
app.get('/', (req, res) => {
  res.json({
    mensaje: '🎮 API REST de Videojuegos con PostgreSQL y Sequelize',
    recurso: '/juegos'
  });
});

// Rutas
const juegoRoutes = require('./routes/juegoRoutes');
app.use('/juegos', juegoRoutes);

module.exports = app;
