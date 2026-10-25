async function obtenerCliente(id) {
  const url = process.env.CLIENTE_API_URL || 'http://localhost:3001';
  const respuesta = await fetch(`${url}/clientes/${id}`);

  if (respuesta.status === 404) {
    return null;
  }

  if (!respuesta.ok) {
    throw new Error(`cliente-api respondio con estado ${respuesta.status}`);
  }

  return respuesta.json();
}

module.exports = { obtenerCliente };