document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("changePasswordForm");
  
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
  
      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const messageDiv = document.getElementById("message");
  
      try {
        const response = await fetch("/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
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
  });