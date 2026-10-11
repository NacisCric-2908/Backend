// GET /productos/:id en producto-api
async function obtenerProducto(id) {
  const url = process.env.PRODUCTO_API_URL || 'http://localhost:3002';
  const respuesta = await fetch(`${url}/productos/${id}`);

  if (respuesta.status === 404) {
    return null;
  }

  if (!respuesta.ok) {
    throw new Error(`producto-api respondio con estado ${respuesta.status}`);
  }

  return respuesta.json();
}

// Ajusta el stock de un producto en producto-api sumando `delta` al stock actual
// (delta negativo para descontar al comprar, positivo para devolver al
// actualizar/cancelar una compra). Lee el stock actual y lo actualiza con
// PUT /productos/:id, ya que compra-api no tiene acceso directo a la tabla
// producto: es responsabilidad exclusiva de producto-api.
async function ajustarStock(id, delta) {
  const producto = await obtenerProducto(id);
  if (!producto) {
    throw new Error(`No se encontró el producto ${id} al ajustar el stock`);
  }

  const nuevoStock = Number(producto.stock) + delta;
  if (nuevoStock < 0) {
    throw new Error(`Stock insuficiente para el producto ${id}`);
  }

  const url = process.env.PRODUCTO_API_URL || 'http://localhost:3002';
  const respuesta = await fetch(`${url}/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: nuevoStock }),
  });

  if (!respuesta.ok) {
    throw new Error(`producto-api respondio con estado ${respuesta.status} al ajustar el stock`);
  }

  return respuesta.json();
}

module.exports = { obtenerProducto, ajustarStock };
