const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para ficheros estáticos
app.use(express.static(path.join(__dirname, 'public')));
// Límite subido a 50mb: /compress recibe páginas rasterizadas en base64
// dentro del JSON, que pueden pesar bastante más que el límite por defecto (100kb).
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Carga de Rutas Modularizadas
const mergeRoute = require('./src/routes/mergeRoute');
const splitRoute = require('./src/routes/splitRoute');
const extractRoute = require('./src/routes/extractRoute');
const reorderRoute = require('./src/routes/reorderRoute');
const deleteRoute = require('./src/routes/deleteRoute');
const compressRoute = require('./src/routes/compressRoute');

// Registro de endpoints. Cada herramienta tiene ahora su propia ruta e
// implementación independiente (antes /extract y /reorder eran alias de
// /split, lo que provocaba que cambios en una herramienta rompieran a
// las otras sin avisar).
app.use('/merge', mergeRoute);
app.use('/split', splitRoute);
app.use('/extract', extractRoute);
app.use('/reorder', reorderRoute);
app.use('/delete', deleteRoute);
app.use('/compress', compressRoute);

// Captura de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`🚀 SuitePDF v4 ejecutándose en el puerto ${PORT}`);
});
