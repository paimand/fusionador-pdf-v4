const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

// Archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Límite de payload para /compress (que recibe imágenes en base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// RUTAS MODULARIZADAS (INDEPENDIENTES)
// ============================================================

const mergeRoute = require('./src/routes/mergeRoute');
const splitRoute = require('./src/routes/splitRoute');
const extractRoute = require('./src/routes/extractRoute');
const reorderRoute = require('./src/routes/reorderRoute');
const deleteRoute = require('./src/routes/deleteRoute');
const compressRoute = require('./src/routes/compressRoute');

// Registro de endpoints (cada uno con su propia lógica)
app.use('/merge', mergeRoute);
app.use('/split', splitRoute);
app.use('/extract', extractRoute);
app.use('/reorder', reorderRoute);
app.use('/delete', deleteRoute);
app.use('/compress', compressRoute);

// ============================================================
// RUTA DE INICIO (opcional, redirige al frontend)
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// MANEJO DE RUTAS NO ENCONTRADAS (404)
// ============================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ============================================================
// INICIO DEL SERVIDOR
// ============================================================

app.listen(PORT, () => {
  console.log(`🚀 SuitePDF v4 ejecutándose en el puerto ${PORT}`);
});
