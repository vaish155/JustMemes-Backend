const express = require('express');
const {
  handleListProducts,
  handleGetProductById,
  handleCreateProduct,
  handleUpdateProduct,
  handleDeleteProduct,
} = require('../controllers/productController');

const router = express.Router();

router.get('/', handleListProducts);
router.get('/:id', handleGetProductById);
router.post('/', handleCreateProduct);
router.put('/:id', handleUpdateProduct);
router.delete('/:id', handleDeleteProduct);

module.exports = router;
