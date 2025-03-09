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
  database: "mydb", // Replace with your database name
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

// Serve Static Files (e.g., Forms, Uploaded Files)
app.use(express.static("public")); // Serves HTML forms from the `public` folder
app.use("/uploads", express.static("uploads")); // Serves uploaded images

// ------------------ Backend APIs ------------------ //

// Get Categories (for the main page)
app.get("/categories", (req, res) => {
    db.query("SELECT * FROM categories", (err, results) => {
      if (err) {
        res.status(500).json({ error: "Error retrieving categories" });
        return;
      }
      res.json(results);
    });
  });

// Add a New Category
app.post("/categories", (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Category name is required" });
    return;
  }
  db.query("INSERT INTO categories (name) VALUES (?)", [name], (err, result) => {
    if (err) {
      res.status(500).json({ error: "Error adding category" });
      return;
    }
    res.json({ message: "Category added successfully", categoryId: result.insertId });
  });
});

// Add a New Product
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
  
    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
  
    if (req.file) {
        // Resize image to create a thumbnail
        await sharp(req.file.path)
          .resize(200, 200) // Resize to 200x200 pixels
          .toFile(thumbnail);
      }
    
    // Insert Data into the Database
    db.query(
      "INSERT INTO products (catid, name, price, description, image_path) VALUES (?, ?, ?, ?, ?)",
      [catid, name, price, description, image],
      (err, result) => {
        if (err) {
          console.error("Database Error:", err);
          return res.status(500).json({ error: "Error adding product to the database." });
        }
        res.json({ message: "Product added successfully!", productId: result.insertId });
      }
    );
  });

// Get Product Details by pid
app.get("/product/:pid", (req, res) => {
    const { pid } = req.params;
    db.query("SELECT * FROM products WHERE pid = ?", [pid], (err, results) => {
      if (err) {
        res.status(500).json({ error: "Error retrieving product details" });
        return;
      }
      if (results.length === 0) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(results[0]);
    });
  });

// Serve the Homepage (List All Products in a Table)
app.get("/", (req, res) => {
  db.query("SELECT * FROM products", (err, products) => {
    if (err) {
      res.status(500).send("Error retrieving data from the database.");
      return;
    }

    // Generate HTML to display the data
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
          <td><img src="/${product.image_path}" alt="${product.name}"></td>
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