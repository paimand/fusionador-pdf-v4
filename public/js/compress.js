// ============================================================
// COMPRESS LOGIC - Sube el PDF original al servidor y lo comprime
// con Ghostscript (ya NO rasteriza páginas a imágenes en el navegador)
// ============================================================
let compressFile = null;
const dropZoneCompress = document.getElementById('dropZoneCompress');
const fileInputCompress = document.getElementById('fileInputCompress');
const compressBtn = document.getElementById('compressBtn');

// Función auxiliar para formatear bytes a KB o MB con 2 decimales
function formatFileSize(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    if (bytes < k * k) {
        return (bytes / k).toFixed(2) + ' KB';
    }
    return (bytes / (k * k)).toFixed(2) + ' MB';
}

if (dropZoneCompress && fileInputCompress && compressBtn) {

    // Prevenir comportamientos por defecto en drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZoneCompress.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZoneCompress.addEventListener(eventName, () => {
            dropZoneCompress.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZoneCompress.addEventListener(eventName, () => {
            dropZoneCompress.classList.remove('dragover');
        }, false);
    });

    // Manejar inserción de archivos por arrastre
    dropZoneCompress.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                compressFile = file;
                const pText = dropZoneCompress.querySelector('p');
                if (pText) pText.textContent = `📄 ${compressFile.name}`;

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(compressFile);
                fileInputCompress.files = dataTransfer.files;
            } else {
                alert('Por favor, selecciona un archivo PDF válido.');
            }
        }
    });

    // Clic convencional para selección
    dropZoneCompress.addEventListener('click', () => fileInputCompress.click());

    fileInputCompress.addEventListener('change', e => {
        if (e.target.files.length > 0) {
            compressFile = e.target.files[0];
            const pText = dropZoneCompress.querySelector('p');
            if (pText) pText.textContent = `📄 ${compressFile.name}`;
        }
    });

    // Procesamiento de compresión: sube el archivo tal cual al backend
    compressBtn.addEventListener('click', async () => {
        if (!compressFile) {
            alert('Selecciona un PDF para comprimir');
            return;
        }

        compressBtn.disabled = true;
        if (typeof showLoading === 'function') showLoading(true);
        if (typeof showStatus === 'function') showStatus('compressStatus', '⏳ Comprimiendo documento...');

        try {
            const selectedRadio = document.querySelector('input[name="compressLevel"]:checked');
            const level = selectedRadio ? selectedRadio.value : 'recommended';

            const formData = new FormData();
            formData.append('file', compressFile);
            formData.append('level', level);

            const resp = await fetch('/compress', {
                method: 'POST',
                body: formData
            });

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(errText || 'Error al comprimir el archivo.');
            }

            const blob = await resp.blob();

            // Cálculo de tamaños y porcentaje real
            const originalSizeBytes = compressFile.size;
            const compressedSizeBytes = blob.size;

            const originalFormatted = formatFileSize(originalSizeBytes);
            const compressedFormatted = formatFileSize(compressedSizeBytes);

            let percentReduced = 0;
            if (originalSizeBytes > 0) {
                percentReduced = Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100);
            }

            // Descargar el archivo procesado
            if (typeof downloadFile === 'function') {
                downloadFile(blob, `comprimido_${level}_${compressFile.name}`);
            } else {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `comprimido_${level}_${compressFile.name}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }

            // Mensaje enriquecido con los datos reales. Si el resultado pesa igual o más
            // que el original (puede pasar en PDFs ya muy optimizados), lo indicamos
            // en vez de mostrar un "0%" o un porcentaje negativo engañoso.
            let successMessage;
            if (percentReduced > 0) {
                successMessage = `✅ PDF comprimido correctamente. ¡Tus PDF ahora pesan un ${percentReduced}% menos! de ${originalFormatted} a ${compressedFormatted}`;
            } else {
                successMessage = `✅ PDF procesado. El archivo original ya estaba muy optimizado (${originalFormatted}); el resultado pesa ${compressedFormatted}.`;
            }

            if (typeof showStatus === 'function') {
                showStatus('compressStatus', successMessage);
            }
        } catch (err) {
            if (typeof showStatus === 'function') {
                showStatus('compressStatus', '❌ ' + err.message, true);
            }
        } finally {
            compressBtn.disabled = false;
            if (typeof showLoading === 'function') showLoading(false);
        }
    });
}
