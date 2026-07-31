const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer } = require('../utils/pdfUtils');

// Multer (uploadConfig.js) ya limita cada archivo individual a 50MB y el
// número de archivos por petición a 30. Aquí añadimos un límite de tamaño
// TOTAL combinado, porque multer no lo hace por defecto (podrías subir,
// p. ej., 30 archivos de 45MB cada uno y sumar más de 1GB en una sola
// petición sin que ningún límite anterior lo impida).
const MAX_TOTAL_SIZE_BYTES = 150 * 1024 * 1024; // 150MB combinados

router.post('/', upload.array('pdfs'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send('No se han subido archivos PDF.');
    }

    const totalSize = req.files.reduce((sum, f) => sum + f.buffer.length, 0);
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      return res.status(413).send(
        `El tamaño combinado de los archivos (${(totalSize / (1024 * 1024)).toFixed(1)}MB) supera el máximo permitido (150MB). Prueba a unirlos en varios lotes más pequeños.`
      );
    }

    const mergedPdf = await PDFDocument.create();
    let omittedFiles = [];

    for (const file of req.files) {
      try {
        const cleanedBuffer = await cleanPdfBuffer(file.buffer);
        const pdf = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error(`Error procesando ${file.originalname}:`, err.message);
        omittedFiles.push(file.originalname);
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      return res.status(400).send('No se pudo procesar ningún archivo PDF válido.');
    }

    const pdfBytes = await mergedPdf.save();

    if (omittedFiles.length > 0) {
      res.setHeader('X-Omitted', `Omitidos por protección/error: ${omittedFiles.join(', ')}`);
      res.setHeader('Access-Control-Expose-Headers', 'X-Omitted');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_fusionado.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error en /merge:', error);
    res.status(500).send('Error interno procesando la unión de PDFs.');
  }
});

module.exports = router;
