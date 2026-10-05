// index.js
const express = require('express');
const app = express();

// Middleware: le dice a Express que lea el cuerpo de las peticiones como JSON
app.use(express.json());

// ─── CATÁLOGO DE VIDEOJUEGOS EN MEMORIA ─────────────────────────
let juegos = [
  {
    id: 1,
    titulo: 'The Legend of Zelda: Breath of the Wild',
    genero: 'Aventura / Acción',
    plataforma: 'Nintendo Switch',
    año: 2017,
    disponible: true
  },
  {
    id: 2,
    titulo: 'Elden Ring',
    genero: 'Action RPG',
    plataforma: 'PC / PS5 / Xbox Series X',
    año: 2022,
    disponible: true
  },
  {
    id: 3,
    titulo: 'God of War Ragnarök',
    genero: 'Acción / Aventura',
    plataforma: 'PS4 / PS5',
    año: 2022,
    disponible: false
  }
];

// Contador para asignar IDs autoincrementales a nuevos registros
let nextId = 4;
// ─────────────────────────────────────────────────────────────────

// GET /juegos — Obtener todos los videojuegos
app.get('/juegos', (req, res) => {
  res.json(juegos);
});

// GET /juegos/:id — Obtener un videojuego por ID
app.get('/juegos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const juego = juegos.find(j => j.id === id);

  if (!juego) {
    return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
  }

  res.json(juego);
});

// POST /juegos — Registrar un nuevo videojuego
app.post('/juegos', (req, res) => {
  const { titulo, genero, plataforma, año, disponible } = req.body;

  // Validación básica: campos obligatorios
  if (!titulo || !genero || !plataforma) {
    return res.status(400).json({
      error: 'Los campos titulo, genero y plataforma son obligatorios'
    });
  }

  const nuevoJuego = {
    id: nextId++,
    titulo,
    genero,
    plataforma,
    año: año ? parseInt(año, 10) : null,
    disponible: disponible !== undefined ? Boolean(disponible) : true
  };

  juegos.push(nuevoJuego);
  res.status(201).json(nuevoJuego);
});

// PUT /juegos/:id — Actualizar un videojuego existente
app.put('/juegos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = juegos.findIndex(j => j.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
  }

  const { titulo, genero, plataforma, año, disponible } = req.body;

  if (!titulo || !genero || !plataforma) {
    return res.status(400).json({
      error: 'Los campos titulo, genero y plataforma son obligatorios'
    });
  }

  juegos[index] = {
    id,
    titulo,
    genero,
    plataforma,
    año: año ? parseInt(año, 10) : juegos[index].año,
    disponible: disponible !== undefined ? Boolean(disponible) : juegos[index].disponible
  };

  res.json(juegos[index]);
});

// DELETE /juegos/:id — Eliminar un videojuego
app.delete('/juegos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = juegos.findIndex(j => j.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
  }

  const eliminado = juegos.splice(index, 1)[0];
  res.json({ mensaje: 'Videojuego eliminado exitosamente', eliminado });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎮 API de Videojuegos corriendo en http://localhost:${PORT}`);
});
