import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Quantity <= 0 (or missing) always means the product is out of stock.
const applyStockRules = (data) => {
  const qty = Number(data.quantity);
  data.quantity = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  if (data.quantity <= 0) data.inStock = false;
  else if (data.inStock === undefined) data.inStock = true;
  return data;
};

// Reconciles stored docs (older products may have quantity 0 but inStock true).
const syncStock = (product) => {
  if (!product) return product;
  if ((Number(product.quantity) || 0) <= 0) product.inStock = false;
  return product;
};

router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().select('name subcategories');
    const validCategoryNames = new Set(categories.map((c) => c.name));
    const validSubCategoryMap = {};
    categories.forEach((c) => {
      c.subcategories.forEach((sub) => {
        validSubCategoryMap[`${c.name}::${sub}`] = true;
      });
    });

    const products = await Product.find().sort({ createdAt: -1 });
    const filtered = products.filter((p) => {
      if (!validCategoryNames.has(p.category)) return false;
      if (p.subCategory && !validSubCategoryMap[`${p.category}::${p.subCategory}`]) return false;
      return true;
    });
    res.json(filtered.map(syncStock));
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(syncStock(product));
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.id && !data._id) {
      data._id = data.id;
      delete data.id;
    }
    if (data.quantity === undefined || data.quantity === null || data.quantity === '') {
      data.quantity = 0;
    }
    applyStockRules(data);
    const product = new Product(data);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Product with this ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.id && !data._id) {
      data._id = data.id;
      delete data.id;
    }
    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (data.quantity === undefined || data.quantity === null || data.quantity === '') {
      data.quantity = existing.quantity;
    }
    applyStockRules(data);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    );
    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
