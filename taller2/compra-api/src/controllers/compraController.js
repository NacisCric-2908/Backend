const Compra = require('../models/compra');
const { obtenerCliente } = require('../services/clienteService');
const { obtenerProducto } = require('../services/productoService');

// GET /compras — obtener todas las compras
const obtenerTodos = async (req, res) => {
  try {
    const compras = await Compra.findAll({
      order: [['id_compra', 'ASC']],
    });
    res.status(200).json(compras);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo compras', detalle: error.message });
  }
};

// GET /compras/:id — obtener compra por ID
const obtenerUno = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id);
    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    res.status(200).json(compra);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo compra', detalle: error.message });
  }
};

// POST /compras — registrar nueva compra previa validación interservicios
const crear = async (req, res) => {
  const clienteId = req.body.clienteId || req.body.id_cliente;
  const productoId = req.body.productoId || req.body.id_producto;
  const cantidad = req.body.cantidad;
  const fecha = req.body.fecha || new Date();
  const id_compra = req.body.id_compra;

  if (!clienteId || !productoId || cantidad === undefined || cantidad === null) {
    return res.status(400).json({
      mensaje: "los campos 'clienteId', 'productoId' y 'cantidad' son obligatorios",
    });
  }

  if (Number(cantidad) <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
  }

  let cliente;
  let producto;

  try {
    cliente = await obtenerCliente(clienteId);
    producto = await obtenerProducto(productoId);
  } catch (error) {
    console.error(error);
    return res.status(503).json({
      mensaje: 'No se pudo validar la compra porque uno de los servicios no respondio',
      detalle: error.message,
    });
  }

  if (!cliente) {
    return res.status(404).json({ mensaje: `El cliente ${clienteId} no existe` });
  }

  if (!producto) {
    return res.status(404).json({ mensaje: `El producto ${productoId} no existe` });
  }

  if (producto.stock < cantidad) {
    return res.status(400).json(`Stock insuficiente. Disponible ${producto.stock}, solicitado ${cantidad}`);
  }

  try {
    const payload = {
      id_cliente: Number(clienteId),
      id_producto: Number(productoId),
      fecha,
      cantidad: Number(cantidad),
    };

    if (id_compra !== undefined && id_compra !== null) {
      payload.id_compra = Number(id_compra);
    }

    const nuevaCompra = await Compra.create(payload);
    res.status(201).json(nuevaCompra);
  } catch (error) {
    res.status(500).json({ error: 'Error registrando compra', detalle: error.message });
  }
};

// PUT /compras/:id — actualizar compra existente
const actualizar = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id);
    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const clienteId = req.body.clienteId || req.body.id_cliente;
    const productoId = req.body.productoId || req.body.id_producto;
    const cantidad = req.body.cantidad;
    const fecha = req.body.fecha;

    const nuevoClienteId = clienteId !== undefined ? Number(clienteId) : compra.id_cliente;
    const nuevoProductoId = productoId !== undefined ? Number(productoId) : compra.id_producto;
    const nuevaCantidad = cantidad !== undefined ? Number(cantidad) : compra.cantidad;

    if (nuevaCantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    // Validar con servicios si cambiaron o se actualizaron
    try {
      if (clienteId !== undefined) {
        const cliente = await obtenerCliente(nuevoClienteId);
        if (!cliente) {
          return res.status(404).json({ mensaje: `El cliente ${nuevoClienteId} no existe` });
        }
      }

      if (productoId !== undefined || cantidad !== undefined) {
        const producto = await obtenerProducto(nuevoProductoId);
        if (!producto) {
          return res.status(404).json({ mensaje: `El producto ${nuevoProductoId} no existe` });
        }
        if (producto.stock < nuevaCantidad) {
          return res.status(400).json(`Stock insuficiente. Disponible ${producto.stock}, solicitado ${nuevaCantidad}`);
        }
      }
    } catch (error) {
      return res.status(503).json({
        mensaje: 'No se pudo validar la compra porque uno de los servicios no respondio',
        detalle: error.message,
      });
    }

    await compra.update({
      id_cliente: nuevoClienteId,
      id_producto: nuevoProductoId,
      cantidad: nuevaCantidad,
      fecha: fecha !== undefined ? fecha : compra.fecha,
    });

    res.status(200).json(compra);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando compra', detalle: error.message });
  }
};

// DELETE /compras/:id — eliminar compra
const eliminar = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id);
    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    await compra.destroy();
    res.status(200).json({ mensaje: 'Compra eliminada', eliminado: compra });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando compra', detalle: error.message });
  }
};

module.exports = {
  obtenerTodos,
  obtenerUno,
  crear,
  actualizar,
  eliminar,
};
