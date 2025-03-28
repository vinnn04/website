"use strict";

// Set API base URL to your EC2 instance running Node on port 3000
const API_BASE_URL = "http://52.65.170.10:3000";

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getCsrfToken() {
  return document.cookie
    .split("; ")
    .find(row => row.startsWith("csrfToken="))
    ?.split("=")[1] || "";
}

function updateQueryStringParameter(uri, key, value) {
  const re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  const separator = uri.indexOf('?') !== -1 ? "&" : "?";
  return uri.match(re)
    ? uri.replace(re, '$1' + key + "=" + value + '$2')
    : uri + separator + key + "=" + value;
}

class CartItem {
  constructor(id, name, price, quantity) {
    this.id = id;
    this.name = name;
    this.price = price;
    this.quantity = quantity;
  }
}

class Cart {
  constructor() {
    this.items = [];
  }

  addItem(id, name, price, quantity) {
    const existingItem = this.items.find(item => item.id === id);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.items.push(new CartItem(id, name, price, quantity));
    }
    this.save();
    this.updateDisplay();
  }

  updateItemQuantity(id, quantity) {
    quantity = parseInt(quantity, 10);
    if (isNaN(quantity) || quantity < 1) {
      alert("Quantity must be a positive number!");
      return;
    }
    const item = this.items.find(item => item.id === id);
    if (item) {
      item.quantity = quantity;
      this.save();
      this.updateDisplay();
    }
  }

  incrementItem(id) {
    const item = this.items.find(item => item.id === id);
    if (item) {
      item.quantity++;
      this.save();
      this.updateDisplay();
    }
  }

  decrementItem(id) {
    const item = this.items.find(item => item.id === id);
    if (item) {
      if (item.quantity > 1) {
        item.quantity--;
      } else {
        this.removeItem(id);
        return;
      }
      this.save();
      this.updateDisplay();
    }
  }

  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.save();
    this.updateDisplay();
  }

  getTotal() {
    return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  save() {
    const minimalList = this.items.map(item => ({
      id: item.id,
      quantity: item.quantity
    }));
    localStorage.setItem("shoppingList", JSON.stringify(minimalList));
  }

  load() {
    const storedList = localStorage.getItem("shoppingList");
    if (storedList) {
      const minimalList = JSON.parse(storedList);
  
      // If no items, just clear cart
      if (!minimalList.length) {
        this.items = [];
        this.updateDisplay();
        return;
      }
  
      Promise.allSettled(
        minimalList.map(item =>
          fetch(API_BASE_URL + `/products?pid=${item.id}`)
            .then(response => {
              if (!response.ok) throw new Error("Failed to fetch product details");
              return response.json();
            })
            .then(product => {
              if (!product || !product.pid || !product.name || isNaN(parseFloat(product.price))) {
                throw new Error("Invalid product data");
              }
              return new CartItem(
                parseInt(product.pid, 10),
                product.name,
                parseFloat(product.price),
                item.quantity
              );
            })
        )
      ).then(results => {
        this.items = results
          .filter(result => result.status === "fulfilled")
          .map(result => result.value);
        this.updateDisplay();
      });
    } else {
      this.items = [];
      this.updateDisplay();
    }
  }

  updateDisplay() {
    const shoppingListItems = document.getElementById("shopping-list-items");
    const shoppingListTotal = document.getElementById("shopping-list-total");
    const shoppingListHeader = document.querySelector(".shopping-list-header");

    if (shoppingListItems) {
      shoppingListItems.innerHTML = "";
    }
    let total = 0;
    this.items.forEach(item => {
      total += item.price * item.quantity;
      const listItem = document.createElement("li");
      listItem.id = `cart-item-${item.id}`;
      listItem.innerHTML = `
        <span class="item-name">${escapeHTML(item.name)}</span> - $<span class="unit-price">${item.price.toFixed(2)}</span> each<br>
        <div class="quantity-controls">
          <button class="decrement">-</button>
          <input type="number" id="item-qty-${item.id}" value="${item.quantity}" min="1">
          <button class="increment">+</button>
          <button class="remove">Delete</button>
        </div>
        <div class="item-total">Total: $<span>${(item.price * item.quantity).toFixed(2)}</span></div>
      `;
      if (shoppingListItems) shoppingListItems.appendChild(listItem);
    });

    if (shoppingListTotal) {
      shoppingListTotal.textContent = total.toFixed(2);
    }
    if (shoppingListHeader) {
      shoppingListHeader.textContent = `Shopping List - $${total.toFixed(2)}`;
    }

    // Attach event listeners to quantity controls
    this.items.forEach(item => {
      const decrementBtn = document.querySelector(`#cart-item-${item.id} .decrement`);
      const incrementBtn = document.querySelector(`#cart-item-${item.id} .increment`);
      const removeBtn = document.querySelector(`#cart-item-${item.id} .remove`);
      const qtyInput = document.querySelector(`#cart-item-${item.id} input[type="number"]`);

      if (decrementBtn) {
        decrementBtn.addEventListener("click", () => this.decrementItem(item.id));
      }
      if (incrementBtn) {
        incrementBtn.addEventListener("click", () => this.incrementItem(item.id));
      }
      if (removeBtn) {
        removeBtn.addEventListener("click", () => this.removeItem(item.id));
      }
      if (qtyInput) {
        qtyInput.addEventListener("change", (e) => {
          const value = parseInt(e.target.value, 10);
          if (isNaN(value) || value < 1) {
            e.target.value = item.quantity; // Reset to previous valid value
            alert("Please enter a valid quantity (1 or more).");
          } else {
            this.updateItemQuantity(item.id, value);
          }
        });
      }
    });
  }

  checkout() {
    if (this.items.length === 0) {
      alert("Your shopping list is empty. Please add items to proceed.");
    } else {
      let message = "You are about to checkout the following items:\n\n";
      this.items.forEach(item => {
        message += `${item.name} - Quantity: ${item.quantity} - Price: $${(item.price * item.quantity).toFixed(2)}\n`;
      });
      message += `\nTotal: $${this.getTotal().toFixed(2)}`;
      alert(message);
      this.items = [];
      this.save();
      this.updateDisplay();
    }
  }
}

