const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const JSZip = require('jszip');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges, getUploadedFile } = require('../utils/pdfUtils');

router.post('/', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const mode = req.body.mode || req.body.splitMode || 'individual';
    const rawPages = req.body.ranges || req.body.pages || req.body.order || req.body.pageOrder || '';

    const cleanedBuffer = await cleanPdfBuffer(file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // MODO 1: Dividir en páginas individuales (Devuelve archivo ZIP)
    if ((mode === 'individual' || mode === 'split_all') && !rawPages) {
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

    // MODO 2: Extraer / Reordenar páginas según los índices seleccionados
    const targetIndices = parsePageRanges(rawPages, totalPages);

    if (targetIndices.length === 0) {
      return res.status(400).send('No se han especificado páginas válidas para procesar.');
    }

    const newPdf = await PDFDocument.create();
    
    // Copiamos página por página manteniendo exactamente el orden dado por targetIndices
    for (const pageIdx of targetIndices) {
      const [copiedPage] = await newPdf.copyPages(srcDoc, [pageIdx]);
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_procesado.pdf"');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error en splitRoute:', error);
    res.status(500).send('Error procesando el archivo PDF.');
  }
});

module.exports = router;
