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

  // Add product to cart; if it exists, increment the quantity
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

  // Update item quantity to a specified value
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

  // Increment the item quantity by 1
  incrementItem(id) {
    const item = this.items.find(item => item.id === id);
    if (item) {
      item.quantity++;
      this.save();
      this.updateDisplay();
    }
  }

  // Decrement the item quantity by 1 (or remove the item if it reaches 0)
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

  // Remove an item from the cart
  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.save();
    this.updateDisplay();
  }

  // Calculate the total price of the cart
  getTotal() {
    return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  // Save minimal cart data (only id and quantity) to localStorage
  save() {
    const minimalList = this.items.map(item => ({
      id: item.id,
      quantity: item.quantity
    }));
    localStorage.setItem("shoppingList", JSON.stringify(minimalList));
  }

  // Load cart data from localStorage and fetch full product details
  load() {
    const storedList = localStorage.getItem("shoppingList");
    if (storedList) {
      const minimalList = JSON.parse(storedList);
      Promise.all(
        minimalList.map(item =>
          fetch(`/products?pid=${item.id}`)
            .then(response => {
              if (!response.ok) {
                throw new Error("Failed to fetch product details");
              }
              return response.json();
            })
            .then(product => {
              return new CartItem(product.pid, product.name, product.price, item.quantity);
            })
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

  // Update the shopping cart display in the UI
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
        <span class="item-name">${item.name}</span> - $<span class="unit-price">${item.price.toFixed(2)}</span> each<br>
        <div class="quantity-controls">
          <button onclick="shoppingCart.decrementItem(${item.id})">-</button>
          <input type="number" id="item-qty-${item.id}" value="${item.quantity}" min="1" onchange="shoppingCart.updateItemQuantity(${item.id}, this.value)">
          <button onclick="shoppingCart.incrementItem(${item.id})">+</button>
          <button onclick="shoppingCart.removeItem(${item.id})">Delete</button>
        </div>
        <div class="item-total">Total: $<span>${(item.price * item.quantity).toFixed(2)}</span></div>
      `;
      shoppingListItems.appendChild(listItem);
    });

    shoppingListTotal.textContent = total.toFixed(2);
    shoppingListHeader.textContent = `Shopping List - $${total.toFixed(2)}`;
  }

  // Clear the cart on checkout
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
        btn.textContent = category.name;
        btn.onclick = () => {
          window.location.href = `http://localhost:3000/category${category.catid}.html`;
        };
        categoryList.appendChild(btn);
      });
    })
    .catch(error => console.error("Error fetching categories:", error));
}

function fetchProducts() {
  const urlParams = new URLSearchParams(window.location.search);
  const catid = urlParams.get('catid');
  let url = '/products';
  if (catid) {
    url += '?catid=' + catid;
  }
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Failed to retrieve products");
      return response.json();
    })
    .then(data => {
      const dynamicContent = document.getElementById("dynamic-content");
      dynamicContent.innerHTML = `<h2>Our Products</h2>`;
      const productList = document.createElement("div");
      productList.className = "product-list";

      if (data.length === 0) {
        productList.textContent = "No products found for this category.";
      } else {
        data.forEach(product => {
          let imagePath = product.thumbnail_path
                          ? product.thumbnail_path
                          : (product.image_path || `images/product${product.pid}.jpg`);
          const item = document.createElement("div");
          item.className = "product-item";
          item.innerHTML = `
            <img src="${imagePath}" alt="${product.name}" onclick="window.location.href='website.html?pid=${product.pid}'">
            <h3 onclick="window.location.href='website.html?pid=${product.pid}'">${product.name}</h3>
            <p class="price">$${product.price}</p>
            <div class="shop">
              <label for="quantity${product.pid}">Quantity:</label>
              <input type="number" id="quantity${product.pid}" name="quantity${product.pid}" min="1" value="1">
              <button onclick="addProductToCart(${product.pid}, '${product.name}', ${product.price}, 'quantity${product.pid}')">
                Add to Cart
              </button>
            </div>
          `;
          productList.appendChild(item);
        });
      }
      dynamicContent.appendChild(productList);
    })
    .catch(error => console.error("Error fetching products:", error));
}

function fetchProductDetails(pid) {
  fetch(`/products?pid=${pid}`)
    .then(response => {
      if (!response.ok) throw new Error("Failed to retrieve product details");
      return response.json();
    })
    .then(product => {
      const dynamicContent = document.getElementById("dynamic-content");
      dynamicContent.innerHTML = `
        <h2>${product.name}</h2>
        <div class="product-details">
          <img src="${product.image_path}" alt="${product.name}" />
          <div class="product-info">
            <p class="description">${product.description}</p>
            <p class="price">$${product.price}</p>
            <div class="shop">
              <label for="quantity${product.pid}">Quantity:</label>
              <input type="number" id="quantity${product.pid}" name="quantity${product.pid}" min="1" value="1">
              <button onclick="addProductToCart(${product.pid}, '${product.name}', ${product.price}, 'quantity${product.pid}')">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .catch(error => {
      console.error("Error fetching product details:", error);
      const dynamicContent = document.getElementById("dynamic-content");
      dynamicContent.innerHTML = "<p>Product details not available at the moment.</p>";
    });
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

shoppingCart.load();

document.addEventListener("DOMContentLoaded", () => {
  fetchCategories();
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get('pid');
  if (pid) {
    fetchProductDetails(pid);
  } else {
    fetchProducts();
  }
});

window.checkout = () => shoppingCart.checkout();