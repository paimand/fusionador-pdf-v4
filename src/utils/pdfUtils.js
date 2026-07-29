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

    // Ejecuta qpdf para desencriptar y reparar la estructura del PDF
    exec(`qpdf --decrypt "${inPath}" "${outPath}"`, (error) => {
      let finalBuffer = inputBuffer;
      if (!error && fs.existsSync(outPath)) {
        finalBuffer = fs.readFileSync(outPath);
        try { fs.unlinkSync(outPath); } catch (e) {}
      }
      try { fs.unlinkSync(inPath); } catch (e) {}
      resolve(finalBuffer);
    });
  });
}

/**
 * Convierte rangos o cadenas de páginas en un array numérico manteniendo el orden original.
 */
function parsePageRanges(rangesStr, totalPages) {
  if (!rangesStr) return [];
  const parts = rangesStr.split(',');
  const result = [];

  for (const part of parts) {
    const trimmed = part.trim();
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

module.exports = {
  cleanPdfBuffer,
  parsePageRanges
};