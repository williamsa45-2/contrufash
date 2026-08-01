require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');

const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const { verificarToken } = require('./utils/jwt');
const { ROLE_HOME, ROLE_LABELS } = require('./utils/roles');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const landingRoutes      = require('./routes/landingRoutes');
const authRoutes        = require('./routes/authRoutes');
const superAdminRoutes  = require('./routes/superAdminRoutes');
const empresaRoutes     = require('./routes/empresaRoutes');
const panelRoutes       = require('./routes/panelRoutes');
const jefeObraRoutes    = require('./routes/jefeObraRoutes');
const bodegaRoutes      = require('./routes/bodegaRoutes');
const constructorRoutes = require('./routes/constructorRoutes');   // Sprint 4
const clienteRoutes     = require('./routes/clienteRoutes');       // Sprint 4
const perfilRoutes      = require('./routes/perfilRoutes');        // Sprint 4
const apiRoutes         = require('./routes/apiRoutes');

const app = express();
const httpServer = http.createServer(app);

// --- Socket.io ---
initSocket(httpServer);

// --- Vistas ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// --- Middlewares globales ---
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.locals.ROLE_LABELS = ROLE_LABELS;
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// --- Rutas ---
// La raiz muestra la landing publica de ConstruFash. Si ya hay una sesion
// valida (cookie con JWT), se redirige directo al panel del rol.
app.get('/', (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (token) {
    try {
      const payload = verificarToken(token);
      return res.redirect(ROLE_HOME[payload.rol] || '/login');
    } catch (e) {
      res.clearCookie('token');
    }
  }
  next();
});

app.use('/', landingRoutes);
app.use('/', authRoutes);
app.use('/super_admin', superAdminRoutes);
app.use('/empresa', empresaRoutes);
app.use('/', panelRoutes);
app.use('/jefe_obra', jefeObraRoutes);
app.use('/bodega', bodegaRoutes);
app.use('/construccion', constructorRoutes);   // Sprint 4
app.use('/cliente', clienteRoutes);            // Sprint 4
app.use('/perfil', perfilRoutes);              // Sprint 4
app.use('/', apiRoutes);

app.get('/health', (req, res) => res.json({ ok: true, servicio: 'ConstruFash', version: '2.4.0-sprint4' }));

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

(async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`[ConstruFash] Servidor escuchando en http://localhost:${PORT}`);
  });
})();

module.exports = app;
