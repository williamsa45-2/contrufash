const mongoose = require('mongoose');
const Project = require('../models/Project');
const MaterialRequest = require('../models/MaterialRequest');
const CompliancePhoto = require('../models/CompliancePhoto');
const Attendance = require('../models/Attendance');
const Novedad = require('../models/Novedad');
const KardexEntry = require('../models/KardexEntry');
const User = require('../models/User');

async function main() {
  const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/construfash';
  await mongoose.connect(dbUri);

  const project = await Project.findOne({ nombre: /Aurora/ }).lean();
  console.log('Project:', project ? project._id.toString() : '<none>');
  if (project) {
    project.fases.forEach((fase, index) => {
      console.log(`fase${index + 1}:`, fase._id.toString(), fase.nombre, fase.estado, fase.personal_asignado.map((id) => id.toString()).join(', '));
    });
  }

  const users = await User.find({ email: { $in: ['admin@gmail.com', 'admin@horizonte.demo', 'jefe.lopez@horizonte.demo', 'bodega@horizonte.demo', 'constructor.gomez@horizonte.demo', 'constructor.diaz@horizonte.demo', 'cliente@horizonte.demo'] } }).lean();
  users.forEach((u) => console.log('user', u.email, u.rol, u._id.toString()));

  const reqs = await MaterialRequest.find({}).limit(5).lean();
  console.log('MaterialRequest count', await MaterialRequest.countDocuments());
  reqs.forEach((req) => console.log('MR', req._id.toString(), req.proyecto_id.toString(), req.fase_id.toString(), req.estado, req.material, req.cantidad));

  const photos = await CompliancePhoto.find({}).limit(5).lean();
  console.log('CompliancePhoto count', await CompliancePhoto.countDocuments());
  photos.forEach((p) => console.log('Photo', p._id.toString(), p.proyecto_id.toString(), p.fase_id.toString(), p.constructor_id.toString(), p.estado));

  const attendances = await Attendance.find({}).limit(5).lean();
  console.log('Attendance count', await Attendance.countDocuments());
  attendances.forEach((a) => console.log('Attendance', a._id.toString(), a.proyecto_id.toString(), a.fase_id.toString(), a.registros?.length ?? 0));

  const novedades = await Novedad.find({}).limit(5).lean();
  console.log('Novedad count', await Novedad.countDocuments());
  novedades.forEach((n) => console.log('Novedad', n._id.toString(), n.proyecto_id.toString(), n.fase_id.toString(), n.estado));

  const kardex = await KardexEntry.find({}).limit(5).lean();
  console.log('KardexEntry count', await KardexEntry.countDocuments());
  kardex.forEach((k) => console.log('Kardex', k._id.toString(), k.proyecto_id.toString(), k.tipo, k.cantidad, k.descripcion));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});