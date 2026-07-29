const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const JSZip = require('jszip');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges } = require('../utils/pdfUtils');

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const mode = req.body.mode || 'individual';
    const ranges = req.body.ranges || req.body.pages || '';

    const cleanedBuffer = await cleanPdfBuffer(req.file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // MODO 1: Dividir en páginas individuales (Devuelve un archivo ZIP)
    if (mode === 'individual' && !ranges) {
      const zip = new JSZip();

      for (let i = 0; i < totalPages; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(srcDoc, [i]);
        newPdf.addPage(copiedPage);
        const pdfBytes = await newPdf.save();
        zip.file(`pagina_${i + 1}.pdf`, pdfBytes);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="paginas_divididas.zip"');
      return res.send(zipBuffer);
    }

    // MODO 2: Extraer/Reordenar por rangos o selección explícita
    let targetIndices = [];
    if (ranges) {
      targetIndices = parsePageRanges(ranges, totalPages);
    } else {
      targetIndices = Array.from({ length: totalPages }, (_, i) => i);
    }

    if (targetIndices.length === 0) {
      return res.status(400).send('No se han seleccionado páginas válidas.');
    }

    const newPdf = await PDFDocument.create();
    for (const idx of targetIndices) {
      const [copiedPage] = await newPdf.copyPages(srcDoc, [idx]);
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_procesado.pdf"');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error en /split:', error);
    res.status(500).send('Error procesando la división o selección del PDF.');
  }
});

module.exports = router;