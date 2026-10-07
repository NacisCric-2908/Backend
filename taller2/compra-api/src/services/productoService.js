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

module.exports = { obtenerProducto };