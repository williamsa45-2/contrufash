const mongoose = require('mongoose');

/**
 * Conexion a MongoDB.
 * No tumba el proceso si falla: el servidor Express sigue arriba para que
 * /login y los assets estaticos respondan, pero cualquier ruta que toque
 * la base de datos fallara hasta que la conexion se restablezca.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/construfash';

  mongoose.connection.on('connected', () => {
    console.log(`[DB] Conectado a MongoDB -> ${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[DB] Error de conexion:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] Desconectado de MongoDB');
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (err) {
    console.error('[DB] No fue posible conectar en el arranque:', err.message);
    console.error('     Verifica que MongoDB este corriendo y que MONGO_URI sea correcto en .env');
  }
}

module.exports = connectDB;
