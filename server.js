const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para ficheros estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Carga de Rutas Modularizadas
const mergeRoute = require('./src/routes/mergeRoute');
const splitRoute = require('./src/routes/splitRoute');
const deleteRoute = require('./src/routes/deleteRoute');

app.use('/merge', mergeRoute);
app.use('/split', splitRoute);
app.use('/delete', deleteRoute);

// Captura de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`🚀 SuitePDF v4 ejecutándose en el puerto ${PORT}`);
});