const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');

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
  const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
  const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';

  const useCloudinary = Boolean(
    cloudinaryCloudName &&
    cloudinaryApiKey &&
    cloudinaryApiSecret &&
    !cloudinaryCloudName.startsWith('tu_') &&
    !cloudinaryApiKey.startsWith('tu_') &&
    !cloudinaryApiSecret.startsWith('tu_')
  );

  if (!useCloudinary) {
    return await guardarImagenLocal(buffer, folder, publicId);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${base}/${folder}`,
        public_id: publicId,
        overwrite: true,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      async (error, result) => {
        if (error) {
          const fallbackError = error.message || '';
          const shouldFallback = fallbackError.includes('ENOTFOUND') ||
            fallbackError.includes('Unknown API key') ||
            fallbackError.includes('Invalid credentials') ||
            fallbackError.includes('Invalid signature') ||
            fallbackError.includes('Missing required parameter');
          if (shouldFallback) {
            try {
              const localResult = await guardarImagenLocal(buffer, folder, publicId);
              return resolve(localResult);
            } catch (localErr) {
              return reject(localErr);
            }
          }
          return reject(error);
        }
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

async function guardarImagenLocal(buffer, folder, publicId) {
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads', folder);
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${publicId}.jpg`;
  const filepath = path.join(uploadDir, filename);
  await fs.writeFile(filepath, buffer);
  return {
    url: `/uploads/${folder}/${filename}`,
    public_id: `local/${folder}/${publicId}`,
  };
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
