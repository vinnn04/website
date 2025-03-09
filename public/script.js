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
    const listItem = document.createElement("li");
    listItem.textContent = `${item.name} [${item.quantity}] - $${(item.price * item.quantity).toFixed(2)}`;
    shoppingListItems.appendChild(listItem);
    });

    shoppingListTotal.textContent = total.toFixed(2);
    shoppingListHeader.textContent = `Shopping List - $${total.toFixed(2)}`;
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

window.loadShoppingList = loadShoppingList;
window.saveShoppingList = saveShoppingList;
window.addProductToCart = addProductToCart;
window.updateShoppingListDisplay = updateShoppingListDisplay;
window.checkout = checkout;

loadShoppingList();

// Fetch categories from the database and populate the sidebar.
function fetchCategories() {
    console.log("Fetching categories...");
    fetch("/categories")
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to retrieve categories");
        }
        return response.json();
      })
      .then(data => {
        console.log("Categories data:", data);  // Debug: print the received data
        const categoryList = document.getElementById("category-list");
        categoryList.innerHTML = "";
        if (data.length === 0) {
          // In case there are no categories, show a message.
          categoryList.textContent = "No categories found.";
        } else {
          data.forEach(cat => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            // Adjust the property name if necessary. Here we're assuming it's `catid`.
            a.href = `website.html?catid=${cat.catid}`;
            a.textContent = cat.name;
            li.appendChild(a);
            categoryList.appendChild(li);
          });
        }
      })
      .catch(error => {
        console.error("Error fetching categories:", error);
        // Optionally display an error message in the UI.
        const categoryList = document.getElementById("category-list");
        categoryList.textContent = "Error loading categories.";
      });
  }

const url = "/products";

function fetchProducts() {
    const urlParams = new URLSearchParams(window.location.search);
    const catid = urlParams.get("catid");
    let url = "/products";
    if (catid) {
        url += `?catid=${catid}`;
    }
    
    fetch(url)
        .then(response => {
        if (!response.ok) {
            throw new Error("Failed to retrieve products");
        }
        return response.json();
        })
        .then(data => {
        const productList = document.getElementById("product-list");
        if (productList) {
            productList.innerHTML = "";
            data.forEach(product => {
            const item = document.createElement("div");
            item.className = "product-item";
    
            const img = document.createElement("img");
            img.src = product.image_path ? `/${product.image_path}` : "placeholder.jpg";
            img.alt = product.name;
            img.onclick = () => { location.href = `product${product.pid}.html`; };
    
            const h3 = document.createElement("h3");
            h3.textContent = product.name;
            h3.onclick = () => { location.href = `product${product.pid}.html`; };
    
            const price = document.createElement("p");
            price.className = "price";
            price.textContent = `$${product.price}`;
    
            item.appendChild(img);
            item.appendChild(h3);
            item.appendChild(price);
    
            productList.appendChild(item);
            });
        }
        })
        .catch(error => console.error("Error fetching products:", error));
    }
// On document load, fetch both categories and products.
document.addEventListener("DOMContentLoaded", function() {
fetchCategories();
fetchProducts();
});