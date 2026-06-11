// ════════════════════════════════════════════════════════
//  server.js  —  Punto de entrada del servidor
//  Ejecutar con: npm run dev  (desarrollo)
//             o: npm start     (producción)
// ════════════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');

const app        = express();
const httpServer = http.createServer(app);

// ── Middlewares globales ──────────────────────────────────
app.use(cors());          // Permite llamadas desde el frontend
app.use(express.json());  // Parsea JSON en el body de los requests

// 1. Apuntamos los archivos estáticos a la carpeta frontend
app.use(express.static(path.join(__dirname, '../frontend'))); 

// ── Socket.IO con soporte CORS ────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:  '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Guarda `io` en la app para que las rutas puedan emitir eventos
app.set('io', io);

// Logs de verificación de rutas
console.log('auth:',     typeof require('./routes/auth'));
console.log('usuarios:', typeof require('./routes/usuarios'));
console.log('mesas:',    typeof require('./routes/mesas'));
console.log('menu:',     typeof require('./routes/menu'));
console.log('comandas:', typeof require('./routes/comandas'));

// ── Salas de Socket.IO y Tiempo Real ──────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Un usuario se ha conectado al sistema:', socket.id);

  // El frontend llama socket.emit('join', 'cocina') o 'mozo-5' etc.
  socket.on('join', (room) => {
    socket.join(room);
    console.log(`👤 Usuario asignado a la sala: ${room}`);
  });

  // 🔥 EL CAMBIO EN TIEMPO REAL: Escuchar cuando un mozo envía una nueva comanda
  socket.on('nueva-comanda', (datosComanda) => {
    console.log('🛎️ Nueva comanda recibida en el servidor:', datosComanda);
    
    // Reenviar de inmediato a la sala de la cocina
    io.to('cocina').emit('comanda-para-cocina', datosComanda);
    
    // También la mandamos de forma general por si las moscas
    io.emit('actualizacion-general', datosComanda);
  });

  socket.on('disconnect', () => {
    console.log('❌ Usuario desconectado:', socket.id);
  });
});

// ── Rutas de la API ───────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/mesas',    require('./routes/mesas'));
app.use('/api/menu',     require('./routes/menu'));
app.use('/api/comandas', require('./routes/comandas'));

// ── Ruta Principal (Servir la Aplicación) ─────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Inicio ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀  Servidor corriendo exitosamente`);
  console.log('📡  Socket.IO activo y escuchando eventos');
  console.log('\n   Endpoints cargados correctamente.');
});