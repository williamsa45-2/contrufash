const multer = require('multer');
const sharp = require('sharp');

/** Multer en memoria: no escribe nada a disco, pasa el buffer a Sharp. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB max en raw
  fileFilter(_req, file, cb) {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan imagenes (JPEG, PNG, WebP, HEIC).'));
    }
  },
});

/**
 * Comprime el buffer de req.file con Sharp antes de que el controlador
 * lo envie a Cloudinary. Convierte todo a JPEG 80% quality, max 1920px.
 * Se usa como middleware encadenado: upload.single('foto'), comprimirImagen, controlador
 */
async function comprimirImagen(req, res, next) {
  if (!req.file) return next();
  try {
    req.file.buffer = await sharp(req.file.buffer)
      .rotate()                        // respeta EXIF orientation
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    req.file.mimetype = 'image/jpeg';
    next();
  } catch (err) {
    next(new Error('No se pudo procesar la imagen: ' + err.message));
  }
}

module.exports = { upload, comprimirImagen };
