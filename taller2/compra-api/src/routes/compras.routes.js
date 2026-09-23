const express = require("express");
const router = express.Router();
const compras = require("../data/compras");
const { obtenerCliente } = require("../services/clienteService")
const { obtenerProducto } = require("../services/productoService")
const pool = require("../db")

let siguienteId = 1;

// get /compras
router.get("/", async (req, res) => {
    const resultado = await pool.query(
        "SELECT * FROM compra"
    );
    res.status(200).json(resultado.rows);
});

// get /compras/:id
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
        const resultado = await pool.query(
            "SELECT * FROM compra WHERE id_compra = $1",
            [id]
        )

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Compra no encontrada"
            })
        }

        res.status(200).json(resultado.rows[0]);
    }
    catch{
        console.error(error)
        res.status(500).json({
            error: "Error obteniendo compra"
        });
    }
});


// POST /compras
router.post("/", async (req, res) => {
    const { id_compra, clienteId, productoId, fecha, cantidad } = req.body;

    if (!id_compra || !clienteId || !productoId || !fecha || !cantidad){
        return res.status(400).json({
            mensaje: "los campos 'id_compra', 'clienteId', 'productoId', 'fecha' y 'cantidad' son obligatorios"
        })
    }

    let cliente;
    let producto;

    try {
        cliente = await obtenerCliente(clienteId);
        producto = await obtenerProducto(productoId);

        if (!cliente) {
        return res.status(404).json({ mensaje: `El cliente ${clienteId} no existe` });
        }

        if (!producto) {
            return res.status(404).json({ mensaje: `El producto ${productoId} no existe` });
        }

        if (producto.stock < cantidad){
            return res.status(400).json(`Stock insuficiente. Disponible ${producto.stock}, solicitado ${cantidad}`);
        }

        const resultado = await pool.query(
        `
        INSERT INTO compra (id_compra, id_cliente, id_producto, fecha, cantidad)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [id_compra, clienteId, productoId, fecha, cantidad]
        );

        res.status(201).json(resultado.rows[0]);
    }
    catch (error){
        console.error(error)
        return res.status(503).json({
            mensaje: "No se pudo validar la compra porque uno de los servicios no respondio",
            detalle: error.message
        });
    }
});

module.exports = router;