const shoppingCart = new Cart();
window.shoppingCart = shoppingCart;

function fetchCategories() {
  fetch(API_BASE_URL + '/categories')
    .then(response => {
      if (!response.ok) throw new Error("Failed to retrieve categories");
      return response.json();
    })
    .then(data => {
      const categoryList = document.getElementById("category-list");
      if (categoryList) {
        categoryList.innerHTML = "";
        data.forEach(category => {
          const li = document.createElement("li");
          const link = document.createElement("a");
          link.href = `/website.html?catid=${category.catid}`;
          link.textContent = escapeHTML(category.name);
          li.appendChild(link);
          categoryList.appendChild(li);
        });
      }
    })
    .catch(error => console.error("Error fetching categories:", error));
}

function fetchProducts() {
  const urlParams = new URLSearchParams(window.location.search);
  const catid = urlParams.get("catid");
  let url = API_BASE_URL + "/products";
  if (catid) {
    url += `?catid=${encodeURIComponent(catid)}`;
  }
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Failed to retrieve products");
      return response.json();
    })
    .then(data => {
      const dynamicContent = document.getElementById("dynamic-content");
      if (dynamicContent) {
        dynamicContent.innerHTML = `<h2>Our Products</h2>`;
        const productList = document.createElement("div");
        productList.className = "product-list";
  
        if (data.length === 0) {
          productList.textContent = "No products found.";
        } else {
          data.forEach((product) => {
            const imagePath = escapeHTML(product.thumbnail_path || product.image_path || `images/product${product.pid}.jpg`);
            const productName = escapeHTML(product.name);
            const description = escapeHTML(product.description);
  
            const item = document.createElement("div");
            item.className = "product-item";
  
            const productLink = document.createElement("a");
            productLink.href = `/product.html?pid=${product.pid}`;
            productLink.innerHTML = `
              <img src="${imagePath}" alt="${productName}" />
              <h3>${productName}</h3>
              <p class="price">$${product.price}</p>
            `;
            item.appendChild(productLink);
  
            const shopDiv = document.createElement("div");
            shopDiv.className = "shop";
            shopDiv.innerHTML = `
              <label for="quantity${product.pid}">Quantity:</label>
              <input type="number" id="quantity${product.pid}" min="1" value="1" />
              <button class="add-to-cart"
                data-id="${product.pid}"
                data-name="${productName}"
                data-price="${product.price}"
                data-quantity-id="quantity${product.pid}">
                Add to Cart
              </button>
            `;
            item.appendChild(shopDiv);
  
            shopDiv.querySelector(".add-to-cart").addEventListener("click", function () {
              const id = parseInt(this.dataset.id, 10);
              const name = this.dataset.name;
              const price = parseFloat(this.dataset.price);
              const quantityInputId = this.dataset.quantityId;
              addProductToCart(id, name, price, quantityInputId);
            });
  
            productList.appendChild(item);
          });
        }
  
        dynamicContent.appendChild(productList);
      }
    })
    .catch(error => {
      console.error("Error fetching products:", error);
    });
}

