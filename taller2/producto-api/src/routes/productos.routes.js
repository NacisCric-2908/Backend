const express = require("express");
const router = express.Router();
const productos = require("../data/productos");
const pool = require("../db");

// get /productos
router.get("/", async (req, res) => {
    const resultado = await pool.query(
        "SELECT * FROM producto"
    );
    res.status(200).json(resultado.rows);
});

// get /productos/:id
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
        const resultado = await pool.query(
            "SELECT * FROM producto WHERE id_producto = $1",
            [id]
        )

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Producto no encontrado"
            })
        }

        res.status(200).json(resultado.rows[0]);
    }
    catch (error){
        console.error(error)
        res.status(500).json({
            error: "Error obteniendo producto"
        });
    }
});

// POST /productos
router.post("/", async (req, res) => {
    const { id_producto, nombre, precio, stock } = req.body;

    try{
        const resultado = await pool.query(
            `
            INSERT INTO producto (id_producto, nombre, precio, stock)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [id_producto, nombre, precio, stock]
        )
        res.status(201).json(resultado.rows[0]);
    }
    catch (error){
        console.error(error)
        res.status(500).json({
            error: "Error creando el producto"
        });
    }
});

module.exports = router;