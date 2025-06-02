const express = require('express');
const fs = require('fs/promises');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// === Serve Static Files ===
// Assets like images, CSS, frontend scripts
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public'))); // for admin.html and others

// === File Paths ===
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const STOCK_FILE = path.join(__dirname, 'stock.json');
const SALES_FILE = path.join(__dirname, 'sales.json');

// === Utility Functions ===
async function readJson(file) {
  const data = await fs.readFile(file, 'utf-8');
  return JSON.parse(data);
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// === API ROUTES ===

// Get product list
app.get('/api/products', async (req, res) => {
  try {
    const products = await readJson(PRODUCTS_FILE);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load products.' });
  }
});

// Record a sale
app.post('/api/sale', async (req, res) => {
  const sale = req.body;

  if (!sale || !Array.isArray(sale.items)) {
    return res.status(400).json({ error: 'Invalid sale data.' });
  }

  try {
    const stock = await readJson(STOCK_FILE);
    const sales = await readJson(SALES_FILE);

    let totalProfit = 0;

    sale.items.forEach(item => {
      const product = stock.find(p => p.id === item.id);
      if (product) {
        product.stock -= item.quantity;
        totalProfit += item.quantity * (item.price - product.costPrice);
      }
    });

    const newSale = {
      ...sale,
      totalProfit,
      timestamp: new Date().toISOString(),
    };

    sales.push(newSale);

    await writeJson(STOCK_FILE, stock);
    await writeJson(SALES_FILE, sales);

    res.json({ message: 'Sale recorded', profit: totalProfit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record sale.' });
  }
});

// Get report
app.get('/api/report', async (req, res) => {
  try {
    const sales = await readJson(SALES_FILE);
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
    res.json({ totalSales: sales.length, totalRevenue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// === ADMIN PAGE ROUTE ===
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html')); // make sure admin.html is inside /public
});

// === START SERVER ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
