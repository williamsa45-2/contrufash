# ConstruFash

Aplicación web de gestión de construcción con multi-tenant, roles, control de avances, solicitudes de materiales, fotos de cumplimiento y notificaciones.

## Requisitos

- Node.js 18+ o compatible
- MongoDB funcionando localmente o remoto
- `.env` con variables de configuración

## Instalación

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea un archivo `.env` en la raíz con al menos estas variables:
   ```bash
   MONGO_URI=mongodb://127.0.0.1:27017/construfash
   JWT_SECRET=tu_secreto_jwt
   CLOUDINARY_CLOUD_NAME=tu_cloud_name
   CLOUDINARY_API_KEY=tu_api_key
   CLOUDINARY_API_SECRET=tu_api_secret
   ```

## Scripts disponibles

- `npm start` — Inicia la aplicación en modo producción
- `npm run dev` — Inicia con `nodemon` para desarrollo
- `npm run seed` — Inserta datos de ejemplo y usuarios demo
- `npm run icons` — Genera iconos de la aplicación

## Ejecutar la aplicación

1. Asegúrate de tener MongoDB activo.
2. Ejecuta el servidor:
   ```bash
   npm run dev
   ```
3. Abre el navegador en:
   ```bash
   http://localhost:3000
   ```

## Seed de ejemplo

Ejecuta:
```bash
npm run seed
```

El script crea una empresa demo (`tenant_id: horizonte-demo`) y no duplica datos si ya existen. Si quieres regenerar los datos, elimina el tenant `horizonte-demo` y sus colecciones relacionadas antes de volver a correr el seed.

---

## Credenciales de acceso

### Super Admin (global, sin tenant)

| Campo | Valor |
|---|---|
| Email | `admin@gmail.com` |
| Password | `123456` |

> Puedes cambiar estos valores con `SEED_SUPERADMIN_EMAIL` y `SEED_SUPERADMIN_PASSWORD` en el `.env`.

### Empresa demo: Constructora Horizonte SAS (`tenant_id: horizonte-demo`)

Password para todos los usuarios de la empresa demo: `Demo123!`

| Rol | Nombre | Email |
|---|---|---|
| Admin de Empresa | Laura Martinez | `admin@horizonte.demo` |
| Jefe de Obra | Carlos Lopez | `jefe.lopez@horizonte.demo` |
| Almacenista | Diana Ruiz | `bodega@horizonte.demo` |
| Constructor | Andres Gomez | `constructor.gomez@horizonte.demo` |
| Constructor | Felipe Diaz | `constructor.diaz@horizonte.demo` |
| Cliente | Marcela Torres | `cliente@horizonte.demo` |

---

## Qué datos crea el seed

- Proyecto: "Edificio Aurora - Torre Residencial"
- 5 fases del proyecto, con estado y fechas
- 5 fotos de cumplimiento (`CompliancePhoto`)
- 2 solicitudes de materiales (`MaterialRequest`)
- 4 movimientos de Kardex
- 1 registro de asistencia del día
- 1 novedad con foto
- 2 notificaciones de ejemplo

Todas las imágenes son placeholders de [Lorem Picsum](https://picsum.photos) y se generan con una semilla fija para mantener consistencia.
