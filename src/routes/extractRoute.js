const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges, createPdfFromIndices } = require('../utils/pdfUtils');

/**
 * POST /api/pdf/extract
 * Extrae un conjunto de páginas de un PDF y crea un nuevo PDF.
 * Body (multipart/form-data):
 *   - file: archivo PDF
 *   - pages: string con rangos, ej. "1-3,5"
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No se ha subido ningún archivo PDF.');
        }

        const { pages } = req.body;
        if (!pages || pages.trim() === '') {
            return res.status(400).send('Debes especificar las páginas a extraer (ej. "1-3,5").');
        }

        const cleanedBuffer = await cleanPdfBuffer(req.file.buffer);

        // Cargar para conocer el total de páginas
        const { PDFDocument } = require('pdf-lib');
        const pdf = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
        const totalPages = pdf.getPageCount();

        const pageIndices = parsePageRanges(pages, totalPages);
        if (pageIndices.length === 0) {
            return res.status(400).send('Las páginas especificadas no son válidas o están fuera de límites.');
        }

        const resultBuffer = await createPdfFromIndices(cleanedBuffer, pageIndices);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="documento_extraido.pdf"');
        res.send(resultBuffer);

    } catch (error) {
        console.error('Error en /extract:', error);
        res.status(500).send('Error interno al extraer páginas.');
    }
});

module.exports = router;
