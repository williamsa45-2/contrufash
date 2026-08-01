const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');

async function main() {
  const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/construfash';
  await mongoose.connect(dbUri);

  const project = await Project.findOne({ nombre: /Aurora/ }).lean();
  if (!project) {
    console.log('No se encontró el proyecto Aurora');
    return;
  }

  console.log('projectId:', project._id.toString());
  project.fases.forEach((fase, index) => {
    console.log(`fase ${index + 1}:`, fase._id.toString(), fase.nombre, fase.personal_asignado.map((id) => id.toString()).join(', '));
  });

  const users = [
    'admin@gmail.com',
    'admin@horizonte.demo',
    'jefe.lopez@horizonte.demo',
    'bodega@horizonte.demo',
    'constructor.gomez@horizonte.demo',
    'constructor.diaz@horizonte.demo',
    'cliente@horizonte.demo',
  ];

  for (const email of users) {
    const user = await User.findOne({ email }).lean();
    console.log(email, user ? user._id.toString() : '<no encontrado>');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});