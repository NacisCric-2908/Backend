require("dotenv").config();
const express = require("express");
const comprasRoutes = require("./routes/compras.routes");
const pool = require("./db")

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json())
app.use("/compras", comprasRoutes);

app.get("/", async (req, res) => {
    try {
        const resultado = await pool.query("SELECT NOW()");

        res.status(200).json({
            mensaje: "Conexion exitosa, compra-api activa",
            fechaPostgres: resultado.rows[0]
        });
    }
    catch (error){
        console.error(error);
        res.status(500).json({
            error: "Error conectando con PostgreSQL"
        })
    }
});

app.listen(PORT, () => {
    console.log(`Compra-api escuchando en el puerto ${PORT}`);
});