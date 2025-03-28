function getCsrfToken() {
    return document.cookie
      .split("; ")
      .find(row => row.startsWith("csrfToken="))
      ?.split("=")[1];
  }
  
  async function loadCategories() {
    try {
      const res = await fetch("/categories");
      const categories = await res.json();
  
      const categoryBody = document.getElementById("categoriesTableBody");
      const categorySelect = document.getElementById("catid");
  
      categoryBody.innerHTML = "";
      categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
  
      categories.forEach(cat => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${cat.catid}</td>
          <td>${cat.name}</td>
          <td>
            <button onclick="editCategory(${cat.catid}, '${cat.name}')">Edit</button>
            <button onclick="deleteCategory(${cat.catid})">Delete</button>
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
      const res = await fetch("/products");
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
            <button onclick="editProduct(${prod.pid})">Edit</button>
            <button onclick="deleteProduct(${prod.pid})">Delete</button>
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
      const res = await fetch("/categories", {
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
      const res = await fetch(`/categories/${catid}`, {
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
      const res = await fetch(`/categories/${catid}`, {
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
    const catid = parseInt(prompt("Enter new category ID:"));
  
    if (!name || isNaN(price) || !description || isNaN(catid)) {
      return alert("Invalid input.");
    }
  
    try {
      const res = await fetch(`/products/${pid}`, {
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
      const res = await fetch(`/products/${pid}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": getCsrfToken()
        }
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
  
  window.addEventListener("DOMContentLoaded", () => {
    // Add CSRF token to form
    const csrf = document.createElement("input");
    csrf.type = "hidden";
    csrf.name = "csrfToken";
    csrf.value = getCsrfToken();
    document.getElementById("productForm").appendChild(csrf);
  
    // Hook form event
    document.getElementById("categoryForm").addEventListener("submit", handleAddCategory);
  
    // Load initial data
    loadCategories();
    loadProducts();
  });