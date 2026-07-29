const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer } = require('../utils/pdfUtils');

router.post('/', upload.any(), async (req, res) => {
  try {
    const file = req.files && req.files.length > 0 ? req.files[0] : null;
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    // Pasa por qpdf para limpiar streams, descargas no optimizadas y compresión de estructuras
    const compressedBuffer = await cleanPdfBuffer(file.buffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_comprimido.pdf"');
    return res.send(compressedBuffer);

  } catch (error) {
    console.error('Error en compressRoute:', error);
    res.status(500).send('Error durante la compresión del PDF.');
  }
});

module.exports = router;
