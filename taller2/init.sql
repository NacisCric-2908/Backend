-- ===================================================
-- Script de Inicialización de Base de Datos - Taller 2
-- ===================================================

-- 1. Tabla: cliente
CREATE TABLE IF NOT EXISTS cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

-- 2. Tabla: producto
CREATE TABLE IF NOT EXISTS producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10, 2) NOT NULL,
    stock INT NOT NULL CHECK (stock >= 0)
);

-- 3. Tabla: compra
CREATE TABLE IF NOT EXISTS compra (
    id_compra SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cantidad INT NOT NULL CHECK (cantidad > 0)
);

-- Inserción de al menos 5 registros por tabla
-- Registros para cliente
INSERT INTO cliente (id_cliente, nombre, email) VALUES
    (1, 'Laura Gómez', 'laura.gomez@example.com'),
    (2, 'Andrés Ruiz', 'andres.ruiz@example.com'),
    (3, 'Carlos Mendoza', 'carlos.mendoza@example.com'),
    (4, 'María Fernanda Morales', 'maria.morales@example.com'),
    (5, 'David Alejandro Patiño', 'david.patino@example.com')
ON CONFLICT (id_cliente) DO NOTHING;

-- Registros para producto
INSERT INTO producto (id_producto, nombre, precio, stock) VALUES
    (1, 'Teclado Mecánico RGB', 180000.00, 15),
    (2, 'Mouse Inalámbrico Ergonómico', 65000.00, 30),
    (3, 'Monitor Gamer 27 Pulgadas 144Hz', 920000.00, 8),
    (4, 'Audífonos Bluetooth con Cancelación de Ruido', 250000.00, 12),
    (5, 'Silla Ergonómica de Oficina', 480000.00, 5)
ON CONFLICT (id_producto) DO NOTHING;

-- Registros para compra
INSERT INTO compra (id_compra, id_cliente, id_producto, fecha, cantidad) VALUES
    (1, 1, 1, '2026-09-20 14:30:00', 1),
    (2, 2, 2, '2026-09-21 10:15:00', 2),
    (3, 3, 3, '2026-09-21 16:45:00', 1),
    (4, 4, 4, '2026-09-22 11:20:00', 1),
    (5, 5, 2, '2026-09-22 18:00:00', 3)
ON CONFLICT (id_compra) DO NOTHING;

-- Sincronizar secuencias automáticas de IDs en PostgreSQL
SELECT setval('cliente_id_cliente_seq', COALESCE((SELECT MAX(id_cliente) FROM cliente), 1));
SELECT setval('producto_id_producto_seq', COALESCE((SELECT MAX(id_producto) FROM producto), 1));
SELECT setval('compra_id_compra_seq', COALESCE((SELECT MAX(id_compra) FROM compra), 1));
