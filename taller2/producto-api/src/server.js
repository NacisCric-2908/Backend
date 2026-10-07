require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/database');
require('./models/producto');

const PORT = process.env.PORT || 3002;

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida en producto-api.');

    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados con la base de datos.');

    app.listen(PORT, () => {
      console.log(`producto-api escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar producto-api:', error.message);
    process.exit(1);
  }
}

iniciar();