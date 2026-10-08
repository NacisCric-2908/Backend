require('dotenv').config();

const app       = require('./src/app');
const sequelize = require('./src/config/database');

const PORT = process.env.PORT || 3000;

async function iniciar() {
  try {
    // 1. Verifica que la conexión a PostgreSQL funciona
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida.');

    // 2. Sincroniza los modelos con la base de datos:
    //    - Si la tabla no existe, la crea.
    //    - Si el modelo cambió (nuevos campos), altera la tabla.
    //    - No borra datos existentes.
    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados con la base de datos.');

    // 3. Arranca el servidor HTTP
    app.listen(PORT, () => {
      console.log(`🎮 API corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error.message);
    process.exit(1); // sale con código de error para que Docker pueda reiniciar el contenedor
  }
}

iniciar();
