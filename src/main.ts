import OBR from "@owlbear-rodeo/sdk";
import "./styles.css";

const MODAL_ID = "com.onze1onze.sistema-3-dimensoes/viewer";
const status = document.querySelector<HTMLDivElement>("#launcher-status");
const button = document.querySelector<HTMLButtonElement>("#launch-button");

function setStatus(message: string, ready = false): void {
  if (!status) return;
  status.innerHTML = `<span class="status-dot ${ready ? "ready" : ""}"></span><span>${message}</span>`;
}

if (!OBR.isAvailable) {
  setStatus("Abra esta extensão dentro de uma sala do Owlbear Rodeo.");
} else {
  OBR.onReady(async () => {
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        setStatus("Entre em uma cena antes de iniciar o modo 3D.");
        return;
      }
      setStatus("Conectado à cena atual.", true);
      if (button) button.disabled = false;
    } catch (error) {
      console.error("[Sistema 3D] Falha ao verificar a cena:", error);
      setStatus("Não foi possível acessar a cena atual.");
    }
  });
}

button?.addEventListener("click", async () => {
  if (button.disabled) return;
  button.disabled = true;
  const label = button.querySelector("span");
  if (label) label.textContent = "Abrindo visualizador…";
  try {
    await OBR.modal.open({
      id: MODAL_ID,
      url: new URL("./viewer.html", window.location.href).toString(),
      fullScreen: true,
      hidePaper: true,
      hideBackdrop: true,
    });
  } catch (error) {
    console.error("[Sistema 3D] Não foi possível abrir o visualizador:", error);
    setStatus("Falha ao abrir o modo 3D. Feche e tente novamente.");
  } finally {
    button.disabled = false;
    if (label) label.textContent = "Entrar no modo 3D";
  }
});
