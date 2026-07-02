/**
 * Catalogo central de roles del sistema (SAD Cap.2 / SRS 2.3).
 * Usado por los modelos (enum), el middleware RBAC y las rutas.
 */
const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN_EMPRESA: 'admin_empresa',
  JEFE_OBRA: 'jefe_obra',
  ALMACENISTA: 'almacenista',
  CONSTRUCTOR: 'constructor',
  CLIENTE: 'cliente',
});

const ROLE_LIST = Object.values(ROLES);

/**
 * Ruta base (panel) a la que pertenece cada rol. Se usa para redirigir
 * tras el login y para construir los enlaces de navegacion.
 */
const ROLE_HOME = Object.freeze({
  [ROLES.SUPER_ADMIN]: '/super_admin/dashboard',
  [ROLES.ADMIN_EMPRESA]: '/empresa/dashboard',
  [ROLES.JEFE_OBRA]: '/jefe_obra/dashboard',
  [ROLES.ALMACENISTA]: '/bodega/dashboard',
  [ROLES.CONSTRUCTOR]: '/construccion/dashboard',
  [ROLES.CLIENTE]: '/cliente/dashboard',
});

const ROLE_LABELS = Object.freeze({
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN_EMPRESA]: 'Admin. de Empresa',
  [ROLES.JEFE_OBRA]: 'Jefe de Obra',
  [ROLES.ALMACENISTA]: 'Almacenista',
  [ROLES.CONSTRUCTOR]: 'Constructor',
  [ROLES.CLIENTE]: 'Cliente',
});

module.exports = { ROLES, ROLE_LIST, ROLE_HOME, ROLE_LABELS };
