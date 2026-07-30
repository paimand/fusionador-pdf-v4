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

    // Flag para "Unir todos los rangos en un único archivo PDF" (checkbox del frontend).
    // Acepta true/"true"/"on"/"1" por si el checkbox llega como string desde FormData.
    const mergeRanges = ['true', 'on', '1', true].includes(req.body.mergeRanges);

    const cleanedBuffer = await cleanPdfBuffer(file.buffer);
    const srcDoc = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // IMPORTANTE: distinguimos por la ruta real, no solo por "mode".
    // /extract y /reorder son alias de este mismo router (ver server.js) y NO mandan
    // un "mode" propio, así que caen en el valor por defecto 'individual'. Si solo
    // mirásemos "mode" para decidir si generar ZIP, extract/reorder generarían ZIP
    // por error (y el frontend los descargaría como .pdf -> archivo "corrupto").
    const isSplitEndpoint = req.baseUrl === '/split';

    // MODO 1 (solo /split): páginas individuales -> ZIP con un PDF de 1 página cada una.
    if (isSplitEndpoint && (mode === 'individual' || mode === 'split_all')) {
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

    // MODO 2 (solo /split): división por rangos.
    // Por defecto -> ZIP con un PDF por cada rango/grupo separado por comas.
    // Si mergeRanges === true -> un único PDF con todos los rangos, en el orden dado.
    if (isSplitEndpoint && mode === 'ranges') {
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

    // MODO 3: /extract, /reorder, y cualquier caso no cubierto arriba.
    // Siempre un único PDF con las páginas indicadas, en ese orden.
    const targetIndices = parsePageRanges(rawPages, totalPages);

    if (targetIndices.length === 0) {
      return res.status(400).send('No se han especificado páginas válidas para procesar.');
    }

    const newPdf = await PDFDocument.create();

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
