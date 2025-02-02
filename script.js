let shoppingList = [];

function addToShoppingList(id, name, price) {
    const existingItem = shoppingList.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        shoppingList.push({ id, name, price, quantity: 1 });
    }
    updateShoppingListDisplay();
}

function updateShoppingListDisplay() {
    const shoppingListItems = document.getElementById("shopping-list-items");
    const shoppingListTotal = document.getElementById("shopping-list-total");
    shoppingListItems.innerHTML = "";
    let total = 0;

    shoppingList.forEach(item => {
        total += item.price * item.quantity;
        const listItem = document.createElement("li");
        listItem.textContent = `${item.name} [${item.quantity}] - $${item.price.toFixed(2)}`;
        shoppingListItems.appendChild(listItem);
    });

    shoppingListTotal.textContent = total.toFixed(2);
}

function toggleShoppingList() {
    const shoppingListElement = document.getElementById("shopping-list");
    shoppingListElement.classList.toggle("hidden");
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
        updateShoppingListDisplay();
    }
}