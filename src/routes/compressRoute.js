const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const { cleanPdfBuffer } = require('../utils/pdfUtils');

// Nota: esta ruta NO usa multer/upload.any(). El frontend (compress.js) no manda el
// PDF original: rasteriza cada página a JPEG en el navegador y envía esas imágenes
// como JSON ({ images, level }). El bug anterior era que este endpoint esperaba un
// archivo multipart (req.file) que nunca llegaba, y además el body-parser rechazaba
// el JSON porque superaba el límite por defecto de 100kb (ver server.js).
router.post('/', async (req, res) => {
  try {
    const { images, level } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).send('No se han recibido páginas para comprimir.');
    }

    const newPdf = await PDFDocument.create();

    for (const dataUrl of images) {
      const base64 = String(dataUrl).split(',')[1];
      if (!base64) continue;

      const imgBytes = Buffer.from(base64, 'base64');
      const jpgImage = await newPdf.embedJpg(imgBytes);
      const page = newPdf.addPage([jpgImage.width, jpgImage.height]);

      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: jpgImage.width,
        height: jpgImage.height,
      });
    }

    if (newPdf.getPageCount() === 0) {
      return res.status(400).send('No se pudo reconstruir el PDF a partir de las imágenes recibidas.');
    }

    let pdfBytes = await newPdf.save();

    // Optimización adicional de la estructura interna con qpdf
    pdfBytes = await cleanPdfBuffer(Buffer.from(pdfBytes));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_comprimido.pdf"');
    return res.send(pdfBytes);

  } catch (error) {
    console.error('Error en compressRoute:', error);
    res.status(500).send('Error durante la compresión del PDF.');
  }
});

module.exports = router;
