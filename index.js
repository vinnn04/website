const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const { body, param, validationResult } = require("express-validator");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'none'; " +
    "img-src 'self' data:; " +
    "style-src 'self' 'unsafe-inline'; " + 
    "frame-ancestors 'none'; " +
    "upgrade-insecure-requests"
  );
  next();
});

// MySQL Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "y9451216A123!@#",              // Replace with MySQL password
  database: "mydb",          // Replace with database name
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
    return;
  }
  console.log("Connected to the MySQL database.");
});

// Multer Configuration for File Uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /jpg|jpeg|png|gif/;
    const extname = allowedExtensions.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpg/gif/png) are allowed!"));
    }
  },
});

// Serve Static Files
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));


// Categories Endpoints
app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories", (err, results) => {
    if (err) return next(err);
    res.json(results);
  });
});

app.post(
  "/categories",
  [
    body("name")
      .isLength({ min: 2, max: 100 })
      .withMessage("Category name must be between 2 and 100 characters.")
      .trim()
      .escape()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;

    const sql = "INSERT INTO categories (name) VALUES (?)";
    db.query(sql, [name], (err, result) => {
      if (err) {
        console.error("Database error while adding category:", err);
        return res.status(500).json({ error: "Error adding category to the database." });
      }

      res.json({
        message: "Category added successfully",
        categoryId: result.insertId
      });
    });
  }
);

app.put(
  "/categories/:catid",
  [
    param("catid").isInt({ gt: 0 }).withMessage("Invalid Category ID"),
    body("name")
      .isLength({ min: 2, max: 100 })
      .withMessage("Category name must be 2–100 characters")
      .trim()
      .escape(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const catid = parseInt(req.params.catid);
    const { name } = req.body;

    const sql = "UPDATE categories SET name = ? WHERE catid = ?";
    db.query(sql, [name, catid], (err, result) => {
      if (err) {
        console.error("Error updating category:", err);
        return res.status(500).json({ error: "Error updating category" });
      }
      res.json({ message: "Category updated successfully" });
    });
  }
);

app.delete(
  "/categories/:catid",
  [param("catid").isInt({ gt: 0 }).withMessage("Invalid Category ID")],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const catid = parseInt(req.params.catid);
    const sql = "DELETE FROM categories WHERE catid = ?";
    db.query(sql, [catid], (err, result) => {
      if (err) {
        console.error("Error deleting category:", err);
        return res.status(500).json({ error: "Error deleting category." });
      }
      res.json({ message: "Category deleted successfully" });
    });
  }
);

// Products Endpoints

app.post(
  "/products",
  upload.single("image"),
  [
    body("catid").isInt({ gt: 0 }).withMessage("Invalid Category ID"),
    body("name").isLength({ min: 3, max: 100 }).trim().escape(),
    body("price").isFloat({ gt: 0 }).withMessage("Price must be positive"),
    body("description").isLength({ min: 5, max: 500 }).trim().escape()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { catid, name, price, description } = req.body;
    const image = req.file ? `uploads/${req.file.filename}` : null;
    const thumbnail = req.file ? `uploads/thumbnail-${req.file.filename}.jpg` : null;

    if (!image) {
      return res.status(400).json({ error: "Product image is required." });
    }

    try {
      await sharp(req.file.path)
        .resize(200, 200, { fit: 'inside' })
        .toFile(thumbnail);
    } catch (resizeError) {
      return res.status(500).json({ error: "Error processing image." });
    }

    db.query(
      "INSERT INTO products (catid, name, price, description, image_path, thumbnail_path) VALUES (?, ?, ?, ?, ?, ?)",
      [catid, name, price, description, image, thumbnail],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Database error." });
        res.json({ message: "Product added successfully!", productId: result.insertId });
      }
    );
  }
);

// GET /products - Retrieve products or details for a single product if pid is provided
app.get("/products", (req, res) => {
  if (req.query.pid) {
    const pid = parseInt(req.query.pid);
    db.query("SELECT * FROM products WHERE pid = ?", [pid], (err, results) => {
      if (err) {
        console.error("Error retrieving product:", err);
        return res.status(500).json({ error: "Error retrieving product" });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(results[0]);
    });
  } else {
    let catid = parseInt(req.query.catid);
    let query = "SELECT * FROM products";
    let params = [];

    if (catid) {
      query += " WHERE catid = ?";
      params.push(catid);
    }

    db.query(query, params, (err, results) => {
      if (err) {
        console.error("Error retrieving products:", err);
        return res.status(500).json({ error: "Error retrieving products" });
      }
      res.json(results);
    });
  }
});

app.put(
  "/products/:pid",
  [
    param("pid").isInt({ gt: 0 }).withMessage("Invalid Product ID"),
    body("catid").isInt({ gt: 0 }).withMessage("Category ID must be a positive number"),
    body("name").isLength({ min: 3, max: 100 }).withMessage("Name must be 3–100 characters").trim().escape(),
    body("price").isFloat({ gt: 0 }).withMessage("Price must be a positive number"),
    body("description").isLength({ min: 5, max: 500 }).withMessage("Description must be 5–500 characters").trim().escape(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const pid = parseInt(req.params.pid);
    const { catid, name, price, description } = req.body;

    const sql = "UPDATE products SET catid = ?, name = ?, price = ?, description = ? WHERE pid = ?";
    db.query(sql, [catid, name, price, description, pid], (err, result) => {
      if (err) {
        console.error("Error updating product:", err);
        return res.status(500).json({ error: "Error updating product" });
      }
      res.json({ message: "Product updated successfully" });
    });
  }
);

app.delete(
  "/products/:pid",
  [
    param("pid")
      .isInt({ gt: 0 })
      .withMessage("Product ID must be a positive integer")
      .toInt()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const pid = req.params.pid;

    const sql = "DELETE FROM products WHERE pid = ?";
    db.query(sql, [pid], (err, result) => {
      if (err) {
        console.error("Error deleting product:", err);
        return res.status(500).json({ error: "Error deleting product" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({ message: "Product deleted successfully" });
    });
  }
);

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

// Serve the Homepage - List All Products in a Table (for testing purposes)
app.get("/", (req, res) => {
  db.query("SELECT * FROM products", (err, products) => {
    if (err) {
      res.status(500).send("Error retrieving data from the database.");
      return;
    }

    // Generate HTML to display the products data
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Product List</title>
        <style>
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 18px;
            text-align: left;
          }
          table th, table td {
            padding: 12px;
            border: 1px solid #ddd;
          }
          table th {
            background-color: #f2f2f2;
          }
          img {
            max-width: 100px;
            height: auto;
          }
        </style>
      </head>
      <body>
        <h1>Products Table</h1>
        <table>
          <thead>
            <tr>
              <th>Product ID</th>
              <th>Category ID</th>
              <th>Name</th>
              <th>Price</th>
              <th>Description</th>
              <th>Image</th>
            </tr>
          </thead>
          <tbody>
    `;

    products.forEach((product) => {
      html += `
        <tr>
          <td>${product.pid}</td>
          <td>${product.catid}</td>
          <td>${escapeHTML(product.name)}</td>
          <td>${product.price}</td>
          <td>${escapeHTML(product.description)}</td>
          <td><img src="/${escapeHTML(product.thumbnail_path)}" alt="${escapeHTML(product.name)}"></td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// Global fallback error handler
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err.stack);
  res.status(500).json({
    error: "Something went wrong. Please try again later."
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
});

const helmet = require("helmet");
app.use(helmet());
