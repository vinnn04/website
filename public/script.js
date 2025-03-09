let shoppingList = [];

function loadShoppingList() {
  const storedList = localStorage.getItem("shoppingList");
  if (storedList) {
    shoppingList = JSON.parse(storedList);
    updateShoppingListDisplay();
  }
}

function saveShoppingList() {
  localStorage.setItem("shoppingList", JSON.stringify(shoppingList));
}

function addProductToCart(id, name, price, quantityInputId) {
  const quantityInput = document.getElementById(quantityInputId);
  const quantity = parseInt(quantityInput.value, 10);

  if (isNaN(quantity) || quantity < 1) {
    alert("Please enter a valid quantity!");
    return;
  }

  const existingItem = shoppingList.find(item => item.id === id);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    shoppingList.push({ id, name, price, quantity });
  }

  saveShoppingList();
  updateShoppingListDisplay();
}

function updateShoppingListDisplay() {
  const shoppingListItems = document.getElementById("shopping-list-items");
  const shoppingListTotal = document.getElementById("shopping-list-total");
  const shoppingListHeader = document.querySelector(".shopping-list-header");
  shoppingListItems.innerHTML = "";
  let total = 0;

  shoppingList.forEach(item => {
    total += item.price * item.quantity;

    // The list item now includes increment, decrement, and delete buttons, along with an input field.
    const listItem = document.createElement("li");
    listItem.id = `cart-item-${item.id}`;
    listItem.innerHTML = `
      <span class="item-name">${item.name}</span> - $<span class="unit-price">${item.price.toFixed(2)}</span> each<br>
      <div class="quantity-controls">
        <button onclick="decrementItem(${item.id})">-</button>
        <input type="number" id="item-qty-${item.id}" value="${item.quantity}" min="1" onchange="updateItemQuantity(${item.id}, this.value)">
        <button onclick="incrementItem(${item.id})">+</button>
        <button onclick="deleteItem(${item.id})">Delete</button>
      </div>
      <div class="item-total">Total: $<span>${(item.price * item.quantity).toFixed(2)}</span></div>
    `;
    shoppingListItems.appendChild(listItem);
  });

  shoppingListTotal.textContent = total.toFixed(2);
  shoppingListHeader.textContent = `Shopping List - $${total.toFixed(2)}`;
}
function updateItemQuantity(pid, newQty) {
  let quantity = parseInt(newQty, 10);
  if (isNaN(quantity) || quantity < 1) {
    alert("Quantity must be a positive number!");
    return;
  }
  const item = shoppingList.find(item => item.id === pid);
  if (item) {
    item.quantity = quantity;
    saveShoppingList();
    updateShoppingListDisplay();
  }
}

function incrementItem(pid) {
  const item = shoppingList.find(item => item.id === pid);
  if (item) {
    item.quantity++;
    saveShoppingList();
    updateShoppingListDisplay();
  }
}

function decrementItem(pid) {
  const item = shoppingList.find(item => item.id === pid);
  if (item) {
    // If quantity becomes less than 1, remove the item
    if (item.quantity > 1) {
      item.quantity--;
    } else {
      shoppingList = shoppingList.filter(i => i.id !== pid);
    }
    saveShoppingList();
    updateShoppingListDisplay();
  }
}

function deleteItem(pid) {
  shoppingList = shoppingList.filter(item => item.id !== pid);
  saveShoppingList();
  updateShoppingListDisplay();
}

function checkout() {
  if (shoppingList.length === 0) {
    alert("Your shopping list is empty. Please add items to proceed.");
  } else {
    let message = "You are about to checkout the following items:\n\n";
    shoppingList.forEach(item => {
      message += `${item.name} - Quantity: ${item.quantity} - Price: $${(item.price * item.quantity).toFixed(2)}\n`;
    });
    message += `\nTotal: $${shoppingList.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2)}`;
    alert(message);
    shoppingList = [];
    saveShoppingList();
    updateShoppingListDisplay();
  }
}

window.updateItemQuantity = updateItemQuantity;
window.incrementItem = incrementItem;
window.decrementItem = decrementItem;
window.deleteItem = deleteItem;
window.loadShoppingList = loadShoppingList;
window.saveShoppingList = saveShoppingList;
window.addProductToCart = addProductToCart;
window.updateShoppingListDisplay = updateShoppingListDisplay;
window.checkout = checkout;

loadShoppingList();

document.addEventListener("DOMContentLoaded", () => {
  fetchCategories();
  // Check if URL contains a product id query parameter (pid)
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get('pid');
  if (pid) {
    fetchProductDetails(pid);
  } else {
    fetchProducts(); // load all products or filter by category if catid exists.
  }
});

// Fetch and display categories as clickable buttons.
function fetchCategories() {
  fetch('/categories')
    .then(response => {
      if (!response.ok) throw new Error("Failed to retrieve categories");
      return response.json();
    })
    .then(data => {
      const categoryList = document.getElementById("category-list");
      categoryList.innerHTML = ""; // Clear any previous content

      data.forEach(category => {
        const btn = document.createElement("button");
        btn.textContent = category.name;
        btn.onclick = () => {
          // Construct the URL dynamically based on the category's catid.
          window.location.href = `http://localhost:3000/category${category.catid}.html`;
        };
        categoryList.appendChild(btn);
      });
    })
    .catch(error => console.error("Error fetching categories:", error));
}

// Fetch and display a list of products (fallback if no specific pid parameter).
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
      // Create a title to indicate that products are being listed.
      dynamicContent.innerHTML = `<h2>Our Products</h2>`;
      const productList = document.createElement("div");
      productList.className = "product-list";

      if (data.length === 0) {
        productList.textContent = "No products found for this category.";
      } else {
        data.forEach(product => {
          // Use the thumbnail image if available for product listing
          let imagePath = product.thumbnail_path 
                            ? product.thumbnail_path 
                            : (product.image_path || `images/product${product.pid}.jpg`);
          const item = document.createElement("div");
          item.className = "product-item";
          // Clicking the item takes the user to the product details view by adding ?pid=x to the URL.
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

// Fetch and display details for a single product based on its product id (pid)
function fetchProductDetails(pid) {
  fetch(`/products?pid=${pid}`)
    .then(response => {
      if (!response.ok) {
        throw new Error("Failed to retrieve product details");
      }
      return response.json();
    })
    .then(product => {
      const dynamicContent = document.getElementById("dynamic-content");
      // On the details page, display the full-size image.
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

// Helper function to update a query string parameter in a URL.
function updateQueryStringParameter(uri, key, value) {
  let re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  let separator = uri.indexOf('?') !== -1 ? "&" : "?";
  if (uri.match(re)) {
    return uri.replace(re, '$1' + key + "=" + value + '$2');
  } else {
    return uri + separator + key + "=" + value;
  }
}