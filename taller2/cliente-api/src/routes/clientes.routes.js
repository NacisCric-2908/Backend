const express = require("express");
const router = express.Router();
const clientes = require("../data/clientes");
const pool = require("../db");

// get /clientes
router.get("/", async (req, res) => {
    const resultado = await pool.query(
        "SELECT * FROM cliente"
    );
    res.status(200).json(resultado.rows);
});

// get /clientes/:id
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
        const resultado = await pool.query(
            "SELECT * FROM cliente WHERE id_cliente = $1",
            [id]
        )

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Usuario no encontrado"
            })
        }

        res.status(200).json(resultado.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error obteniendo usuario"
        });
    }

});

// POST /clientes
router.post("/", async (req, res) => {
    const { id_cliente, nombre, email } = req.body;

    try {
        const resultado = await pool.query(
        `
        INSERT INTO cliente (id_cliente, nombre, email)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [id_cliente, nombre, email]
        );

        res.status(201).json(resultado.rows[0]);
    }
    catch (error){
        console.error(error)
        res.status(500).json({
            error: "Error creando cliente"
        });
    }
});

module.exports = router;