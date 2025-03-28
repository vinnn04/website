function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
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
      Promise.all(
        minimalList.map(item =>
          fetch(`/products?pid=${item.id}`)
            .then(response => {
              if (!response.ok) throw new Error("Failed to fetch product details");
              return response.json();
            })
            .then(product => new CartItem(product.pid, product.name, product.price, item.quantity))
        )
      )
      .then(fullItems => {
        this.items = fullItems;
        this.updateDisplay();
      })
      .catch(error => console.error("Error loading shopping cart:", error));
    } else {
      this.updateDisplay();
    }
  }

  updateDisplay() {
    const shoppingListItems = document.getElementById("shopping-list-items");
    const shoppingListTotal = document.getElementById("shopping-list-total");
    const shoppingListHeader = document.querySelector(".shopping-list-header");
    shoppingListItems.innerHTML = "";
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
      shoppingListItems.appendChild(listItem);
    });

    shoppingListTotal.textContent = total.toFixed(2);
    shoppingListHeader.textContent = `Shopping List - $${total.toFixed(2)}`;
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

function addProductToCart(id, name, price, quantityInputId) {
  const quantityInput = document.getElementById(quantityInputId);
  const quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 1) {
    alert("Please enter a valid quantity!");
    return;
  }
  shoppingCart.addItem(id, name, price, quantity);
}

function fetchCategories() {
  fetch('/categories')
    .then(response => {
      if (!response.ok) throw new Error("Failed to retrieve categories");
      return response.json();
    })
    .then(data => {
      const categoryList = document.getElementById("category-list");
      categoryList.innerHTML = "";
      data.forEach(category => {
        const btn = document.createElement("button");
        btn.textContent = escapeHTML(category.name);
        btn.addEventListener("click", () => {
          window.location.href = `http://localhost:3000/category${category.catid}.html`;
        });
        categoryList.appendChild(btn);
      });
    })
    .catch(error => console.error("Error fetching categories:", error));
}

function fetchProducts() {
  const urlParams = new URLSearchParams(window.location.search);
  const catid = urlParams.get("catid");
  let url = "/products";
  if (catid) {
    url += `?catid=${encodeURIComponent(catid)}`;
  }

  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to retrieve products");
      return response.json();
    })
    .then((data) => {
      const dynamicContent = document.getElementById("dynamic-content");
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
          productLink.href = `product.html?pid=${product.pid}`;
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
    })
    .catch((error) => {
      console.error("Error fetching products:", error);
    });
}

function fetchProductDetails(pid) {
  fetch(`/products?pid=${pid}`)
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
    })
    .catch(error => {
      console.error("Error fetching product details:", error);
      const dynamicContent = document.getElementById("dynamic-content");
      dynamicContent.innerHTML = "<p>Product details not available at the moment.</p>";
    });
}

function getCsrfToken() {
  return document.cookie
    .split("; ")
    .find(row => row.startsWith("csrfToken="))
    ?.split("=")[1];
}

function updateQueryStringParameter(uri, key, value) {
  let re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  let separator = uri.indexOf('?') !== -1 ? "&" : "?";
  if (uri.match(re)) {
    return uri.replace(re, '$1' + key + "=" + value + '$2');
  } else {
    return uri + separator + key + "=" + value;
  }
}

// Load cart and fetch initial data
shoppingCart.load();

document.addEventListener("DOMContentLoaded", () => {
  const userInfo = document.getElementById("user-info");
  const loginLink = document.getElementById("login-link");
  const logoutLink = document.getElementById("logout-link");
  const logoutButton = document.getElementById("logout-button");
  const changePasswordLink = document.getElementById("change-password-link");

  fetch("/profile", { credentials: "include" })
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

  fetchCategories();

  const urlParams = new URLSearchParams(window.location.search);
  const pid = parseInt(urlParams.get('pid'), 10);
  if (!isNaN(pid)) {
    fetchProductDetails(pid);
  } else {
    fetchProducts();
  }

  const btn = document.getElementById("checkout-button");
  if (btn) {
    btn.addEventListener("click", () => {
      checkout();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const res = await fetch("/logout", {
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

window.checkout = () => shoppingCart.checkout();