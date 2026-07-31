const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para ficheros estáticos
app.use(express.static(path.join(__dirname, 'public')));
// Todas las herramientas (incluida /compress ahora) reciben el PDF como
// multipart/form-data vía multer, no como JSON, así que no necesitamos
// un límite grande aquí. Dejamos un margen razonable por si algún body
// JSON pequeño lo necesita en el futuro.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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

// Manejador de errores de Multer (subida de archivos): sin esto, superar
// los límites de tamaño/número de archivos configurados en uploadConfig.js
// devuelve la página de error HTML por defecto de Express, en vez de un
// mensaje claro que el frontend pueda mostrar (mismo tipo de problema que
// el PayloadTooLargeError original de /compress).
const multer = require('multer');
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).send('Uno de los archivos supera el tamaño máximo permitido (50MB).');
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).send('Se ha superado el número máximo de archivos permitido (30).');
    }
    return res.status(400).send('Error al procesar los archivos subidos: ' + err.message);
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`🚀 SuitePDF v4 ejecutándose en el puerto ${PORT}`);
});