function addProductToCart(id, name, price, quantityInputId) {
  const quantityInput = document.getElementById(quantityInputId);
  let quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 1) {
    alert("Invalid quantity");
    return;
  }

  shoppingCart.addItem(id, name, price, quantity);
}

function fetchProductDetails(pid) {
  fetch(API_BASE_URL + `/products?pid=${pid}`)
    .then(response => {
      if (!response.ok) throw new Error("Failed to retrieve product details");
      return response.json();
    })
    .then(product => {
      const dynamicContent = document.getElementById("dynamic-content");
      let imagePath;
      if (product.image_path) {
        imagePath = '/' + escapeHTML(product.image_path);
      } else {
        imagePath = `/images/product${product.pid}.jpg`;
      }
      const productName = escapeHTML(product.name);
      const description = escapeHTML(product.description);
  
      if (dynamicContent) {
        dynamicContent.innerHTML = `
          <h2>${productName}</h2>
          <div class="product-details">
            <img src="${imagePath}" alt="${productName}" />
            <div class="product-info">
              <p class="description">${description}</p>
              <p class="price">$${product.price}</p>
              <div class="shop">
                <label for="quantity${product.pid}">Quantity:</label>
                <input type="number" id="quantity${product.pid}" min="1" value="1">
                <button class="add-to-cart"
                  data-id="${product.pid}"
                  data-name="${productName}"
                  data-price="${product.price}"
                  data-quantity-id="quantity${product.pid}">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        `;
        dynamicContent.querySelector(".add-to-cart").addEventListener("click", function () {
          const id = parseInt(this.dataset.id, 10);
          const name = this.dataset.name;
          const price = parseFloat(this.dataset.price);
          const quantityInputId = this.dataset.quantityId;
          addProductToCart(id, name, price, quantityInputId);
        });
      }
    })
    .catch(error => {
      console.error("Error fetching product details:", error);
      const dynamicContent = document.getElementById("dynamic-content");
      if (dynamicContent) {
        dynamicContent.innerHTML = "<p>Product details not available at the moment.</p>";
      }
    });
}

