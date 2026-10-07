const Cliente = require('../models/cliente');

// GET /clientes — obtener todos los clientes
const obtenerTodos = async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      order: [['id_cliente', 'ASC']],
    });
    res.status(200).json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo clientes', detalle: error.message });
  }
};

// GET /clientes/:id — obtener cliente por ID
const obtenerUno = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(200).json(cliente);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo usuario', detalle: error.message });
  }
};

// POST /clientes — registrar un cliente
const crear = async (req, res) => {
  try {
    const { id_cliente, nombre, email } = req.body;
    if (!nombre || !email) {
      return res.status(400).json({ error: 'nombre y email son obligatorios' });
    }

    const payload = { nombre, email };
    if (id_cliente !== undefined && id_cliente !== null) {
      payload.id_cliente = Number(id_cliente);
    }

    const nuevoCliente = await Cliente.create(payload);
    res.status(201).json(nuevoCliente);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El email ya está registrado', detalle: error.message });
    }
    res.status(500).json({ error: 'Error creando cliente', detalle: error.message });
  }
};

// PUT /clientes/:id — actualizar cliente
const actualizar = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { nombre, email } = req.body;
    if (nombre === undefined && email === undefined) {
      return res.status(400).json({ error: 'Debe proporcionar al menos nombre o email para actualizar' });
    }

    await cliente.update({
      nombre: nombre !== undefined ? nombre : cliente.nombre,
      email: email !== undefined ? email : cliente.email,
    });

    res.status(200).json(cliente);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El email ya está registrado', detalle: error.message });
    }
    res.status(500).json({ error: 'Error actualizando cliente', detalle: error.message });
  }
};

// DELETE /clientes/:id — eliminar cliente
const eliminar = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await cliente.destroy();
    res.status(200).json({ mensaje: 'Cliente eliminado', eliminado: cliente });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando cliente', detalle: error.message });
  }
};

module.exports = {
  obtenerTodos,
  obtenerUno,
  crear,
  actualizar,
  eliminar,
};
