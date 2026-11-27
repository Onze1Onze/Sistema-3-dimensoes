import OBR from "@owlbear-rodeo/sdk";
import { watchSceneReadiness } from "./scene-readiness";
import "./styles.css";

const MODAL_ID = "com.onze1onze.sistema-3-dimensoes/viewer";
const status = document.querySelector<HTMLDivElement>("#launcher-status");
const button = document.querySelector<HTMLButtonElement>("#launch-button");

let sceneReady = false;
let isOpeningViewer = false;
let unsubscribeSceneReadiness: (() => void) | null = null;

function setStatus(message: string, ready = false): void {
  if (!status) return;

  const dot = document.createElement("span");
  dot.className = `status-dot${ready ? " ready" : ""}`;
  const text = document.createElement("span");
  text.textContent = message;
  status.replaceChildren(dot, text);
}

function applySceneReadiness(ready: boolean): void {
  sceneReady = ready;
  if (button) button.disabled = !ready || isOpeningViewer;

  if (ready) {
    setStatus("Cena carregada. O modo 3D está disponível.", true);
  } else {
    setStatus("Nenhuma cena aberta. Abra uma cena no Owlbear Rodeo.");
  }
}

function handleReadinessError(error: unknown): void {
  console.error("[Sistema 3D] Falha ao verificar a disponibilidade da cena:", error);
  sceneReady = false;
  if (button) button.disabled = true;
  setStatus("Não foi possível verificar a cena. Recarregue a extensão.");
}

if (!OBR.isAvailable) {
  setStatus("Abra esta extensão dentro de uma sala do Owlbear Rodeo.");
} else {
  // OBR.onReady significa que o SDK está pronto. A cena pode terminar de
  // carregar depois; por isso acompanhamos também OBR.scene.onReadyChange.
  OBR.onReady(() => {
    unsubscribeSceneReadiness?.();
    try {
      unsubscribeSceneReadiness = watchSceneReadiness(
        OBR.scene,
        applySceneReadiness,
        handleReadinessError,
      );
    } catch (error) {
      handleReadinessError(error);
    }
  });
}

button?.addEventListener("click", async () => {
  if (isOpeningViewer || button.disabled || !sceneReady) return;

  isOpeningViewer = true;
  button.disabled = true;
  const label = button.querySelector("span");
  if (label) label.textContent = "Abrindo visualizador…";

  try {
    // Revalida no clique para evitar abrir o modal se a cena tiver sido
    // fechada no intervalo entre o evento de prontidão e a interação.
    const readyNow = await OBR.scene.isReady();
    if (!readyNow) {
      applySceneReadiness(false);
      return;
    }

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
    isOpeningViewer = false;
    button.disabled = !sceneReady;
    if (label) label.textContent = "Entrar no modo 3D";
  }
});

window.addEventListener("pagehide", () => {
  unsubscribeSceneReadiness?.();
  unsubscribeSceneReadiness = null;
});
