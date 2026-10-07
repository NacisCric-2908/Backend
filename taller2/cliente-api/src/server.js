require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/database');
require('./models/cliente');

const PORT = process.env.PORT || 3001;

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida en cliente-api.');

    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados con la base de datos.');

    app.listen(PORT, () => {
      console.log(`Cliente-api escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar cliente-api:', error.message);
    process.exit(1);
  }
}

iniciar();