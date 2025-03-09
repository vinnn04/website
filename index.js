const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// MySQL Database Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'y9451216A123!@#', // Replace with your MySQL password
  database: 'mydb',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
    return;
  }
  console.log('Connected to the MySQL database.');
});

// Multer Configuration for File Uploads
const upload = multer({
  dest: 'uploads/', // Folder to store uploaded files
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /jpg|jpeg|png|gif/;
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg/gif/png) are allowed!'));
    }
  },
});

// ------------------ Backend APIs ------------------ //

// Get Categories
app.get('/categories', (req, res) => {
  db.query('SELECT * FROM categories', (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Error retrieving categories' });
      return;
    }
    res.json(results);
  });
});

// Add a New Category
app.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }
  db.query('INSERT INTO categories (name) VALUES (?)', [name], (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Error adding category' });
      return;
    }
    res.json({ message: 'Category added successfully', categoryId: result.insertId });
  });
});

// Add a New Product
app.post('/products', upload.single('image'), (req, res) => {
  const { catid, name, price, description } = req.body;
  const image = req.file ? req.file.filename : null;

  // Input Validation
  if (!catid || !name || !price || !description || !image) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  db.query(
    'INSERT INTO products (catid, name, price, description, image_path) VALUES (?, ?, ?, ?, ?)',
    [catid, name, price, description, image],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: 'Error adding product' });
        return;
      }
      res.json({ message: 'Product added successfully', productId: result.insertId });
    }
  );
});

// Get All Products
app.get('/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Error retrieving products' });
      return;
    }
    res.json(results);
  });
});

// Serve Uploaded Files
app.use('/uploads', express.static('uploads'));

// Start the Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});