const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges, getUploadedFile } = require('../utils/pdfUtils');

// Ruta dedicada a "Extraer páginas". El frontend (script inline en extract.html)
// manda: FormData { file, pages: "2,4,7" } -> páginas 1-based, ya ordenadas.
// Devuelve siempre un único PDF con esas páginas, en ese orden.
router.post('/', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const rawPages = req.body.pages || '';

    const cleanedBuffer = await cleanPdfBuffer(file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    const targetIndices = parsePageRanges(rawPages, totalPages);

    if (targetIndices.length === 0) {
      return res.status(400).send('No se han especificado páginas válidas para extraer.');
    }

    const newPdf = await PDFDocument.create();
    for (const pageIdx of targetIndices) {
      const [copiedPage] = await newPdf.copyPages(srcDoc, [pageIdx]);
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="paginas_extraidas.pdf"');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error en extractRoute:', error);
    res.status(500).send('Error extrayendo las páginas del PDF.');
  }
});

module.exports = router;
