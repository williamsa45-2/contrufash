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

const ids = {
  proyectoId: '6a6e1cbe3cc4535d236f037d',
  fase1: '6a6e1cbe3cc4535d236f037e',
  fase2: '6a6e1cbe3cc4535d236f037f',
  fase3: '6a6e1cbe3cc4535d236f0380',
};

async function request(method, url, body, token) {
  const headers = {};
  let options = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, options);
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

(async () => {
  console.log('Starting complete role flow test...');
  for (const user of users) {
    console.log(`\n--- ${user.role} (${user.email}) ---`);
    try {
      const loginRes = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });
      const loginData = await loginRes.json();
      console.log('login', loginRes.status, loginData.ok, loginData.redirect || loginData.mensaje || '');
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
        const rutaAvance = `/jefe_obra/proyectos/${ids.proyectoId}/fase/${ids.fase3}/avance`;
        const avance = await request('GET', rutaAvance, null, token);
        console.log('avance sample', rutaAvance, avance.status, avance.ok);
        const rutaMateriales = `/jefe_obra/proyectos/${ids.proyectoId}/fase/${ids.fase3}/materiales`;
        const materiales = await request('GET', rutaMateriales, null, token);
        console.log('materiales', rutaMateriales, materiales.status, materiales.ok);
        const historial = await request('GET', `/jefe_obra/api/asistencia/historial/${ids.proyectoId}/${ids.fase3}`, null, token);
        console.log('historial asistencia', historial.status, historial.ok);
      }

      if (user.role === 'ALMACENISTA') {
        const materiales = await request('GET', '/bodega/materiales', null, token);
        console.log('materiales', materiales.status, materiales.ok);
        const kardex = await request('GET', '/bodega/kardex', null, token);
        console.log('kardex', kardex.status, kardex.ok);
      }

      if (user.role.startsWith('CONSTRUCTOR')) {
        const dash = await request('GET', '/construccion/dashboard', null, token);
        console.log('dashboard', dash.status, dash.ok);
        const rutaFotos = `/construccion/proyectos/${ids.proyectoId}/fase/${ids.fase3}/fotos`;
        const fotos = await request('GET', rutaFotos, null, token);
        console.log('fotos', rutaFotos, fotos.status, fotos.ok);
      }

      if (user.role === 'CLIENTE') {
        const dash = await request('GET', '/cliente/dashboard', null, token);
        console.log('dashboard', dash.status, dash.ok);
      }
    } catch (err) {
      console.error('ERROR', err.stack || err.message);
    }
  }
})();
