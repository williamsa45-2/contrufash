const base = 'http://127.0.0.1:3000';
const users = [
  { role: 'SUPER_ADMIN', email: 'admin@gmail.com', password: '123456' },
  { role: 'ADMIN_EMPRESA', email: 'admin@horizonte.demo', password: 'Demo123!' },
  { role: 'JEFE_OBRA', email: 'jefe.lopez@horizonte.demo', password: 'Demo123!' },
  { role: 'ALMACENISTA', email: 'bodega@horizonte.demo', password: 'Demo123!' },
  { role: 'CONSTRUCTOR_GOMEZ', email: 'constructor.gomez@horizonte.demo', password: 'Demo123!', fase: '6a6e1cbe3cc4535d236f037e' },
  { role: 'CONSTRUCTOR_DIAZ', email: 'constructor.diaz@horizonte.demo', password: 'Demo123!', fase: '6a6e1cbe3cc4535d236f0380' },
  { role: 'CLIENTE', email: 'cliente@horizonte.demo', password: 'Demo123!' },
];

const routesByRole = {
  SUPER_ADMIN: ['/super_admin/dashboard', '/super_admin/empresas'],
  ADMIN_EMPRESA: ['/empresa/dashboard', '/empresa/personal', '/empresa/proyectos', '/empresa/reportes'],
  JEFE_OBRA: ['/jefe_obra/dashboard', '/jefe_obra/proyectos/6a6e1cbe3cc4535d236f037d/fase/6a6e1cbe3cc4535d236f0380/avance', '/jefe_obra/proyectos/6a6e1cbe3cc4535d236f037d/fase/6a6e1cbe3cc4535d236f0380/materiales', '/jefe_obra/api/asistencia/historial/6a6e1cbe3cc4535d236f037d/6a6e1cbe3cc4535d236f0380'],
  ALMACENISTA: ['/bodega/dashboard', '/bodega/materiales', '/bodega/kardex'],
  CLIENTE: ['/cliente/dashboard'],
};

async function request(method, url, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers });
  const text = await res.text();
  return { status: res.status, ok: res.ok, textLength: text.length, text }; 
}

async function loginUser(user) {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

(async () => {
  console.log('Starting roleFlowTest3...');
  for (const user of users) {
    console.log(`\n=== ${user.role} (${user.email}) ===`);
    try {
      const login = await loginUser(user);
      console.log('login', login.status, login.body.ok, login.body.redirect || login.body.mensaje || '');
      if (!login.body.ok) continue;
      const token = login.body.token;
      const home = await request('GET', login.body.redirect, token);
      console.log('home', login.body.redirect, home.status, home.ok, 'len=' + home.textLength);

      if (user.role.startsWith('CONSTRUCTOR')) {
        const rutaFotos = `/construccion/proyectos/6a6e1cbe3cc4535d236f037d/fase/${user.fase}/fotos`;
        const fotos = await request('GET', rutaFotos, token);
        console.log('fotos', rutaFotos, fotos.status, fotos.ok, 'len=' + fotos.textLength);
      }

      const roleKey = user.role.replace(/_.*$/, '');
      const routes = routesByRole[roleKey];
      if (routes) {
        for (const route of routes) {
          const r = await request('GET', route, token);
          console.log(route, r.status, r.ok, 'len=' + r.textLength);
        }
      }
    } catch (err) {
      console.error('EXCEPTION', err.stack || err.message);
    }
  }
})();
