const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, parsePageRanges } = require('../utils/pdfUtils');
const { PDFDocument } = require('pdf-lib');
const JSZip = require('jszip');

/**
 * POST /api/pdf/split
 * Divide un PDF en páginas individuales o por rangos.
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No se ha subido ningún archivo PDF.');
        }

        const { mode, ranges } = req.body;
        console.log('📄 Modo:', mode, 'Rangos:', ranges);

        // Limpiar el PDF (desencriptar, reparar)
        const cleanedBuffer = await cleanPdfBuffer(req.file.buffer);

        // Cargar el PDF para obtener el número total de páginas
        const pdf = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
        const totalPages = pdf.getPageCount();
        console.log(`📄 Total páginas: ${totalPages}`);

        // --- Caso: Dividir en páginas individuales ---
        if (mode === 'individual') {
            const zip = new JSZip();
            const baseName = req.file.originalname.replace(/\.pdf$/i, '') || 'pagina';

            for (let i = 1; i <= totalPages; i++) {
                const pageIndex = i - 1;
                // Crear un nuevo PDF con solo esa página
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
                newPdf.addPage(copiedPage);
                const pageBuffer = await newPdf.save();
                zip.file(`${baseName}_${i}.pdf`, pageBuffer);
            }

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
        console.log('📄 Índices seleccionados:', pageIndices);

        if (pageIndices.length === 0) {
            return res.status(400).send('El rango especificado no es válido o está fuera de límites.');
        }

        // Crear un nuevo PDF con las páginas seleccionadas
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, pageIndices);
        pages.forEach((page) => newPdf.addPage(page));

        const resultBuffer = await newPdf.save();

        // Validar que el PDF generado no esté vacío
        if (resultBuffer.length === 0) {
            throw new Error('El PDF generado está vacío');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="documento_dividido.pdf"');
        res.send(resultBuffer);

    } catch (error) {
        console.error('❌ Error en /split:', error);
        res.status(500).send(`Error interno al dividir el PDF: ${error.message}`);
    }
});

module.exports = router;
