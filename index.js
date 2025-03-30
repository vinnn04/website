"use strict";
var express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const { body, param, validationResult } = require("express-validator");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const helmet = require("helmet");
const bcrypt = require("bcrypt");

var app = express();

const SESSION_DURATION = 24 * 60 * 60 * 1000;

const sessions = {};

app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'website.html'));
});

// CSRF token middleware
app.use((req, res, next) => {
  if (!req.cookies.csrfToken) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("csrfToken", token, {
      httpOnly: false,
      sameSite: "Strict",
      secure: true
    });
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies.csrfToken;
  }
  next();
});

// Content Security Policy middleware
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

function verifyCsrfToken(req, res, next) {
  const tokenFromCookie = req.cookies.csrfToken;
  const tokenFromBody = req.body.csrfToken || req.headers["x-csrf-token"];

  // Check for CSRF token existence and match
  if (!tokenFromCookie || !tokenFromBody || tokenFromCookie !== tokenFromBody) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  // Allow requests only from valid origins
  const origin = req.get("Origin") || req.get("Referer");
  // List the allowed origins (update these as needed)
  const allowedOrigins = [
    "http://localhost:3000",
    "https://s09.ierg4210.ie.cuhk.edu.hk"
  ];

  if (origin && !allowedOrigins.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: "Blocked by CSRF origin check" });
  }
  
  next();
}

// Authentication middleware
function requireAuth(req, res, next) {
  const token = req.cookies.authToken;
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = sessions[token];
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.admin) {
      return res.status(403).json({ error: "Forbidden: Admins only" });
    }
    next();
  });
}

// MySQL Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "y9451216A123!@#", // Replace with actual password
  database: "mydb"           // Replace with your actual database name
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

// Utility: Escape HTML
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

app.post("/login", verifyCsrfToken, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.error("Database error in login:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const user = results[0];
    try {
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
      // Convert admin field if it is a Buffer (common for BIT(1) fields)
      let isAdmin;
      if (Buffer.isBuffer(user.admin)) {
        // If admin is a Buffer, its first byte holds the truthy value (1 or 0)
        isAdmin = Boolean(user.admin[0]);
      } else {
        // Otherwise (if it is a number/string), compare it appropriately
        isAdmin = Boolean(Number(user.admin));
      }
      // Successful login: rotate session token to prevent session fixation
      const token = crypto.randomBytes(32).toString("hex");
      sessions[token] = {
        userid: user.userid,
        email: user.email,
        admin: isAdmin,
        createdAt: Date.now()
      };

      // Set authToken cookie with HttpOnly and Secure flags, plus expiration time
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: true, // Set to true in production when using HTTPS
        expires: new Date(Date.now() + SESSION_DURATION)
      });

      // Redirect based on role
      if (isAdmin) {
        res.json({ message: "Login successful", redirect: "/admin.html" });
      } else {
        res.json({ message: "Login successful", redirect: "/website.html" });
      }
    } catch (bcryptErr) {
      console.error("Error comparing passwords:", bcryptErr);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /logout - clear authentication token and cookie
app.get("/logout", (req, res) => {
  const token = req.cookies.authToken;
  if (token && sessions[token]) {
    delete sessions[token];
  }
  res.clearCookie("authToken");
  res.json({ message: "Logged out successfully" });
});

app.get("/profile", (req, res) => {
  const token = req.cookies.authToken;
  const session = sessions[token];

  if (
    token &&
    session &&
    Date.now() - session.createdAt < SESSION_DURATION
  ) {
    return res.json({
      email: session.email,
      admin: session.admin
    });
  } else {
    if (token) {
      delete sessions[token];
      res.clearCookie("authToken");
    }
    return res.status(401).json({
      email: "guest",
      admin: false
    });
  }
});

app.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new password are required." });
  }
  const token = req.cookies.authToken;
  const userSession = sessions[token];

  db.query("SELECT * FROM users WHERE userid = ?", [userSession.userid], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(500).json({ error: "User not found." });
    }
    const user = results[0];
    try {
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(401).json({ error: "Current password is incorrect." });
      }
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.query("UPDATE users SET password = ? WHERE userid = ?", [hashedPassword, user.userid], (updateErr, updateResult) => {
        if (updateErr) {
          return res.status(500).json({ error: "Failed to update password." });
        }
        // Log out the user after the password has been changed
        delete sessions[token];
        res.clearCookie("authToken");
        res.json({ message: "Password updated successfully, please login again." });
      });
    } catch (hashErr) {
      return res.status(500).json({ error: "Internal server error." });
    }
  });
});

app.get("/categories", (req, res, next) => {
  db.query("SELECT * FROM categories", (err, results) => {
    if (err) return next(err);
    res.json(results);
  });
});

app.post(
  "/categories",
  requireAdmin,
  verifyCsrfToken,
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
  requireAdmin,
  verifyCsrfToken,
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
  requireAdmin,
  verifyCsrfToken,
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

// Admin-protected endpoints for managing products.
app.post(
  "/products",
  requireAdmin,
  verifyCsrfToken,
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

app.put(
  "/products/:pid",
  requireAdmin,
  verifyCsrfToken,
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
  requireAdmin,
  verifyCsrfToken,
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

// Global fallback error handler
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err.stack);
  res.status(500).json({
    error: "Something went wrong. Please try again later."
  });
});


