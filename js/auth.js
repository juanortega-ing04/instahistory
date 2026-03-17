const form = document.getElementById("loginForm");
const err = document.getElementById("error");

function setSession(user) {
  localStorage.setItem("ih_session", JSON.stringify(user));
}

function go() {
  window.location.href = "experience.html";
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  err.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    err.textContent = "Completa correo y contraseña.";
    return;
  }

  // Demo simple: cualquier correo/clave
  setSession({ email, role: "visitor", ts: Date.now() });
  go();
});