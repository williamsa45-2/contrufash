const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;
const { ROLE_LIST, ROLES } = require('../utils/roles');

const userSchema = new Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    password_hash: {
      type: String,
      required: true,
      select: false, // nunca se devuelve por defecto en consultas
    },
    rol: {
      type: String,
      enum: ROLE_LIST,
      required: true,
      index: true,
    },
    // Obligatorio para todos los roles excepto super_admin, que es global.
    tenant_id: {
      type: String,
      default: null,
      index: true,
      validate: {
        validator: function (value) {
          if (this.rol === ROLES.SUPER_ADMIN) return true;
          return Boolean(value);
        },
        message: 'tenant_id es obligatorio para todos los roles excepto super_admin',
      },
    },
    estado: {
      type: String,
      enum: ['activo', 'inactivo'],
      default: 'activo',
    },
    telefono: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

// Virtual de conveniencia, no se persiste, solo para asignar password en texto plano
userSchema.virtual('password').set(function (plain) {
  this._password = plain;
});

userSchema.pre('validate', async function (next) {
  if (!this._password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password_hash = await bcrypt.hash(this._password, salt);
  next();
});

userSchema.methods.compararPassword = function (plain) {
  return bcrypt.compare(plain, this.password_hash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    nombre: this.nombre,
    email: this.email,
    rol: this.rol,
    tenant_id: this.tenant_id,
    estado: this.estado,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
