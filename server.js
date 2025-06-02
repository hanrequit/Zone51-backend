const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());

const allowedOrigins = [
  'https://zone51.vercel.app',
  'https://zone51-frontend.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed from this origin: ' + origin));
    }
  }
}));

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
    let totalRevenue = 0; // <-- Add this line

    sale.items.forEach(item => {
      const product = stock.find(p => p.id === item.id);
      if (product) {
        product.stock -= item.quantity;
        totalProfit += item.quantity * (item.price - product.costPrice);
        totalRevenue += item.quantity * item.price; // <-- Add this line
      }
    });

    const newSale = {
      ...sale,
      totalProfit,
      totalRevenue, // <-- Add this line
      timestamp: new Date().toISOString(),
    };

    sales.push(newSale);

    await writeJson(STOCK_FILE, stock);
    await writeJson(SALES_FILE, sales);

    res.json({ message: 'Sale recorded', profit: totalProfit, revenue: totalRevenue }); // <-- Add revenue to response
  } catch (err) {
    res.status(500).json({ error: 'Failed to record sale.' });
  }
});

app.get('/api/report', async (req, res) => {
  try {
    const sales = await readJson(SALES_FILE);
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.totalRevenue || 0), 0); // <-- Change to totalRevenue
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);   // <-- Optionally add profit
    res.json({ totalSales: sales.length, totalRevenue, totalProfit }); // <-- Return both
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report.' });
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
