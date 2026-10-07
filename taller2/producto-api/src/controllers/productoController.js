const Producto = require('../models/producto');

// GET /productos — obtener todos los productos
const obtenerTodos = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      order: [['id_producto', 'ASC']],
    });
    res.status(200).json(productos);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo productos', detalle: error.message });
  }
};

// GET /productos/:id — obtener producto por ID
const obtenerUno = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json(producto);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo producto', detalle: error.message });
  }
};

// POST /productos — registrar nuevo producto
const crear = async (req, res) => {
  try {
    const { id_producto, nombre, precio, stock } = req.body;
    if (!nombre || precio === undefined || stock === undefined) {
      return res.status(400).json({ error: 'nombre, precio y stock son obligatorios' });
    }

    if (Number(stock) < 0) {
      return res.status(400).json({ error: 'El stock no puede ser negativo' });
    }

    const payload = {
      nombre,
      precio: Number(precio),
      stock: Number(stock),
    };
    if (id_producto !== undefined && id_producto !== null) {
      payload.id_producto = Number(id_producto);
    }

    const nuevoProducto = await Producto.create(payload);
    res.status(201).json(nuevoProducto);
  } catch (error) {
    res.status(500).json({ error: 'Error creando el producto', detalle: error.message });
  }
};

// PUT /productos/:id — actualizar producto
const actualizar = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const { nombre, precio, stock } = req.body;
    if (nombre === undefined && precio === undefined && stock === undefined) {
      return res.status(400).json({ error: 'Debe proporcionar al menos un campo para actualizar (nombre, precio, stock)' });
    }

    if (stock !== undefined && Number(stock) < 0) {
      return res.status(400).json({ error: 'El stock no puede ser negativo' });
    }

    await producto.update({
      nombre: nombre !== undefined ? nombre : producto.nombre,
      precio: precio !== undefined ? Number(precio) : producto.precio,
      stock: stock !== undefined ? Number(stock) : producto.stock,
    });

    res.status(200).json(producto);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando producto', detalle: error.message });
  }
};

// DELETE /productos/:id — eliminar producto
const eliminar = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await producto.destroy();
    res.status(200).json({ mensaje: 'Producto eliminado', eliminado: producto });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando producto', detalle: error.message });
  }
};

module.exports = {
  obtenerTodos,
  obtenerUno,
  crear,
  actualizar,
  eliminar,
};
