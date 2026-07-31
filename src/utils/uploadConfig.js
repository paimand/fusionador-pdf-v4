const multer = require('multer');

// Almacenamiento directo en memoria RAM
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Límite de 50MB por archivo
    files: 30 // Límite de nº de archivos por petición (relevante sobre todo para /merge)
  }
});

module.exports = upload;
