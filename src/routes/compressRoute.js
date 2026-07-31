const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadConfig');
const { compressPdfBuffer, getUploadedFile } = require('../utils/pdfUtils');

// Ruta dedicada a "Comprimir PDF". Recibe el archivo original tal cual
// (multipart, igual que split/merge/delete) junto con el nivel elegido,
// y lo comprime en el servidor con Ghostscript. Ya NO rasteriza páginas
// a imágenes en el navegador: ese enfoque anterior podía aumentar el
// tamaño en PDFs de texto/vectoriales en vez de reducirlo.
router.post('/', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const level = req.body.level || 'recommended';
    const compressedBuffer = await compressPdfBuffer(file.buffer, level);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_comprimido.pdf"');
    return res.send(compressedBuffer);

  } catch (error) {
    console.error('Error en compressRoute:', error);
    res.status(500).send(error.message || 'Error durante la compresión del PDF.');
  }
});

module.exports = router;
