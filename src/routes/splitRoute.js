const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const JSZip = require('jszip');
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges, getUploadedFile } = require('../utils/pdfUtils');

// Esta ruta SOLO gestiona la herramienta "Dividir PDF" (páginas individuales y por rangos).
// Extraer y Ordenar tienen ahora sus propias rutas (extractRoute.js, reorderRoute.js).
router.post('/', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).send('No se ha recibido ningún archivo PDF.');
    }

    const mode = req.body.mode || req.body.splitMode || 'individual';
    const rawPages = req.body.ranges || req.body.pages || '';

    // Flag para "Unir todos los rangos en un único archivo PDF" (checkbox del frontend).
    const mergeRanges = ['true', 'on', '1', true].includes(req.body.mergeRanges);

    const cleanedBuffer = await cleanPdfBuffer(file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // MODO 1: Páginas individuales -> ZIP con un PDF de 1 página por cada página seleccionada.
    if (mode === 'individual' || mode === 'split_all') {
      const targetIndices = rawPages
        ? parsePageRanges(rawPages, totalPages)
        : Array.from({ length: totalPages }, (_, i) => i);

      if (targetIndices.length === 0) {
        return res.status(400).send('No se han especificado páginas válidas para procesar.');
      }

      const zip = new JSZip();
      for (const idx of targetIndices) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(srcDoc, [idx]);
        newPdf.addPage(copiedPage);
        const pdfBytes = await newPdf.save();
        zip.file(`pagina_${idx + 1}.pdf`, pdfBytes);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="paginas_divididas.zip"');
      return res.send(zipBuffer);
    }

    // MODO 2: División por rangos.
    // Por defecto -> ZIP con un PDF por cada rango/grupo separado por comas.
    // Si mergeRanges === true -> un único PDF con todos los rangos, en el orden dado.
    if (mode === 'range' || mode === 'ranges') {
      if (!rawPages) {
        return res.status(400).send('No se han especificado rangos válidos.');
      }

      const groups = String(rawPages).split(',').map(g => g.trim()).filter(Boolean);

      if (mergeRanges) {
        const newPdf = await PDFDocument.create();
        let pagesAdded = 0;

        for (const group of groups) {
          const indices = parsePageRanges(group, totalPages);
          for (const idx of indices) {
            const [copiedPage] = await newPdf.copyPages(srcDoc, [idx]);
            newPdf.addPage(copiedPage);
            pagesAdded++;
          }
        }

        if (pagesAdded === 0) {
          return res.status(400).send('No se han especificado rangos válidos.');
        }

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="rangos_unidos.pdf"');
        return res.send(Buffer.from(pdfBytes));
      }

      const zip = new JSZip();
      let fileCounter = 0;

      for (const group of groups) {
        const indices = parsePageRanges(group, totalPages);
        if (indices.length === 0) continue;

        const newPdf = await PDFDocument.create();
        for (const idx of indices) {
          const [copiedPage] = await newPdf.copyPages(srcDoc, [idx]);
          newPdf.addPage(copiedPage);
        }
        const pdfBytes = await newPdf.save();
        fileCounter++;
        const label = group.replace(/-/g, '_a_');
        zip.file(`rango_${fileCounter}_paginas_${label}.pdf`, pdfBytes);
      }

      if (fileCounter === 0) {
        return res.status(400).send('No se han especificado rangos válidos.');
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="rangos_divididos.zip"');
      return res.send(zipBuffer);
    }

    return res.status(400).send(`Modo de división no reconocido: "${mode}".`);

  } catch (error) {
    console.error('Error en splitRoute:', error);
    res.status(500).send('Error procesando el archivo PDF.');
  }
});

module.exports = router;
