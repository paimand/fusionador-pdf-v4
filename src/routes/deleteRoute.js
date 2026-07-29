const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer } = require('../utils/pdfUtils');

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const pagesToDelete = (req.body.pages || '')
      .split(',')
      .map(p => parseInt(p.trim(), 10) - 1)
      .filter(p => !isNaN(p));

    const cleanedBuffer = await cleanPdfBuffer(req.file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    const pagesToKeep = [];
    for (let i = 0; i < totalPages; i++) {
      if (!pagesToDelete.includes(i)) {
        pagesToKeep.push(i);
      }
    }

    if (pagesToKeep.length === 0) {
      return res.status(400).send('No puedes eliminar todas las páginas del documento.');
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(srcDoc, pagesToKeep);
    copiedPages.forEach(p => newPdf.addPage(p));

    const pdfBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_modificado.pdf"');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error en /delete:', error);
    res.status(500).send('Error al eliminar páginas del PDF.');
  }
});

module.exports = router;