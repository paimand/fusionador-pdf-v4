const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Procesa un Buffer PDF mediante qpdf para desencriptarlo/repararlo si es necesario.
 * @param {Buffer} inputBuffer - Buffer del PDF original
 * @returns {Promise<Buffer>} - Buffer del PDF limpio
 */
async function cleanPdfBuffer(inputBuffer) {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const uniqueId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const inPath = path.join(tempDir, `in_${uniqueId}.pdf`);
    const outPath = path.join(tempDir, `out_${uniqueId}.pdf`);

    fs.writeFileSync(inPath, inputBuffer);

    exec(`qpdf --decrypt "${inPath}" "${outPath}"`, (error) => {
      let finalBuffer = inputBuffer;
      if (!error && fs.existsSync(outPath)) {
        try {
          finalBuffer = fs.readFileSync(outPath);
          fs.unlinkSync(outPath);
        } catch (e) {}
      }
      try { fs.unlinkSync(inPath); } catch (e) {}
      resolve(finalBuffer);
    });
  });
}

/**
 * Convierte cualquier formato de lista/rango de páginas (base 1) a un array numérico de índices (base 0)
 * Ejemplos aceptados: "1-3, 5", "1,2,3", [1,2,3], "3,1,2"
 * @param {string|number[]} input - Entrada en formato texto o array
 * @param {number} totalPages - Número total de páginas del documento
 * @returns {number[]} - Array de índices (base 0)
 */
function parsePageRanges(input, totalPages) {
  if (!input) return [];
  
  let strInput = '';
  if (Array.isArray(input)) {
    strInput = input.join(',');
  } else if (typeof input === 'object') {
    strInput = JSON.stringify(input);
  } else {
    strInput = String(input);
  }

  // Limpiar caracteres extraños excepto números, guiones y comas
  const cleanedStr = strInput.replace(/[^\d,-]/g, '');
  if (!cleanedStr) return [];

  const parts = cleanedStr.split(',');
  const result = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const step = start <= end ? 1 : -1;
        for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
          if (i >= 1 && i <= totalPages) {
            result.push(i - 1);
          }
        }
      }
    } else {
      const page = parseInt(trimmed, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        result.push(page - 1);
      }
    }
  }

  return result;
}

/**
 * Extrae de forma segura el archivo recibido en la petición Multer
 * @param {Object} req - Objeto de solicitud de Express
 * @returns {Object|null} - Archivo subido (file) o null si no hay
 */
function getUploadedFile(req) {
  if (req.file) return req.file;
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    return req.files[0];
  }
  return null;
}

/**
 * Crea un nuevo PDF a partir de un buffer y una lista de índices de páginas (base 0)
 * @param {Buffer} pdfBuffer - Buffer del PDF original (preferiblemente ya limpio)
 * @param {number[]} indices - Array de índices de páginas (base 0) a incluir
 * @returns {Promise<Buffer>} - Buffer del nuevo PDF
 */
async function createPdfFromIndices(pdfBuffer, indices) {
  const { PDFDocument } = require('pdf-lib');
  const pdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();
  const pages = await newPdf.copyPages(pdf, indices);
  pages.forEach((page) => newPdf.addPage(page));
  return await newPdf.save();
}

module.exports = {
  cleanPdfBuffer,
  parsePageRanges,
  getUploadedFile,
  createPdfFromIndices // <-- Nueva función exportada
};