document.addEventListener("DOMContentLoaded", () => {
  // Restore shopping cart from localStorage
  shoppingCart.load();

  fetchCategories();
  
  // --- LOGIN PAGE ---
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
    
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const csrfToken = getCsrfToken();
    
      try {
        const response = await fetch(API_BASE_URL + "/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
          },
          body: JSON.stringify({ email, password })
        });
    
        const data = await response.json();
        if (response.ok) {
          window.location.href = data.redirect;
        } else {
          document.getElementById("error").textContent = data.error;
        }
      } catch (err) {
        document.getElementById("error").textContent = "An error occurred. Please try again.";
      }
    });
  }
  
  const changePasswordForm = document.getElementById("changePasswordForm");
  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async function (e) {
      e.preventDefault();
    
      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const messageDiv = document.getElementById("message");
    
      try {
        const response = await fetch(API_BASE_URL + "/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": getCsrfToken()
          },
          credentials: "include",
          body: JSON.stringify({ currentPassword, newPassword })
        });
    
        const data = await response.json();
        if (response.ok) {
          messageDiv.textContent = data.message;
          messageDiv.className = "message success";
          setTimeout(() => {
            window.location.href = "/login.html";
          }, 2000);
        } else {
          messageDiv.textContent = data.error;
          messageDiv.className = "message error";
        }
      } catch (err) {
        messageDiv.textContent = "An error occurred. Please try again.";
        messageDiv.className = "message error";
      }
    });
  }
  
  const userInfo = document.getElementById("user-info");
  const loginLink = document.getElementById("login-link");
  const logoutLink = document.getElementById("logout-link");
  const changePasswordLink = document.getElementById("change-password-link");
  
  fetch(API_BASE_URL + "/profile", { credentials: "include" })
    .then(res => {
      if (!res.ok) throw new Error("Not logged in");
      return res.json();
    })
    .then(data => {
      if (data.email && data.email !== "guest") {
        const role = data.admin ? "admin" : "user";
        if (userInfo) userInfo.textContent = "Logged in as: " + role;
        if (logoutLink) logoutLink.style.display = "inline-block";
        if (changePasswordLink) changePasswordLink.style.display = "inline-block";
        if (loginLink) loginLink.style.display = "none";
      } else {
        if (userInfo) userInfo.textContent = "Logged in as: guest";
        if (logoutLink) logoutLink.style.display = "none";
        if (changePasswordLink) changePasswordLink.style.display = "none";
        if (loginLink) loginLink.style.display = "inline-block";
      }
    })
    .catch(() => {
      if (userInfo) userInfo.textContent = "Logged in as: guest";
      if (logoutLink) logoutLink.style.display = "none";
      if (changePasswordLink) changePasswordLink.style.display = "none";
      if (loginLink) loginLink.style.display = "inline-block";
    });
  
  const categoriesTableBody = document.getElementById("categoriesTableBody");
  const productsTableBody = document.getElementById("productsTableBody");
  if (categoriesTableBody && productsTableBody) {
    async function loadCategories() {
      try {
        const res = await fetch(API_BASE_URL + "/categories");
        const categories = await res.json();
    
        const categoryBody = document.getElementById("categoriesTableBody");
        const categorySelect = document.getElementById("catid");
        categoryBody.innerHTML = "";
        categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
    
        categories.forEach(cat => {
          // Escape any single quotes in the category name for safety.
          const safeName = cat.name.replace(/'/g, "\\'");
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${cat.catid}</td>
            <td>${cat.name}</td>
            <td>
              <button class="edit-category" data-catid="${cat.catid}" data-catname="${safeName}">Edit</button>
              <button class="delete-category" data-catid="${cat.catid}">Delete</button>
            </td>
          `;
          categoryBody.appendChild(row);
    
          const option = document.createElement("option");
          option.value = cat.catid;
          option.textContent = cat.name;
          categorySelect.appendChild(option);
        });
      } catch (err) {
        console.error("Failed to load categories:", err);
        alert("Failed to load categories.");
      }
    }
    
    async function loadProducts() {
      try {
        const res = await fetch(API_BASE_URL + "/products");
        const products = await res.json();
    
        const productBody = document.getElementById("productsTableBody");
        productBody.innerHTML = "";
    
        products.forEach(prod => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${prod.pid}</td>
            <td>${prod.catid}</td>
            <td>${prod.name}</td>
            <td>$${parseFloat(prod.price).toFixed(2)}</td>
            <td>${prod.description}</td>
            <td>
              <button class="edit-product" data-pid="${prod.pid}">Edit</button>
              <button class="delete-product" data-pid="${prod.pid}">Delete</button>
            </td>
          `;
          productBody.appendChild(row);
        });
      } catch (err) {
        console.error("Failed to load products:", err);
        alert("Failed to load products.");
      }
    }
    
    async function handleAddCategory(e) {
      e.preventDefault();
      const name = document.getElementById("categoryName").value.trim();
      if (!name) return alert("Please enter a category name.");
    
      try {
        const res = await fetch(API_BASE_URL + "/categories", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": getCsrfToken()
          },
          body: JSON.stringify({ name })
        });
    
        const data = await res.json();
        if (res.ok) {
          alert("Category added!");
          document.getElementById("categoryName").value = "";
          loadCategories();
        } else {
          alert("Error: " + (data.error || JSON.stringify(data)));
        }
      } catch (err) {
        console.error("Add category error:", err);
      }
    }
    
    async function editCategory(catid, currentName) {
      const newName = prompt("Enter new category name:", currentName);
      if (!newName) return;
    
      try {
        const res = await fetch(API_BASE_URL + `/categories/${catid}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": getCsrfToken()
          },
          body: JSON.stringify({ name: newName.trim() })
        });
    
        const data = await res.json();
        if (res.ok) {
          alert("Category updated.");
          loadCategories();
        } else {
          alert("Update failed: " + (data.error || JSON.stringify(data)));
        }
      } catch (err) {
        console.error("Update error:", err);
      }
    }
    
    async function deleteCategory(catid) {
      if (!confirm("Delete this category?")) return;
    
      try {
        const res = await fetch(API_BASE_URL + `/categories/${catid}`, {
          method: "DELETE",
          headers: {
            "X-CSRF-Token": getCsrfToken()
          }
        });
    
        const data = await res.json();
        if (res.ok) {
          alert("Category deleted.");
          loadCategories();
        } else {
          alert("Delete failed: " + (data.error || JSON.stringify(data)));
        }
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
    
    async function editProduct(pid) {
      const name = prompt("Enter new name:");
      const price = parseFloat(prompt("Enter new price:"));
      const description = prompt("Enter new description:");
      const catid = parseInt(prompt("Enter new category ID:"), 10);
    
      if (!name || isNaN(price) || !description || isNaN(catid)) {
        return alert("Invalid input.");
      }
    
      try {
        const res = await fetch(API_BASE_URL + `/products/${pid}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": getCsrfToken()
          },
          body: JSON.stringify({ name, price, description, catid })
        });
        const data = await res.json();
        if (res.ok) {
          alert("Product updated.");
          loadProducts();
        } else {
          alert("Update failed: " + (data.error || JSON.stringify(data)));
        }
      } catch (err) {
        console.error("Update error:", err);
      }
    }
    
    async function deleteProduct(pid) {
      if (!confirm("Delete this product?")) return;
    
      try {
        const res = await fetch(API_BASE_URL + `/products/${pid}`, {
          method: "DELETE",
          headers: { "X-CSRF-Token": getCsrfToken() }
        });
        const data = await res.json();
        if (res.ok) {
          alert("Product deleted.");
          loadProducts();
        } else {
          alert("Delete failed: " + (data.error || JSON.stringify(data)));
        }
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
    
    // Attach event listener for adding a new category.
    const categoryForm = document.getElementById("categoryForm");
    if (categoryForm) {
      categoryForm.addEventListener("submit", handleAddCategory);
    }
    
    // If a product form exists, append a hidden CSRF token field.
    const productForm = document.getElementById("productForm");
    if (productForm) {
      const csrf = document.createElement("input");
      csrf.type = "hidden";
      csrf.name = "csrfToken";
      csrf.value = getCsrfToken();
      productForm.appendChild(csrf);
    }
    
    // Load initial data for admin page.
    loadCategories();
    loadProducts();
  }
  
  // --- General: Load products or product details on public pages ---
  const urlParams = new URLSearchParams(window.location.search);
  const pid = parseInt(urlParams.get('pid'), 10);
  if (!isNaN(pid)) {
    fetchProductDetails(pid);
  } else {
    fetchProducts();
  }
  
  // --- Attach checkout action for shopping list ---
  const btn = document.getElementById("checkout-button");
  if (btn) {
    btn.addEventListener("click", () => {
      shoppingCart.checkout();
    });
  }
  
  // --- Logout Button Logic ---
  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(API_BASE_URL + "/logout", {
          method: "GET",
          credentials: "include"
        });
        if (res.ok) {
          window.location.href = "/website.html";
        } else {
          alert("Logout failed.");
        }
      } catch (err) {
        console.error("Logout error:", err);
        alert("An error occurred during logout.");
      }
    });
  }
});

// Add event delegation for administrator category and product buttons
document.addEventListener("click", function(e) {
  if (e.target.classList.contains("edit-category")) {
    const catid = e.target.getAttribute("data-catid");
    const catname = e.target.getAttribute("data-catname");
    editCategory(catid, catname);
  }
  if (e.target.classList.contains("delete-category")) {
    const catid = e.target.getAttribute("data-catid");
    deleteCategory(catid);
  }
  if (e.target.classList.contains("edit-product")) {
    const pid = e.target.getAttribute("data-pid");
    editProduct(pid);
  }
  if (e.target.classList.contains("delete-product")) {
    const pid = e.target.getAttribute("data-pid");
    deleteProduct(pid);
  }
});

// Expose checkout globally for inline usage.
window.checkout = () => shoppingCart.checkout();