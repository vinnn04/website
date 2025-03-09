const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// MySQL Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "y9451216A123!@#", // Replace with your MySQL password
  database: "mydb",          // Replace with your database name
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
  dest: "uploads/", // Folder to store uploaded files
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
app.use(express.static("public")); // Serves HTML files from the `public` folder
app.use("/uploads", express.static("uploads")); // Serves uploaded images

// ------------------ Backend APIs ------------------ //

// Categories Endpoints

app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories", (err, results) => {
    if (err) {
      res.status(500).json({ error: "Error retrieving categories" });
      return;
    }
    res.json(results);
  });
});

app.post("/categories", (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Category name is required" });
  }
  db.query("INSERT INTO categories (name) VALUES (?)", [name], (err, result) => {
    if (err) {
      console.error("Database error while adding category:", err);
      return res.status(500).json({ error: "Error adding category: " + err.message });
    }
    res.json({ message: "Category added successfully", categoryId: result.insertId });
  });
});

app.put('/categories/:catid', (req, res) => {
  const catid = req.params.catid;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Category name is required." });
  }
  
  const sql = "UPDATE categories SET name = ? WHERE catid = ?";
  db.query(sql, [name, catid], (err, result) => {
    if (err) {
      console.error("Error updating category:", err);
      return res.status(500).json({ error: "Error updating category." });
    }
    res.json({ message: "Category updated successfully" });
  });
});

app.delete('/categories/:catid', (req, res) => {
  const catid = req.params.catid;
  const sql = "DELETE FROM categories WHERE catid = ?";
  db.query(sql, [catid], (err, result) => {
    if (err) {
      console.error("Error deleting category:", err);
      return res.status(500).json({ error: "Error deleting category." });
    }
    res.json({ message: "Category deleted successfully" });
  });
});

// Products Endpoints

// POST /products - Add a new product (with image upload)
// Now supporting image resizing and thumbnail generation.
app.post("/products", upload.single("image"), async (req, res) => {
  const { catid, name, price, description } = req.body;
  const image = req.file ? `uploads/${req.file.filename}` : null;
  const thumbnail = req.file ? `uploads/thumbnail-${req.file.filename}.jpg` : null;

  // Input Validation
  let errors = [];

  if (!catid || isNaN(catid) || parseInt(catid) < 1) {
    errors.push("Category ID must be a number greater than 0.");
  }

  if (!name || name.length < 3 || name.length > 100) {
    errors.push("Product name must be between 3 and 100 characters.");
  }

  if (!price || isNaN(price) || parseFloat(price) <= 0) {
    errors.push("Price must be a positive number.");
  }

  if (!description || description.length < 5 || description.length > 500) {
    errors.push("Description must be between 5 and 500 characters.");
  }

  if (!image) {
    errors.push("Product image is required.");
  }

  // Return validation errors if any
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (req.file) {
    try {
      // Create a smaller thumbnail image (e.g., 200x200 pixels).
      await sharp(req.file.path)
        .resize(200, 200, { fit: 'inside' })
        .toFile(thumbnail);
    } catch (resizeError) {
      console.error("Error resizing image:", resizeError);
      return res.status(500).json({ error: "Error processing image." });
    }
  }

  // Insert Data into the Database (make sure your products table has a thumbnail_path column)
  db.query(
    "INSERT INTO products (catid, name, price, description, image_path, thumbnail_path) VALUES (?, ?, ?, ?, ?, ?)",
    [catid, name, price, description, image, thumbnail],
    (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ error: "Error adding product to the database." });
      }
      res.json({ message: "Product added successfully!", productId: result.insertId });
    }
  );
});

// GET /products - Retrieve products or details for a single product if pid is provided.
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

// Update and Delete endpoints remain unchanged.
app.put('/products/:pid', (req, res) => {
  const pid = req.params.pid;
  const { catid, name, price, description } = req.body;

  if (!catid || !name || !price || !description) {
    return res.status(400).json({ error: "All fields (catid, name, price, description) are required." });
  }

  const sql = "UPDATE products SET catid = ?, name = ?, price = ?, description = ? WHERE pid = ?";
  db.query(sql, [catid, name, price, description, pid], (err, result) => {
    if (err) {
      console.error("Error updating product:", err);
      return res.status(500).json({ error: "Error updating product" });
    }
    res.json({ message: "Product updated successfully" });
  });
});

app.delete('/products/:pid', (req, res) => {
  const pid = req.params.pid;
  const sql = "DELETE FROM products WHERE pid = ?";
  db.query(sql, [pid], (err, result) => {
    if (err) {
      console.error("Error deleting product:", err);
      return res.status(500).json({ error: "Error deleting product" });
    }
    res.json({ message: "Product deleted successfully" });
  });
});

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
          <td>${product.name}</td>
          <td>${product.price}</td>
          <td>${product.description}</td>
          <td><img src="/${product.thumbnail_path}" alt="${product.name}"></td>
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

// ------------------ Start the Server ------------------ //
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
});