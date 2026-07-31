const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges, getUploadedFile } = require('../utils/pdfUtils');

// Ruta dedicada a "Eliminar páginas". El frontend (delete.js) manda:
// FormData { file, pagesToDelete: "2,5,7" } -> páginas 1-based a eliminar.
router.post('/', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const rawPagesToDelete = req.body.pagesToDelete || '';

    const cleanedBuffer = await cleanPdfBuffer(file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // Obtener los índices de base-0 que se van a ELIMINAR
    const indicesToDelete = parsePageRanges(rawPagesToDelete, totalPages);

    if (indicesToDelete.length === 0) {
      return res.status(400).send('No se han seleccionado páginas para eliminar.');
    }

    // Calcular las páginas a CONSERVAR
    const deleteSet = new Set(indicesToDelete);
    const indicesToKeep = [];
    for (let i = 0; i < totalPages; i++) {
      if (!deleteSet.has(i)) {
        indicesToKeep.push(i);
      }
    }

    if (indicesToKeep.length === 0) {
      return res.status(400).send('No puedes eliminar todas las páginas del documento.');
    }

    const newPdf = await PDFDocument.create();
    for (const pageIdx of indicesToKeep) {
      const [copiedPage] = await newPdf.copyPages(srcDoc, [pageIdx]);
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_modificado.pdf"');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error en deleteRoute:', error);
    res.status(500).send('Error al eliminar páginas del PDF.');
  }
});

module.exports = router;
