require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/database');
require('./models/compra');

const PORT = process.env.PORT || 3003;

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida en compra-api.');

    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados con la base de datos.');

    app.listen(PORT, () => {
      console.log(`Compra-api escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar compra-api:', error.message);
    process.exit(1);
  }
}

iniciar();