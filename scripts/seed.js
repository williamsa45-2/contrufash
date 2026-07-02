require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { ROLES } = require('../utils/roles');

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/construfash';
  await mongoose.connect(uri);
  console.log(`[Seed] Conectado a ${mongoose.connection.name}`);

  const email = (process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@construfash.local').toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD || 'CambiarEsta123!';

  const existente = await User.findOne({ email });
  if (existente) {
    console.log(`[Seed] Ya existe un usuario con email ${email}, no se crea duplicado.`);
  } else {
    const superAdmin = new User({
      nombre: 'Super Admin',
      email,
      rol: ROLES.SUPER_ADMIN,
      tenant_id: null,
    });
    superAdmin.password = password;
    await superAdmin.save();
    console.log('[Seed] Super Admin creado:');
    console.log(`        email:    ${email}`);
    console.log(`        password: ${password}`);
    console.log('[Seed] Cambia esta contrasena despues del primer login.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
