// Toast helper
const toastEl = document.getElementById("appToast");
const toastBody = document.getElementById("appToastBody");

function showToast(message, type = "success") {
  toastBody.textContent = message;
  toastEl.classList.remove("text-bg-success", "text-bg-danger");
  toastEl.classList.add(type === "error" ? "text-bg-danger" : "text-bg-success");

  const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
  toast.show();
}

// ----------------- CREATE LINK -----------------
const form = document.getElementById("create-form");
const msg = document.getElementById("form-message");
const btn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  msg.textContent = "";
  btn.disabled = true;
  btn.textContent = "Creating...";

  const url = document.getElementById("url").value;
  const code = document.getElementById("code").value;

  try {
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, code: code || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error;
      msg.classList.add("text-danger");
      showToast(data.error, "error");
    } else {
      showToast("Link created");
      form.reset();
      setTimeout(() => location.reload(), 600);
    }
  } catch {
    showToast("Network error", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create";
  }
});

// ----------------- DELETE LINK -----------------
let deleteCode = null;
let deleteRow = null;

const deleteModalEl = document.getElementById("deleteModal");
const deleteModal = new bootstrap.Modal(deleteModalEl);
const deleteCodeText = document.getElementById("deleteCodeText");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

document.querySelectorAll(".delete-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    deleteCode = btn.dataset.code;
    deleteRow = btn.closest("tr");
    deleteCodeText.textContent = deleteCode;
    deleteModal.show();
  });
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!deleteCode) return;

  confirmDeleteBtn.disabled = true;

  try {
    const res = await fetch(`/api/links/${deleteCode}`, { method: "DELETE" });

    if (res.status === 204) {
      deleteRow.remove();
      showToast("Link deleted");
      deleteModal.hide();
    } else {
      showToast("Delete failed", "error");
    }
  } catch {
    showToast("Error deleting", "error");
  } finally {
    confirmDeleteBtn.disabled = false;
    deleteCode = null;
    deleteRow = null;
  }
});
