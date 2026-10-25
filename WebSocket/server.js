// =====================================================================
//  server.js · Servidor del mini chat (proceso 1)
//  - Entrega la página public/index.html por HTTP.
//  - Atiende las conexiones WebSocket en el MISMO puerto.
// =====================================================================
import { WebSocketServer, WebSocket } from 'ws';
import 'dotenv/config'; // carga las variables del archivo .env en process.env
import http from 'node:http';
import { readFile } from 'node:fs/promises';

// --- Configuración: todo sale de las variables de entorno -----------
const PORT = Number(process.env.PORT);
const WS_URL = process.env.WS_URL;

if (!PORT || !WS_URL) {
  console.error('Faltan variables de entorno. Copia .env.example a .env y define PORT y WS_URL.');
  process.exit(1);
}

const TAMANO_MAXIMO = 1024;           // 1 KB: los mensajes más grandes se rechazan
const INTERVALO_LATIDO = 30_000;      // ping/pong cada 30 segundos

// Arma un mensaje con la forma acordada: { tipo, autor, texto, hora }
function crearMensaje(tipo, autor, texto) {
  return JSON.stringify({ tipo, autor, texto, hora: new Date().toISOString() });
}

// Envía un mensaje a TODOS los clientes conectados (broadcast)
function difundir(mensaje) {
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(mensaje);
  }
}

// --- Servidor HTTP: entrega la página del chat ----------------------
const servidorHttp = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
    // Inyectamos WS_URL para que la URL no quede escrita a mano en el HTML
    const pagina = html.replace('"__WS_URL__"', JSON.stringify(WS_URL));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(pagina);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
});

// --- Servidor WebSocket: comparte el puerto con el servidor HTTP ----
const wss = new WebSocketServer({ server: servidorHttp }); // mismo puerto

wss.on('connection', (socket) => {
  // Latido: marcamos la conexión como viva; cada "pong" la vuelve a marcar
  socket.estaVivo = true;
  socket.on('pong', () => { socket.estaVivo = true; });

  // 1. El servidor habla primero: saludo solo para el que se conecta
  socket.send(crearMensaje('sistema', 'servidor', 'Hola mundo!'));

  // 2. El servidor avisa a todos (por iniciativa propia) que alguien entró
  difundir(crearMensaje('sistema', 'servidor', `Se conectó un usuario. Conectados: ${wss.clients.size}`));

  // 3. Cada mensaje de un cliente se valida y se reenvía a todos
  socket.on('message', (data) => {
    // Validación 1: tamaño máximo de 1 KB
    if (data.length > TAMANO_MAXIMO) {
      socket.send(crearMensaje('sistema', 'servidor', 'Mensaje rechazado: supera 1 KB.'));
      return;
    }

    // Validación 2: debe ser JSON válido con un texto
    let entrada;
    try {
      entrada = JSON.parse(data.toString());
    } catch {
      socket.send(crearMensaje('sistema', 'servidor', 'Mensaje rechazado: no es JSON válido.'));
      return;
    }
    if (typeof entrada?.texto !== 'string' || entrada.texto.trim() === '') {
      socket.send(crearMensaje('sistema', 'servidor', 'Mensaje rechazado: falta el campo "texto".'));
      return;
    }

    // El servidor pone el tipo y la hora; el autor lo manda el cliente
    const autor = typeof entrada.autor === 'string' && entrada.autor.trim() ? entrada.autor.trim() : 'anónimo';
    const salida = crearMensaje('chat', autor, entrada.texto.trim());

    for (const c of wss.clients) { // broadcast
      if (c.readyState === WebSocket.OPEN) c.send(salida);
    }
  });

  // 4. Cuando alguien se va, el servidor avisa a los que quedan
  socket.on('close', () => {
    difundir(crearMensaje('sistema', 'servidor', `Se desconectó un usuario. Conectados: ${wss.clients.size}`));
  });
});

// --- Latido (ping/pong): cierra las conexiones muertas --------------
// Cada 30 s enviamos un ping. Si un cliente no respondió el ping anterior
// con un pong, damos la conexión por muerta y la terminamos.
const latido = setInterval(() => {
  for (const c of wss.clients) {
    if (c.estaVivo === false) {
      c.terminate();
      continue;
    }
    c.estaVivo = false;
    c.ping();
  }
}, INTERVALO_LATIDO);

wss.on('close', () => clearInterval(latido));

servidorHttp.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
  console.log(`Los clientes se conectarán a ${WS_URL}`);
});
