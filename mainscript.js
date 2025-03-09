// Fetch categories and populate the sidebar
async function loadCategories() {
    const categoryList = document.getElementById('categoryList');
    try {
    const response = await fetch('/categories');
    const categories = await response.json();

    categoryList.innerHTML = ''; // Clear any existing categories
    categories.forEach((category) => {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = `?catid=${category.catid}`; // Query string for filtering products
        link.textContent = category.name;
        listItem.appendChild(link);
        categoryList.appendChild(listItem);
    });
    } catch (error) {
    console.error('Error loading categories:', error);
    }
}

// Fetch products based on the selected category
async function loadProducts() {
    const productsContainer = document.getElementById('productList');
    const urlParams = new URLSearchParams(window.location.search);
    const catid = urlParams.get('catid');

    try {
    const response = await fetch(catid ? `/products?catid=${catid}` : '/products');
    const products = await response.json();

    productsContainer.innerHTML = ''; // Clear any existing products
    products.forEach((product) => {
        const productItem = document.createElement('div');
        productItem.classList.add('product-item');

        productItem.innerHTML = `
        <img src="/${product.image_thumbnail}" alt="${product.name}" onclick="location.href='product.html?pid=${product.pid}'">
        <h3>${product.name}</h3>
        <p class="price">$${product.price}</p>
        `;
        productsContainer.appendChild(productItem);
    });
    } catch (error) {
    console.error('Error loading products:', error);
    }
}

// Load categories and products on page load
window.onload = () => {
    loadCategories();
    loadProducts();
};