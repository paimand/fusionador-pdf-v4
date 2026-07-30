const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Procesa un Buffer PDF mediante qpdf para desencriptarlo/repararlo si es necesario.
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
 */
function getUploadedFile(req) {
  if (req.file) return req.file;
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    return req.files[0];
  }
  return null;
}

module.exports = {
  cleanPdfBuffer,
  parsePageRanges,
  getUploadedFile
};
