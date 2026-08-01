const base = 'http://127.0.0.1:3000';

async function request(url, method = 'GET', body = null, token = null, isJson = true) {
  const headers = {};
  const options = { method, headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) {
    if (isJson) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    } else {
      options.body = body;
    }
  }
  console.log(`FETCH ${method} ${url} bodyType=${body ? body.constructor.name : 'none'}`);
  try {
    const res = await fetch(base + url, options);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { }
    return { status: res.status, ok: res.ok, text, json };
  } catch (err) {
    console.error(`FETCH ERROR ${method} ${url}:`, err.message);
    return { status: null, ok: false, text: null, json: null, error: err.message };
  }
}

async function login(email, password) {
  const res = await request('/api/auth/login', 'POST', { email, password });
  return { ...res, token: res.json?.token };
}

async function main() {
  const ids = {
    proyectoId: '6a6e1cbe3cc4535d236f037d',
    fase3: '6a6e1cbe3cc4535d236f0380',
    fase4: '6a6e1cbe3cc4535d236f0381',
  };

  console.log('1) Login y flujo de material de Jefe de Obra -> Admin -> Almacenista');
  const jefe = await login('jefe.lopez@horizonte.demo', 'Demo123!');
  console.log('jefe login', jefe.status, jefe.ok);
  if (!jefe.ok) return;

  const solicitud = await request('/api/materiales/solicitar', 'POST', {
    proyecto_id: ids.proyectoId,
    fase_id: ids.fase3,
    items_json: JSON.stringify([
      { nombre: 'Cemento', cantidad: 20 },
      { nombre: 'Bloque', cantidad: 150 },
    ]),
    observacion: 'Solicitud de prueba automatizada',
  }, jefe.token);
  console.log('crear solicitud', solicitud.status, solicitud.ok, solicitud.json || solicitud.text);
  if (!solicitud.ok) return;
  const solicitudId = solicitud.json.solicitudId;

  const admin = await login('admin@horizonte.demo', 'Demo123!');
  console.log('admin login', admin.status, admin.ok);
  if (!admin.ok) return;

  // Revisar que la solicitud aparece en la lista
  const listaAdmin = await request('/empresa/materiales', 'GET', null, admin.token);
  console.log('empresa/materiales', listaAdmin.status, listaAdmin.ok);

  const aprobar = await request(`/api/materiales/${solicitudId}/aprobar`, 'POST', {}, admin.token);
  console.log('aprobar solicitud', aprobar.status, aprobar.ok, aprobar.json || aprobar.text);
  if (!aprobar.ok) return;

  const almacenista = await login('bodega@horizonte.demo', 'Demo123!');
  console.log('almacenista login', almacenista.status, almacenista.ok);
  if (!almacenista.ok) return;

  const listarPendientes = await request('/bodega/materiales', 'GET', null, almacenista.token);
  console.log('bodega/materiales', listarPendientes.status, listarPendientes.ok);

  if (typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
    const form = new FormData();
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const buffer = Buffer.from(pngBase64, 'base64');
    const fakeImage = new Blob([buffer], { type: 'image/png' });
    form.append('foto', fakeImage, 'evidence.png');
    form.append('observacion', 'Evidencia de entrega automatizada');

    const despachar = await request(`/api/materiales/${solicitudId}/despachar`, 'POST', form, almacenista.token, false);
    console.log('despachar solicitud', despachar.status, despachar.ok, despachar.json || despachar.text);
  } else {
    console.log('FormData no disponible, no se prueba despacho con foto.');
  }

  console.log('\n2) Prueba de asistencia en Jefe de Obra');
  const asistenciaPage = await request(`/jefe_obra/proyectos/${ids.proyectoId}/fase/${ids.fase3}/asistencia`, 'GET', null, jefe.token);
  console.log('asistencia page', asistenciaPage.status, asistenciaPage.ok);

  const guardarAsistencia = await request('/api/asistencia/guardar', 'POST', {
    proyecto_id: ids.proyectoId,
    fase_id: ids.fase3,
    fecha: new Date().toISOString().slice(0, 10),
    registros: [
      { usuario_id: '6a6e1cbe3cc4535d236f0378', presente: true },
      { usuario_id: '6a6e1cbe3cc4535d236f0375', presente: true },
    ],
  }, jefe.token);
  console.log('guardar asistencia', guardarAsistencia.status, guardarAsistencia.ok, guardarAsistencia.json || guardarAsistencia.text);

  const historial = await request(`/api/asistencia/historial/${ids.proyectoId}/${ids.fase3}`, 'GET', null, jefe.token);
  console.log('historial asistencia', historial.status, historial.ok, historial.json?.registros?.length ?? 'no json');

  console.log('\n3) Prueba de sync offline asistencia');
  const sync = await request('/api/asistencia/sync', 'POST', {
    registros: [
      {
        proyecto_id: ids.proyectoId,
        fase_id: ids.fase3,
        fecha: new Date().toISOString().slice(0, 10),
        registros: [
          { usuario_id: '6a6e1cbe3cc4535d236f0378', presente: false },
        ],
        timestamp_cliente: new Date().toISOString(),
      },
    ],
  }, jefe.token);
  console.log('sync asistencia', sync.status, sync.ok, sync.json || sync.text);

  console.log('\n4) Prueba de alerta del constructor');
  const constructor = await login('constructor.gomez@horizonte.demo', 'Demo123!');
  const alerta = await request('/api/construccion/alerta', 'POST', {
    proyecto_id: ids.proyectoId,
    fase_id: ids.fase4,
    mensaje: 'Prueba de alerta automatizada',
  }, constructor.token);
  console.log('alerta constructor', alerta.status, alerta.ok, alerta.json || alerta.text);

  console.log('\n5) Prueba de notificaciones');
  const notifs = await request('/perfil/api/notificaciones/sin-leer', 'GET', null, jefe.token);
  console.log('notifs sin leer', notifs.status, notifs.ok, notifs.json || notifs.text);

  console.log('\n6) Prueba de cliente galeria');
  const galeria = await request(`/cliente/proyectos/${ids.proyectoId}/galeria`, 'GET', null, await login('cliente@horizonte.demo', 'Demo123!').then((u) => u.token));
  console.log('cliente galeria', galeria.status, galeria.ok);

  console.log('\n7) Prueba de reportes y export');
  const reportesAdmin = await request(`/api/reportes/proyecto/${ids.proyectoId}`, 'GET', null, admin.token);
  console.log('api reportes proyecto', reportesAdmin.status, reportesAdmin.ok);
}

main().catch((err) => {
  console.error('EXCEPTION', err.stack || err.message);
});
