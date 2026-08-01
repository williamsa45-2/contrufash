const fetch = global.fetch;
const base = 'http://localhost:3000';
const users = [
  { role: 'SUPER_ADMIN', email: 'admin@gmail.com', password: '123456' },
  { role: 'ADMIN_EMPRESA', email: 'admin@horizonte.demo', password: 'Demo123!' },
  { role: 'JEFE_OBRA', email: 'jefe.lopez@horizonte.demo', password: 'Demo123!' },
  { role: 'ALMACENISTA', email: 'bodega@horizonte.demo', password: 'Demo123!' },
  { role: 'CONSTRUCTOR_1', email: 'constructor.gomez@horizonte.demo', password: 'Demo123!' },
  { role: 'CONSTRUCTOR_2', email: 'constructor.diaz@horizonte.demo', password: 'Demo123!' },
  { role: 'CLIENTE', email: 'cliente@horizonte.demo', password: 'Demo123!' },
];

async function request(method, url, body, token) {
  const options = { method, headers: {} };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  if (token) options.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, options);
  return { status: res.status, text: await res.text(), ok: res.ok };
}

(async () => {
  console.log('Starting role flow test...');
  for (const user of users) {
    console.log(`\n--- ${user.role} (${user.email}) ---`);
    try {
      const loginRes = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });
      const loginData = await loginRes.json();
      console.log('login', loginRes.status, loginData.ok, loginData.mensaje || loginData.redirect || '');
      if (!loginData.ok) continue;
      const token = loginData.token;
      const home = await request('GET', loginData.redirect, null, token);
      console.log('home', loginData.redirect, home.status, home.ok, `len=${home.text.length}`);

      if (user.role === 'SUPER_ADMIN') {
        const empresas = await request('GET', '/super_admin/empresas', null, token);
        console.log('empresas', empresas.status, empresas.ok);
      }
      if (user.role === 'ADMIN_EMPRESA') {
        const personal = await request('GET', '/empresa/personal', null, token);
        console.log('personal', personal.status, personal.ok);
        const proyectos = await request('GET', '/empresa/proyectos', null, token);
        console.log('proyectos', proyectos.status, proyectos.ok);
        const reportes = await request('GET', '/empresa/reportes', null, token);
        console.log('reportes', reportes.status, reportes.ok);
      }
      if (user.role === 'JEFE_OBRA') {
        const asistencia = await request('GET', '/jefe_obra/proyectos/1/fase/1/avance', null, token);
        console.log('avance sample', asistencia.status, asistencia.ok);
        const materiales = await request('GET', '/jefe_obra/proyectos/1/fase/1/materiales', null, token);
        console.log('materiales', materiales.status, materiales.ok);
      }
      if (user.role === 'ALMACENISTA') {
        const mat = await request('GET', '/bodega/materiales', null, token);
        console.log('materiales', mat.status, mat.ok);
        const kardex = await request('GET', '/bodega/kardex', null, token);
        console.log('kardex', kardex.status, kardex.ok);
      }
      if (user.role.startsWith('CONSTRUCTOR')) {
        const dash = await request('GET', '/construccion/dashboard', null, token);
        console.log('dashboard', dash.status, dash.ok);
        const fotos = await request('GET', '/construccion/proyectos/1/fase/1/fotos', null, token);
        console.log('fotos', fotos.status, fotos.ok);
      }
      if (user.role === 'CLIENTE') {
        const dash = await request('GET', '/cliente/dashboard', null, token);
        console.log('dashboard', dash.status, dash.ok);
      }
    } catch (err) {
      console.error('ERROR', err.message);
    }
  }
})();
