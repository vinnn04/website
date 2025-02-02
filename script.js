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