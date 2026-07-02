const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Sube un buffer de imagen ya comprimido con Sharp a Cloudinary.
 * @param {Buffer} buffer  - imagen en memoria (JPEG comprimido)
 * @param {string} folder  - subcarpeta dentro de CLOUDINARY_FOLDER
 * @param {string} publicId - nombre publico del recurso (sin extension)
 * @returns {Promise<{url: string, public_id: string}>}
 */
async function subirImagen(buffer, folder, publicId) {
  const base = process.env.CLOUDINARY_FOLDER || 'construfash';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${base}/${folder}`,
        public_id: publicId,
        overwrite: true,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Elimina un recurso de Cloudinary por su public_id.
 */
async function eliminarImagen(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    console.warn('[Cloudinary] No se pudo eliminar', publicId, e.message);
  }
}

module.exports = { cloudinary, subirImagen, eliminarImagen };
