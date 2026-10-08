const Juego = require('../models/juego');

// GET /juegos — devuelve todos los registros
const obtenerTodos = async (req, res) => {
  try {
    const juegos = await Juego.findAll();
    res.json(juegos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los videojuegos', detalle: error.message });
  }
};

// GET /juegos/:id — devuelve un registro por su ID
const obtenerUno = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'El id debe ser un número entero' });
    }

    const juego = await Juego.findByPk(id);
    if (!juego) {
      return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
    }
    res.json(juego);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el videojuego', detalle: error.message });
  }
};

// POST /juegos — crea un nuevo registro con el ID proporcionado por el cliente
const crear = async (req, res) => {
  try {
    const { id, titulo, genero, plataforma, año, disponible } = req.body;

    if (id === undefined || id === null || id === '') {
      return res.status(400).json({ error: 'id es obligatorio' });
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'El id debe ser un número entero válido' });
    }

    if (!titulo || !genero || !plataforma) {
      return res.status(400).json({ error: 'titulo, genero y plataforma son obligatorios' });
    }

    // Si ya existe un videojuego con ese ID, Sequelize lanzará error de clave única duplicada
    const nuevo = await Juego.create({
      id: parsedId,
      titulo,
      genero,
      plataforma,
      año: año !== undefined && año !== null ? parseInt(año, 10) : null,
      disponible: disponible !== undefined ? Boolean(disponible) : true,
    });

    res.status(201).json(nuevo);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: `Ya existe un videojuego con id ${req.body.id}` });
    }
    res.status(500).json({ error: 'Error al crear el videojuego', detalle: error.message });
  }
};

// PUT /juegos/:id — actualiza los campos de un registro existente (no el ID)
const actualizar = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'El id debe ser un número entero' });
    }

    const juego = await Juego.findByPk(id);
    if (!juego) {
      return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
    }

    const { titulo, genero, plataforma, año, disponible } = req.body;
    if (!titulo || !genero || !plataforma) {
      return res.status(400).json({ error: 'titulo, genero y plataforma son obligatorios' });
    }

    // El ID no se actualiza: es la clave primaria y no debe cambiar
    await juego.update({
      titulo,
      genero,
      plataforma,
      año: año !== undefined ? (año !== null ? parseInt(año, 10) : null) : juego.año,
      disponible: disponible !== undefined ? Boolean(disponible) : juego.disponible,
    });

    res.json(juego);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el videojuego', detalle: error.message });
  }
};

// DELETE /juegos/:id — elimina un registro por su ID
const eliminar = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'El id debe ser un número entero' });
    }

    const juego = await Juego.findByPk(id);
    if (!juego) {
      return res.status(404).json({ error: `No se encontró el videojuego con id ${id}` });
    }

    await juego.destroy();
    res.json({ mensaje: 'Videojuego eliminado exitosamente', eliminado: juego });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el videojuego', detalle: error.message });
  }
};

module.exports = { obtenerTodos, obtenerUno, crear, actualizar, eliminar };
