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

    // MODO 1: Páginas individuales -> ZIP con un PDF de 1 página por cada página seleccionada.
    // Antes exigía "!rawPages" para entrar aquí, pero el frontend SIEMPRE manda las páginas
    // seleccionadas en "ranges", así que esta rama nunca se ejecutaba.
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

    // MODO 2: División por rangos -> ZIP con un PDF por cada rango/grupo separado por comas.
    // Ej: "1-3, 5-7" genera dos PDFs (páginas 1-3 y páginas 5-7), no uno solo fusionado.
    if (mode === 'ranges') {
      if (!rawPages) {
        return res.status(400).send('No se han especificado rangos válidos.');
      }

      const groups = String(rawPages).split(',').map(g => g.trim()).filter(Boolean);
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

    // MODO 3 (alias /extract y /reorder): un único PDF con las páginas indicadas, en ese orden.
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
