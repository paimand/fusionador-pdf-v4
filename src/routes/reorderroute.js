const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges, getUploadedFile } = require('../utils/pdfUtils');

// Ruta dedicada a "Ordenar páginas". El frontend (reorder.js) manda:
// FormData { file, order: "3,1,2,4" } -> páginas originales 1-based, en el
// nuevo orden elegido al arrastrar las tarjetas (Sortable.js).
// Devuelve siempre un único PDF con las páginas en ese orden.
router.post('/', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const rawPages = req.body.order || '';

    const cleanedBuffer = await cleanPdfBuffer(file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    const targetIndices = parsePageRanges(rawPages, totalPages);

    if (targetIndices.length === 0) {
      return res.status(400).send('No se ha especificado un orden de páginas válido.');
    }

    const newPdf = await PDFDocument.create();
    for (const pageIdx of targetIndices) {
      const [copiedPage] = await newPdf.copyPages(srcDoc, [pageIdx]);
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_reordenado.pdf"');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error en reorderRoute:', error);
    res.status(500).send('Error reordenando las páginas del PDF.');
  }
});

module.exports = router;
