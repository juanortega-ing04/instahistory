const session = localStorage.getItem("ih_session");
if (!session) window.location.href = "index.html";

const urlInput = document.getElementById("url");
const makeBtn = document.getElementById("makeQR");
const qrCanvas = document.getElementById("qrCanvas");
const qrText = document.getElementById("qrText");
const openLink = document.getElementById("openLink");

document.addEventListener("DOMContentLoaded", () => {
  const session = localStorage.getItem("ih_session");
  if (!session) window.location.href = "index.html";

  const urlInput = document.getElementById("url");
  const makeBtn = document.getElementById("makeQR");
  const qrText = document.getElementById("qrText");
  const openLink = document.getElementById("openLink");
  const qrImg = document.getElementById("qrImg");

  document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.removeItem("ih_session");
    window.location.href = "index.html";
  });

  // Verifica que cargó la librería
  if (typeof window.QRCode === "undefined") {
    qrText.textContent = "ERROR: No se cargó la librería QR (qrcode.min.js).";
    openLink.style.display = "none";
    return;
  }

  async function renderQR(url) {
    if (!url) {
      qrText.textContent = "Escribe un enlace válido para generar el QR.";
      return;
    }

    // Link
    openLink.href = url;
    openLink.textContent = "Abrir enlace";
    openLink.style.display = "inline-block";

    try {
      // Genera imagen base64 del QR
      const dataUrl = await window.QRCode.toDataURL(url, {
        width: 260,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      qrImg.src = dataUrl;
      qrText.textContent = url;
    } catch (err) {
      qrText.textContent = "ERROR al generar QR: " + (err?.message || err);
    }
  }

  // URL guardada / default
  const saved = localStorage.getItem("ih_forms_url");
  urlInput.value = saved || "https://forms.office.com/";

  makeBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    localStorage.setItem("ih_forms_url", url);
    renderQR(url);
  });

  renderQR(urlInput.value.trim());
});