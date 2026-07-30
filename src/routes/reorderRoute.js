const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadConfig');
const { cleanPdfBuffer, createPdfFromIndices } = require('../utils/pdfUtils');

/**
 * POST /api/pdf/reorder
 * Reordena las páginas de un PDF según un nuevo orden.
 * Body (multipart/form-data):
 *   - file: archivo PDF
 *   - order: JSON string con el nuevo orden (ej. "[3,1,2]")
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No se ha subido ningún archivo PDF.');
        }

        const { order } = req.body;
        if (!order) {
            return res.status(400).send('Debes especificar el nuevo orden de páginas (ej. "[3,1,2]").');
        }

        let newOrder;
        try {
            newOrder = JSON.parse(order);
        } catch (_) {
            return res.status(400).send('El formato del orden no es válido (debe ser un array JSON).');
        }

        if (!Array.isArray(newOrder) || newOrder.length === 0) {
            return res.status(400).send('El orden debe ser un array no vacío.');
        }

        const cleanedBuffer = await cleanPdfBuffer(req.file.buffer);

        // Cargar para validar que todos los números estén dentro del rango
        const { PDFDocument } = require('pdf-lib');
        const pdf = await PDFDocument.load(cleanedBuffer, { ignoreEncryption: true });
        const totalPages = pdf.getPageCount();

        const indices = newOrder.map(n => n - 1); // Convertir a base 0
        if (indices.some(i => i < 0 || i >= totalPages)) {
            return res.status(400).send('Algunos números de página están fuera del rango del documento.');
        }

        // Verificar duplicados
        const unique = new Set(indices);
        if (unique.size !== indices.length) {
            return res.status(400).send('No se permiten números de página duplicados.');
        }

        const resultBuffer = await createPdfFromIndices(cleanedBuffer, indices);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="documento_reordenado.pdf"');
        res.send(resultBuffer);

    } catch (error) {
        console.error('Error en /reorder:', error);
        res.status(500).send('Error interno al reordenar páginas.');
    }
});

module.exports = router;
