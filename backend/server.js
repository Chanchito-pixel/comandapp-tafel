// ════════════════════════════════════════════════════════
//  server.js  —  Punto de entrada del servidor
//  Ejecutar con: npm run dev  (desarrollo)
//            o: npm start    (producción)
// ════════════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const app        = express();
const httpServer = http.createServer(app);

// ── Socket.IO con soporte CORS ────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:  '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Guarda `io` en la app para que las rutas puedan emitir eventos
app.set('io', io);

// ── Middlewares globales ──────────────────────────────────
console.log('auth:',     typeof require('./routes/auth'));
console.log('usuarios:', typeof require('./routes/usuarios'));
console.log('mesas:',    typeof require('./routes/mesas'));
console.log('menu:',     typeof require('./routes/menu'));
console.log('comandas:', typeof require('./routes/comandas'));
app.use(cors());          // Permite llamadas desde el frontend
app.use(express.json());  // Parsea JSON en el body de los requests

// ── Salas de Socket.IO ────────────────────────────────────
// Cada cliente se une a la sala de su rol al conectarse
io.on('connection', (socket) => {
  // El frontend llama socket.emit('join', 'cocina') o 'mozo-5' etc.
  socket.on('join', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {});
});

// ── Rutas de la API ───────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/mesas',    require('./routes/mesas'));
app.use('/api/menu',     require('./routes/menu'));
app.use('/api/comandas', require('./routes/comandas'));

// ── Ruta de estado ────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ estado: '✅ ComandApp API corriendo', version: '2.0' });
});

// ── Inicio ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀  Servidor en http://localhost:${PORT}`);
  console.log('📡  Socket.IO activo');
  console.log('\n   Endpoints:');
  console.log('   POST   /api/auth/login');
  console.log('   ─── Usuarios (owner) ───');
  console.log('   GET|POST         /api/usuarios');
  console.log('   GET|PUT|DELETE   /api/usuarios/:id');
  console.log('   ─── Mesas ───────────────');
  console.log('   GET|POST         /api/mesas');
  console.log('   GET|PUT|DELETE   /api/mesas/:id');
  console.log('   ─── Menú ────────────────');
  console.log('   GET|POST         /api/menu');
  console.log('   GET|PUT|DELETE   /api/menu/:id');
  console.log('   ─── Comandas ────────────');
  console.log('   GET              /api/comandas');
  console.log('   GET              /api/comandas/mozo/:id');
  console.log('   POST             /api/comandas');
  console.log('   PUT              /api/comandas/:id/estado');
  console.log('   DELETE           /api/comandas/:id\n');
});
