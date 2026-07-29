const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, getUploadedFile } = require('../utils/pdfUtils');

router.post('/', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    // Optimiza y reconstruye las estructuras internas con qpdf
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
