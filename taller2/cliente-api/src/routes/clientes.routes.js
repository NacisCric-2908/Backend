const express = require('express');
const router = express.Router();
const {
  obtenerTodos,
  obtenerUno,
  crear,
  actualizar,
  eliminar,
} = require('../controllers/clienteController');

router.get('/', obtenerTodos);
router.get('/:id', obtenerUno);
router.post('/', crear);
router.put('/:id', actualizar);
router.delete('/:id', eliminar);

module.exports = router;