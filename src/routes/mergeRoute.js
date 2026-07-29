const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer } = require('../utils/pdfUtils');

router.post('/', upload.array('pdfs'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send('No se han subido archivos PDF.');
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