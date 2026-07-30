const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges, createPdfFromIndices } = require('../utils/pdfUtils');
const JSZip = require('jszip');

/**
 * POST /api/pdf/split
 * Divide un PDF en páginas individuales o por rangos.
 * Body (multipart/form-data):
 *   - file: archivo PDF
 *   - mode: 'individual' o 'ranges'
 *   - ranges: (solo si mode=ranges) string con rangos, ej. "1-3,5"
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No se ha subido ningún archivo PDF.');
        }

        const { mode, ranges } = req.body;

        // Limpiar el PDF (desencriptar, reparar)
        const cleanedBuffer = await cleanPdfBuffer(req.file.buffer);

        // Cargar el PDF para obtener el número total de páginas
        const { PDFDocument } = require('pdf-lib');
        const pdf = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
        const totalPages = pdf.getPageCount();

        // --- Caso: Dividir en páginas individuales ---
        if (mode === 'individual') {
            const zip = new JSZip();
            const baseName = req.file.originalname.replace(/\.pdf$/i, '') || 'pagina';

            // Generar un PDF por cada página
            for (let i = 1; i <= totalPages; i++) {
                // Índice base 0 para la página actual
                const pageIndex = i - 1;
                const pageBuffer = await createPdfFromIndices(cleanedBuffer, [pageIndex]);
                // Añadir al ZIP con nombre "pagina_1.pdf", "pagina_2.pdf", ...
                zip.file(`${baseName}_${i}.pdf`, pageBuffer);
            }

            // Generar el archivo ZIP
            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}_paginas.zip"`);
            return res.send(zipBuffer);
        }

        // --- Caso: Dividir por rangos ---
        if (!ranges || ranges.trim() === '') {
            return res.status(400).send('Debes especificar un rango de páginas (ej. "1-3,5").');
        }

        const pageIndices = parsePageRanges(ranges, totalPages);
        if (pageIndices.length === 0) {
            return res.status(400).send('El rango especificado no es válido o está fuera de límites.');
        }

        const resultBuffer = await createPdfFromIndices(cleanedBuffer, pageIndices);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="documento_dividido.pdf"');
        res.send(resultBuffer);

    } catch (error) {
        console.error('Error en /split:', error);
        res.status(500).send('Error interno al dividir el PDF.');
    }
});

module.exports = router;
