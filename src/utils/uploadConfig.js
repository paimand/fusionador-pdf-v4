const multer = require('multer');

// Almacenamiento directo en memoria RAM
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // Límite de 50MB por archivo
  }
});

module.exports = upload;