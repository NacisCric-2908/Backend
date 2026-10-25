const Compra = require('../models/compra');
const { obtenerCliente } = require('../services/clienteService');
const { obtenerProducto, ajustarStock } = require('../services/productoService');

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

  // El total se calcula con el precio del producto al momento de la compra.
  const total = Number(producto.precio) * Number(cantidad);

  try {
    // Se descuenta el stock antes de registrar la compra: así nunca queda
    // una compra registrada con stock que en realidad no se reservó.
    await ajustarStock(productoId, -Number(cantidad));
  } catch (error) {
    console.error(error);
    return res.status(503).json({
      mensaje: 'No se pudo descontar el stock del producto',
      detalle: error.message,
    });
  }

  try {
    const payload = {
      id_cliente: Number(clienteId),
      id_producto: Number(productoId),
      cantidad: Number(cantidad),
      total,
      fecha,
    };

    if (id_compra !== undefined && id_compra !== null) {
      payload.id_compra = Number(id_compra);
    }

    const nuevaCompra = await Compra.create(payload);
    res.status(201).json(nuevaCompra);
  } catch (error) {
    // Si falla el registro de la compra, se revierte el descuento de stock
    // para no dejar el producto con menos unidades de las reales.
    try {
      await ajustarStock(productoId, Number(cantidad));
    } catch (rollbackError) {
      console.error('No se pudo revertir el stock tras un error al crear la compra:', rollbackError.message);
    }
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

    const cambiaProducto = productoId !== undefined && nuevoProductoId !== compra.id_producto;
    const cambiaCantidad = cantidad !== undefined && nuevaCantidad !== compra.cantidad;

    let nuevoTotal = Number(compra.total);

    try {
      if (clienteId !== undefined) {
        const cliente = await obtenerCliente(nuevoClienteId);
        if (!cliente) {
          return res.status(404).json({ mensaje: `El cliente ${nuevoClienteId} no existe` });
        }
      }

      if (cambiaProducto) {
        // Cambia de producto: se valida el nuevo, se reserva su stock
        // y se devuelve el stock reservado en el producto anterior.
        const nuevoProducto = await obtenerProducto(nuevoProductoId);
        if (!nuevoProducto) {
          return res.status(404).json({ mensaje: `El producto ${nuevoProductoId} no existe` });
        }
        if (nuevoProducto.stock < nuevaCantidad) {
          return res.status(400).json(`Stock insuficiente. Disponible ${nuevoProducto.stock}, solicitado ${nuevaCantidad}`);
        }

        await ajustarStock(nuevoProductoId, -nuevaCantidad);
        await ajustarStock(compra.id_producto, Number(compra.cantidad));

        nuevoTotal = Number(nuevoProducto.precio) * nuevaCantidad;
      } else if (cambiaCantidad) {
        // Mismo producto, cambia la cantidad: solo se ajusta la diferencia.
        const producto = await obtenerProducto(nuevoProductoId);
        if (!producto) {
          return res.status(404).json({ mensaje: `El producto ${nuevoProductoId} no existe` });
        }

        const delta = nuevaCantidad - Number(compra.cantidad);
        if (delta > 0 && producto.stock < delta) {
          return res.status(400).json(`Stock insuficiente. Disponible ${producto.stock}, solicitado ${delta}`);
        }

        await ajustarStock(nuevoProductoId, -delta);
        nuevoTotal = Number(producto.precio) * nuevaCantidad;
      }
    } catch (error) {
      console.error(error);
      return res.status(503).json({
        mensaje: 'No se pudo validar la compra porque uno de los servicios no respondio',
        detalle: error.message,
      });
    }

    await compra.update({
      id_cliente: nuevoClienteId,
      id_producto: nuevoProductoId,
      cantidad: nuevaCantidad,
      total: nuevoTotal,
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

    try {
      // Se devuelve el stock reservado antes de eliminar el registro: si la
      // devolución falla, la compra no se borra y el estado queda consistente.
      await ajustarStock(compra.id_producto, Number(compra.cantidad));
    } catch (error) {
      console.error(error);
      return res.status(503).json({
        mensaje: 'No se pudo devolver el stock del producto',
        detalle: error.message,
      });
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
