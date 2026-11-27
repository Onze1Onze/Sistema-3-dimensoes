import OBR, { type Image as OBRImage, type Item } from "@owlbear-rodeo/sdk";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  calculateSceneFrame,
  getImageWorldSize,
  getSceneCounts,
  getSceneImages,
  isRenderableImage,
  mapToWorld,
  worldToMap,
  type SceneFrame,
  WORLD_UNITS_PER_PIXEL,
} from "./scene-model";
import {
  nextTokenSelection,
  normalizeRotation,
  translateTokenPositions,
} from "./token-interaction";
import "./styles.css";

const MODAL_ID = "com.onze1onze.sistema-3-dimensoes/viewer";

const canvas = document.querySelector<HTMLCanvasElement>("#scene-canvas");
const statusLabel = document.querySelector<HTMLElement>("#scene-status");
const mapCount = document.querySelector<HTMLElement>("#map-count");
const tokenCount = document.querySelector<HTMLElement>("#token-count");
const propCount = document.querySelector<HTMLElement>("#prop-count");
const messagePanel = document.querySelector<HTMLDivElement>("#message-panel");
const messageTitle = document.querySelector<HTMLElement>("#message-title");
const messageBody = document.querySelector<HTMLElement>("#message-body");
const messageSymbol = document.querySelector<HTMLElement>("#message-symbol");
const toast = document.querySelector<HTMLDivElement>("#toast");
const tokenToolbar = document.querySelector<HTMLElement>("#token-toolbar");
const selectionLabel = document.querySelector<HTMLElement>("#selection-label");
const rotateLeftButton = document.querySelector<HTMLButtonElement>("#rotate-token-left");
const rotateRightButton = document.querySelector<HTMLButtonElement>("#rotate-token-right");
const lockButton = document.querySelector<HTMLButtonElement>("#toggle-token-lock");
const visibilityButton = document.querySelector<HTMLButtonElement>("#toggle-token-visibility");
const deleteButton = document.querySelector<HTMLButtonElement>("#delete-selected-tokens");
const deselectButton = document.querySelector<HTMLButtonElement>("#deselect-tokens");

if (!canvas) throw new Error("Canvas do visualizador não foi encontrado.");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#101722");
scene.fog = new THREE.Fog("#101722", 32, 100);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 250);
camera.position.set(0, 14, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.dampingFactor = 0.075;
controls.minDistance = 1.5;
controls.maxDistance = 80;
controls.maxPolarAngle = Math.PI / 2.02;
controls.target.set(0, 0, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xdce8ff, 0x303846, 2.1));
const sun = new THREE.DirectionalLight(0xffe3bd, 2.4);
sun.position.set(-8, 15, 7);
scene.add(sun);

const worldRoot = new THREE.Group();
const mapRoot = new THREE.Group();
const propRoot = new THREE.Group();
const tokenRoot = new THREE.Group();
worldRoot.add(mapRoot, propRoot, tokenRoot);
scene.add(worldRoot);

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

interface RenderRecord {
  object: THREE.Group | THREE.Mesh;
  mesh: THREE.Mesh;
  url: string;
  width: number;
  height: number;
  material: THREE.MeshStandardMaterial;
  selectionRing?: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

interface DragState {
  itemIds: string[];
  frame: SceneFrame;
  initialPositions: { id: string; x: number; y: number }[];
  startPosition: { x: number; y: number };
  dispatch: (recipe: (draft: any) => void) => any;
  stop: () => void;
  pointerId: number;
}

const records = new Map<string, RenderRecord>();
const textures = new Map<string, THREE.Texture>();
let currentItems: Item[] = [];
let currentFrame: SceneFrame | null = null;
let dragState: DragState | null = null;
let pendingDragPointerId: number | null = null;
let emptyClickCandidate: { pointerId: number; x: number; y: number } | null = null;
let selectedTokenIds = new Set<string>();
let currentPlayerRole: "GM" | "PLAYER" = "PLAYER";
let blockedByFog = false;
let sceneOperationVersion = 0;
let lastToastTimer = 0;
let unsubscribeItems: (() => void) | null = null;
let unsubscribeFog: (() => void) | null = null;
let unsubscribeReady: (() => void) | null = null;
let unsubscribePlayer: (() => void) | null = null;

function setStatus(text: string): void {
  if (statusLabel) statusLabel.textContent = text;
}

function showMessage(title: string, body: string, symbol = "!"): void {
  if (!messagePanel) return;
  if (messageTitle) messageTitle.textContent = title;
  if (messageBody) messageBody.textContent = body;
  if (messageSymbol) messageSymbol.textContent = symbol;
  messagePanel.hidden = false;
}

function hideMessage(): void {
  if (messagePanel) messagePanel.hidden = true;
}

function notify(text: string): void {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("visible");
  window.clearTimeout(lastToastTimer);
  lastToastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function updateCounts(items: Item[]): void {
  const counts = getSceneCounts(items);
  if (mapCount) mapCount.textContent = `${counts.maps} mapas`;
  if (tokenCount) tokenCount.textContent = `${counts.tokens} miniaturas`;
  if (propCount) propCount.textContent = `${counts.props} objetos`;
}

function disposeRecord(record: RenderRecord): void {
  record.mesh.geometry.dispose();
  record.material.dispose();
  record.selectionRing?.geometry.dispose();
  record.selectionRing?.material.dispose();
}

function removeMissingRecords(allowedIds: Set<string>): void {
  for (const [id, record] of records) {
    if (!allowedIds.has(id)) {
      record.object.removeFromParent();
      disposeRecord(record);
      records.delete(id);
    }
  }
}

function makePlaceholderTexture(): THREE.CanvasTexture {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 128;
  textureCanvas.height = 128;
  const context = textureCanvas.getContext("2d");
  if (context) {
    context.fillStyle = "#555f6e";
    context.fillRect(0, 0, 128, 128);
    context.strokeStyle = "#778597";
    context.lineWidth = 3;
    context.strokeRect(2, 2, 124, 124);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(128, 128);
    context.moveTo(128, 0);
    context.lineTo(0, 128);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const placeholderTexture = makePlaceholderTexture();

function getTexture(url: string, onLoad: (texture: THREE.Texture) => void, onError: () => void): void {
  const cached = textures.get(url);
  if (cached) {
    onLoad(cached);
    return;
  }
  textureLoader.load(
    url,
    (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      textures.set(url, texture);
      onLoad(texture);
    },
    undefined,
    (error: unknown) => {
      console.warn("[Sistema 3D] Não foi possível carregar uma textura. Verifique o CORS do arquivo.", error);
      onError();
    },
  );
}

function createRecord(item: OBRImage, kind: "map" | "token" | "prop"): RenderRecord {
  const worldSize = getImageWorldSize(item);
  const geometry = new THREE.PlaneGeometry(worldSize.width, worldSize.height);
  const material = new THREE.MeshStandardMaterial({
    map: placeholderTexture,
    transparent: kind === "token",
    alphaTest: kind === "token" ? 0.08 : 0,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: kind !== "token",
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.itemId = item.id;
  const object = new THREE.Group();
  object.add(mesh);
  let selectionRing: RenderRecord["selectionRing"];
  if (kind === "token") {
    const ringGeometry = new THREE.RingGeometry(0.82, 1, 40);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#9bc3ff",
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.025;
    selectionRing.renderOrder = 10001;
    selectionRing.scale.set(Math.max(worldSize.width, worldSize.height) * 0.62, Math.max(worldSize.width, worldSize.height) * 0.62, 1);
    selectionRing.visible = selectedTokenIds.has(item.id);
    object.add(selectionRing);
  }
  const parent = kind === "map" ? mapRoot : kind === "token" ? tokenRoot : propRoot;
  parent.add(object);
  const record: RenderRecord = { object, mesh, url: item.image.url, width: worldSize.width, height: worldSize.height, material, selectionRing };
  // Registre antes de consultar o cache: em cache hit o callback é síncrono.
  records.set(item.id, record);
  getTexture(item.image.url, (texture) => {
    const current = records.get(item.id);
    if (current && current.url === item.image.url) {
      current.material.map = texture;
      current.material.needsUpdate = true;
    }
  }, () => {
    notify(`Não foi possível carregar a imagem: ${item.name || "item sem nome"}`);
  });
  return record;
}

function classifyImage(item: OBRImage): "map" | "token" | "prop" | null {
  if (!isRenderableImage(item)) return null;
  if (item.layer === "MAP") return "map";
  if (item.layer === "CHARACTER" || item.layer === "MOUNT") return "token";
  if (item.layer === "PROP") return "prop";
  return null;
}

function updateRecord(item: OBRImage, record: RenderRecord, kind: "map" | "token" | "prop", frame: SceneFrame): void {
  const position = mapToWorld(item.position.x, item.position.y, frame);
  const size = getImageWorldSize(item);
  record.object.position.set(position.x, kind === "token" ? 0 : kind === "map" ? 0 : 0.018, position.z);
  record.object.rotation.set(0, THREE.MathUtils.degToRad(item.rotation), 0);
  record.mesh.scale.set(1, 1, 1);
  if (record.selectionRing) {
    record.selectionRing.visible = selectedTokenIds.has(item.id);
    const ringScale = Math.max(size.width, size.height) * 0.62;
    record.selectionRing.scale.set(ringScale, ringScale, 1);
  }
  if (Math.abs(record.width - size.width) > 1e-6 || Math.abs(record.height - size.height) > 1e-6) {
    record.mesh.geometry.dispose();
    record.mesh.geometry = new THREE.PlaneGeometry(size.width, size.height);
    record.width = size.width;
    record.height = size.height;
  }

  if (kind === "map") {
    record.mesh.rotation.set(-Math.PI / 2, 0, 0);
    record.mesh.position.y = 0;
    record.material.transparent = false;
    record.mesh.renderOrder = Math.min(1000, Math.max(0, item.zIndex));
  } else if (kind === "prop") {
    record.mesh.rotation.set(-Math.PI / 2, 0, 0);
    record.mesh.position.y = 0;
    record.material.transparent = true;
    record.material.alphaTest = 0.03;
    record.mesh.renderOrder = 2 + Math.min(1000, Math.max(0, item.zIndex));
  } else {
    record.mesh.rotation.set(0, 0, 0);
    record.mesh.position.y = size.height / 2;
    record.material.transparent = true;
    record.material.alphaTest = 0.08;
    record.mesh.renderOrder = 10000 + Math.min(1000, Math.max(0, item.zIndex));
  }

  if (record.url !== item.image.url) {
    record.url = item.image.url;
    record.material.map = placeholderTexture;
    record.material.needsUpdate = true;
    getTexture(item.image.url, (texture) => {
      const current = records.get(item.id);
      if (current && current.url === item.image.url) {
        current.material.map = texture;
        current.material.needsUpdate = true;
      }
    }, () => notify(`Falha ao carregar ${item.name || "uma imagem"}.`));
  }
  record.material.needsUpdate = true;
}

function syncScene(items: Item[]): void {
  if (blockedByFog) return;
  currentItems = items;
  const images = getSceneImages(items).filter((item) => classifyImage(item) !== null);
  const frame = calculateSceneFrame(items);
  updateCounts(items);
  if (!frame) {
    clearWorld();
    showMessage("Nenhum mapa encontrado", "Esta cena não possui uma imagem na camada MAP. Adicione ou selecione uma cena com um mapa no Owlbear e tente novamente.");
    setStatus("Aguardando imagem na camada MAP");
    currentFrame = null;
    return;
  }

  const frameChanged = !currentFrame || frame.centerX !== currentFrame.centerX || frame.centerY !== currentFrame.centerY || frame.width !== currentFrame.width || frame.height !== currentFrame.height;
  currentFrame = frame;
  if (frameChanged) {
    const width = frame.width * WORLD_UNITS_PER_PIXEL;
    const height = frame.height * WORLD_UNITS_PER_PIXEL;
    const floor = mapRoot.getObjectByName("system-3d-floor") as THREE.Mesh | undefined;
    if (floor) {
      floor.geometry.dispose();
      floor.geometry = new THREE.PlaneGeometry(Math.max(width * 2.5, 24), Math.max(height * 2.5, 24));
    } else {
      const floorMaterial = new THREE.MeshStandardMaterial({ color: "#202a38", roughness: 1, metalness: 0 });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(width * 2.5, 24), Math.max(height * 2.5, 24)), floorMaterial);
      floorMesh.name = "system-3d-floor";
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = -0.035;
      floorMesh.renderOrder = -10000;
      mapRoot.add(floorMesh);
    }
    if (!dragState) {
      controls.target.set(0, 0, 0);
      fitCamera(frame);
    }
  }

  const allowedIds = new Set<string>();
  for (const item of images) {
    allowedIds.add(item.id);
    const kind = classifyImage(item);
    if (!kind) continue;
    let record = records.get(item.id);
    if (!record) record = createRecord(item, kind);
    const expectedParent = kind === "map" ? mapRoot : kind === "token" ? tokenRoot : propRoot;
    if (record.object.parent !== expectedParent) expectedParent.add(record.object);
    updateRecord(item, record, kind, frame);
  }
  removeMissingRecords(allowedIds);
  syncSelectedTokens([...selectedTokenIds]);

  const count = images.length;
  hideMessage();
  setStatus(`${count} elemento(s) sincronizado(s) · cena em tempo real`);
}

function clearWorld(): void {
  for (const record of records.values()) {
    record.object.removeFromParent();
    disposeRecord(record);
  }
  records.clear();

  // Remove também o piso anterior. Mantê-lo após fechar/trocar de cena deixa
  // geometria antiga visível e pode conservar referências desnecessárias.
  for (const child of [...mapRoot.children]) {
    child.removeFromParent();
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    }
  }
  propRoot.clear();
  tokenRoot.clear();
  currentItems = [];
  currentFrame = null;
  selectedTokenIds.clear();
  refreshTokenToolbar();
}

function fitCamera(frame: SceneFrame): void {
  const width = Math.max(frame.width * WORLD_UNITS_PER_PIXEL, 3);
  const height = Math.max(frame.height * WORLD_UNITS_PER_PIXEL, 3);
  const distance = Math.max(width, height) * 1.15 + 5;
  camera.position.set(distance * 0.65, distance * 0.85, distance * 0.72);
  controls.target.set(0, 0, 0);
  controls.update();
}

async function checkFogSafety(items: Item[], isCurrent: () => boolean = () => true): Promise<boolean> {
  const playerRole = await OBR.player.getRole();
  if (!isCurrent()) return false;
  const fogFilled = await OBR.scene.fog.getFilled();
  if (!isCurrent()) return false;
  const visibilityItems = items.some((item) =>
    (item.layer === "FOG" || item.type === "WALL" || item.type === "LIGHT") && item.visible !== false,
  );
  const isFogScene = fogFilled || visibilityItems;
  if (isFogScene) {
    blockedByFog = true;
    endTokenDrag();
    clearWorld();
    const detail = playerRole === "GM"
      ? "Esta sala possui Fog of War, paredes ou fontes de luz de visão. O protótipo ainda não reproduz a visibilidade dinâmica do Owlbear; a visualização foi bloqueada para evitar inconsistências. Remova/desative o Fog of War apenas em uma cópia de teste para experimentar o modo 3D."
      : "Esta sala utiliza Fog of War, paredes ou fontes de luz de visão. Como o protótipo ainda não reproduz a visibilidade dinâmica do Owlbear, o modo 3D foi bloqueado para impedir que áreas ocultas sejam reveladas. O mapa 2D continua funcionando normalmente.";
    showMessage("Modo 3D indisponível nesta cena", detail, "🔒");
    setStatus("Bloqueado preventivamente: Fog of War detectado");
    return false;
  }
  blockedByFog = false;
  return true;
}

async function loadScene(): Promise<void> {
  const requestVersion = ++sceneOperationVersion;
  const isCurrent = () => requestVersion === sceneOperationVersion;

  try {
    const ready = await OBR.scene.isReady();
    if (!isCurrent()) return;

    if (!ready) {
      blockedByFog = false;
      clearWorld();
      updateCounts([]);
      showMessage("Nenhuma cena aberta", "Abra uma cena no Owlbear Rodeo e depois inicie o modo 3D.");
      setStatus("Aguardando cena do Owlbear");
      return;
    }

    const items = await OBR.scene.items.getItems();
    if (!isCurrent()) return;

    const safe = await checkFogSafety(items, isCurrent);
    if (!isCurrent()) return;
    if (safe) syncScene(items);
  } catch (error) {
    if (!isCurrent()) return;
    console.error("[Sistema 3D] Erro ao carregar a cena:", error);
    showMessage("Erro ao carregar a cena", "Não foi possível ler os dados desta sala. Verifique se a extensão está habilitada e tente novamente.");
    setStatus("Erro na leitura da cena");
  }
}

function findTokenAtPointer(event: PointerEvent): RenderRecord | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const tokenMeshes: THREE.Object3D[] = [];
  for (const record of records.values()) {
    if (record.object.parent === tokenRoot) tokenMeshes.push(record.mesh);
  }
  const hits = raycaster.intersectObjects(tokenMeshes, false);
  if (hits.length === 0) return null;
  const id = hits[0].object.userData.itemId as string | undefined;
  return id ? records.get(id) ?? null : null;
}

function getSelectedTokenItems(): Item[] {
  return currentItems.filter((item) =>
    selectedTokenIds.has(item.id) &&
    (item.layer === "CHARACTER" || item.layer === "MOUNT") &&
    item.type === "IMAGE" &&
    "image" in item,
  );
}

function syncSelectedTokens(ids: string[] = []): void {
  selectedTokenIds = new Set(ids.filter((id) => records.get(id)?.object.parent === tokenRoot));
  for (const [id, record] of records) {
    if (record.selectionRing) record.selectionRing.visible = selectedTokenIds.has(id);
  }
  refreshTokenToolbar();
}

function refreshTokenToolbar(): void {
  const items = getSelectedTokenItems();
  if (tokenToolbar) tokenToolbar.hidden = items.length === 0;
  if (selectionLabel) {
    selectionLabel.textContent = items.length === 1
      ? (items[0].name || "1 token selecionado")
      : items.length + " tokens selecionados";
  }
  if (lockButton) lockButton.textContent = items.length > 0 && items.every((item) => item.locked) ? "Desbloquear" : "Bloquear";
  if (visibilityButton) {
    visibilityButton.hidden = currentPlayerRole !== "GM";
    visibilityButton.textContent = items.length > 0 && items.every((item) => item.visible === false) ? "Mostrar" : "Ocultar";
  }
}

function getMapPositionAtPointer(event: PointerEvent, frame: SceneFrame): { x: number; y: number } | null {
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
  return worldToMap(hit.x, hit.z, frame);
}

async function canUpdateTokenItems(items: Item[], operation: "UPDATE" | "DELETE"): Promise<boolean> {
  for (const item of items) {
    const permission = item.layer === "CHARACTER"
      ? operation === "UPDATE" ? "CHARACTER_UPDATE" : "CHARACTER_DELETE"
      : operation === "UPDATE" ? "MOUNT_UPDATE" : "MOUNT_DELETE";
    if (!await OBR.player.hasPermission(permission)) return false;
  }
  return true;
}

async function rotateSelectedTokens(amount: number): Promise<void> {
  const items = getSelectedTokenItems();
  if (items.length === 0) return;
  if (items.some((item) => item.locked)) {
    notify("Desbloqueie os tokens antes de girá-los.");
    return;
  }
  try {
    if (!await canUpdateTokenItems(items, "UPDATE")) {
      notify("Você não tem permissão para editar todos os tokens selecionados.");
      return;
    }
    const ids = new Set(items.map((item) => item.id));
    await OBR.scene.items.updateItems(items, (draft) => {
      for (const item of draft) {
        if (ids.has(item.id)) item.rotation = normalizeRotation(item.rotation + amount);
      }
    });
  } catch (error) {
    console.error("[Sistema 3D] Falha ao girar tokens:", error);
    notify("Não foi possível girar os tokens selecionados.");
  }
}

async function toggleSelectedTokenLock(): Promise<void> {
  const items = getSelectedTokenItems();
  if (items.length === 0) return;
  try {
    if (!await canUpdateTokenItems(items, "UPDATE")) {
      notify("Você não tem permissão para bloquear ou desbloquear todos os tokens selecionados.");
      return;
    }
    const lock = !items.every((item) => item.locked);
    const ids = new Set(items.map((item) => item.id));
    await OBR.scene.items.updateItems(items, (draft) => {
      for (const item of draft) if (ids.has(item.id)) item.locked = lock;
    });
    notify(lock ? "Tokens bloqueados." : "Tokens desbloqueados.");
  } catch (error) {
    console.error("[Sistema 3D] Falha ao alterar bloqueio:", error);
    notify("Não foi possível alterar o bloqueio dos tokens.");
  }
}

async function toggleSelectedTokenVisibility(): Promise<void> {
  const items = getSelectedTokenItems();
  if (items.length === 0) return;
  try {
    if (await OBR.player.getRole() !== "GM") {
      notify("Somente o mestre pode ocultar ou mostrar tokens.");
      return;
    }
    if (!await canUpdateTokenItems(items, "UPDATE")) {
      notify("Você não tem permissão para alterar a visibilidade desses tokens.");
      return;
    }
    const visible = !items.every((item) => item.visible === false);
    const ids = new Set(items.map((item) => item.id));
    await OBR.scene.items.updateItems(items, (draft) => {
      for (const item of draft) if (ids.has(item.id)) item.visible = !visible;
    });
    await OBR.player.deselect(items.map((item) => item.id));
    syncSelectedTokens([]);
  } catch (error) {
    console.error("[Sistema 3D] Falha ao alterar visibilidade:", error);
    notify("Não foi possível alterar a visibilidade dos tokens.");
  }
}

async function deleteSelectedTokens(): Promise<void> {
  const items = getSelectedTokenItems();
  if (items.length === 0) return;
  if (!await canUpdateTokenItems(items, "DELETE")) {
    notify("Você não tem permissão para excluir todos os tokens selecionados.");
    return;
  }
  const count = items.length;
  if (!window.confirm("Excluir " + count + (count === 1 ? " token selecionado?" : " tokens selecionados?"))) return;
  try {
    const ids = items.map((item) => item.id);
    const attachments = await OBR.scene.items.getItemAttachments(ids);
    const allIds = [...new Set([...ids, ...attachments.map((item) => item.id)])];
    await OBR.scene.items.deleteItems(allIds);
    await OBR.player.deselect(ids);
    syncSelectedTokens([]);
    notify(count === 1 ? "Token excluído." : count + " tokens excluídos.");
  } catch (error) {
    console.error("[Sistema 3D] Falha ao excluir tokens:", error);
    notify("Não foi possível excluir os tokens selecionados.");
  }
}

async function beginTokenDrag(record: RenderRecord, event: PointerEvent, selectedIds: string[]): Promise<void> {
  const frame = currentFrame;
  if (!frame || dragState) {
    pendingDragPointerId = null;
    controls.enabled = true;
    return;
  }

  const clickedId = record.mesh.userData.itemId as string;
  const clickedItem = currentItems.find((item) => item.id === clickedId);
  if (!clickedItem || clickedItem.locked) {
    pendingDragPointerId = null;
    controls.enabled = true;
    if (clickedItem?.locked) notify("Este token está bloqueado. Use o botão Desbloquear para movê-lo.");
    return;
  }

  try {
    const selectedItems = selectedIds
      .map((id) => currentItems.find((item) => item.id === id))
      .filter((item): item is Item => item !== undefined &&
        (item.layer === "CHARACTER" || item.layer === "MOUNT") &&
        item.type === "IMAGE" && "image" in item);
    const movableItems: Item[] = [];

    for (const item of selectedItems) {
      if (item.locked) continue;
      const permission = item.layer === "CHARACTER" ? "CHARACTER_UPDATE" : "MOUNT_UPDATE";
      if (await OBR.player.hasPermission(permission)) movableItems.push(item);
    }

    if (movableItems.length < selectedItems.length) {
      notify("Tokens bloqueados ou sem permissão foram ignorados no arraste.");
    }
    if (movableItems.length === 0) {
      pendingDragPointerId = null;
      controls.enabled = true;
      notify("Nenhum token selecionado pode ser movido.");
      return;
    }

    // O caminho rápido de interação do SDK não recalcula a hierarquia de
    // anexos. Incluímos os anexos/subanexos e deslocamos tudo pelo mesmo delta.
    const selectedIds = movableItems.map((item) => item.id);
    const [selectedState, attachmentState] = await Promise.all([
      OBR.scene.items.getItems(selectedIds),
      OBR.scene.items.getItemAttachments(selectedIds),
    ]);
    const stateById = new Map<string, Item>();
    for (const item of [...attachmentState, ...selectedState]) stateById.set(item.id, item);
    const baseState = [...stateById.values()];
    if (pendingDragPointerId !== event.pointerId || baseState.length === 0) {
      pendingDragPointerId = null;
      controls.enabled = true;
      return;
    }
    const startPosition = getMapPositionAtPointer(event, frame);
    if (!startPosition) {
      pendingDragPointerId = null;
      controls.enabled = true;
      return;
    }

    const [dispatch, stop] = await OBR.interaction.startItemInteraction(baseState);
    if (pendingDragPointerId !== event.pointerId) {
      stop();
      return;
    }
    dragState = {
      itemIds: baseState.map((item) => item.id),
      frame,
      initialPositions: baseState.map((item) => ({ id: item.id, x: item.position.x, y: item.position.y })),
      startPosition,
      dispatch,
      stop,
      pointerId: event.pointerId,
    };
    controls.enabled = false;
  } catch (error) {
    console.error("[Sistema 3D] Falha ao iniciar interação dos tokens:", error);
    pendingDragPointerId = null;
    controls.enabled = true;
    notify("Não foi possível iniciar a movimentação dos tokens selecionados.");
  }
}

function moveDraggedToken(event: PointerEvent): void {
  if (!dragState) return;
  const activeDrag = dragState;
  const position = getMapPositionAtPointer(event, activeDrag.frame);
  if (!position) return;
  const translated = translateTokenPositions(activeDrag.initialPositions, {
    x: position.x - activeDrag.startPosition.x,
    y: position.y - activeDrag.startPosition.y,
  });
  const positions = new Map(translated.map((item) => [item.id, { x: item.x, y: item.y }]));
  activeDrag.dispatch((draft: any) => {
    for (const item of draft) {
      const next = positions.get(item.id);
      if (next) item.position = next;
    }
  });
}

function endTokenDrag(): void {
  if (dragState) {
    try {
      dragState.stop();
    } catch (error) {
      console.error("[Sistema 3D] Erro ao finalizar interação:", error);
    }
    dragState = null;
  }
  pendingDragPointerId = null;
  controls.enabled = true;
}

renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button !== 0 || blockedByFog) return;
  const record = findTokenAtPointer(event);
  if (!record) {
    emptyClickCandidate = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    return;
  }

  // O clique seleciona o token no próprio Owlbear. O evento é capturado antes
  // do OrbitControls para não confundir a miniatura com um arraste da câmera.
  event.preventDefault();
  event.stopImmediatePropagation();
  emptyClickCandidate = null;
  pendingDragPointerId = event.pointerId;
  controls.enabled = false;
  try {
    renderer.domElement.setPointerCapture(event.pointerId);
  } catch (error) {
    console.warn("[Sistema 3D] Não foi possível capturar o ponteiro:", error);
  }

  void (async () => {
    const itemId = record.mesh.userData.itemId as string;
    try {
      const current = (await OBR.player.getSelection()) ?? [];
      const toggle = event.ctrlKey || event.metaKey;
      const alreadySelected = current.includes(itemId);
      const next = !event.shiftKey && !toggle && alreadySelected
        ? current
        : nextTokenSelection(current, itemId, { additive: event.shiftKey, toggle });
      if (next.length === 0) await OBR.player.deselect();
      else await OBR.player.select(next, true);
      syncSelectedTokens(next);

      if (pendingDragPointerId !== event.pointerId || (toggle && alreadySelected)) return;
      await beginTokenDrag(record, event, next);
    } catch (error) {
      console.error("[Sistema 3D] Falha ao selecionar token:", error);
      pendingDragPointerId = null;
      controls.enabled = true;
      notify("Não foi possível selecionar este token.");
    }
  })();
}, { capture: true });
renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
  if (emptyClickCandidate?.pointerId === event.pointerId) {
    const dx = event.clientX - emptyClickCandidate.x;
    const dy = event.clientY - emptyClickCandidate.y;
    if (Math.hypot(dx, dy) > 5) emptyClickCandidate = null;
  }
  if (dragState && dragState.pointerId === event.pointerId) moveDraggedToken(event);
}, { capture: true });
renderer.domElement.addEventListener("pointerup", (event: PointerEvent) => {
  const wasEmptyClick = emptyClickCandidate?.pointerId === event.pointerId;
  emptyClickCandidate = null;
  pendingDragPointerId = null;
  endTokenDrag();
  if (wasEmptyClick) {
    void OBR.player.deselect().then(() => syncSelectedTokens([])).catch((error) => {
      console.warn("[Sistema 3D] Não foi possível limpar a seleção:", error);
    });
  }
});
renderer.domElement.addEventListener("pointercancel", (_event: PointerEvent) => {
  emptyClickCandidate = null;
  pendingDragPointerId = null;
  endTokenDrag();
});

rotateLeftButton?.addEventListener("click", () => void rotateSelectedTokens(-15));
rotateRightButton?.addEventListener("click", () => void rotateSelectedTokens(15));
lockButton?.addEventListener("click", () => void toggleSelectedTokenLock());
visibilityButton?.addEventListener("click", () => void toggleSelectedTokenVisibility());
deleteButton?.addEventListener("click", () => void deleteSelectedTokens());
deselectButton?.addEventListener("click", () => {
  void OBR.player.deselect().then(() => syncSelectedTokens([]));
});

function updateBillboardFacing(): void {
  for (const record of records.values()) {
    if (record.object.parent !== tokenRoot) continue;
    const itemId = record.mesh.userData.itemId as string;
    const item = currentItems.find((candidate) => candidate.id === itemId);
    if (!item) continue;
    const dx = camera.position.x - record.object.position.x;
    const dz = camera.position.z - record.object.position.z;
    record.object.rotation.y = Math.atan2(dx, dz) + THREE.MathUtils.degToRad(item.rotation);
  }
}

const keysDown = new Set<string>();
window.addEventListener("keydown", (event) => {
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) {
    keysDown.add(event.key.toLowerCase());
    if (event.key.toLowerCase().startsWith("arrow")) event.preventDefault();
  }
  if (event.key === "Escape") void OBR.modal.close(MODAL_ID);
});
window.addEventListener("keyup", (event) => keysDown.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keysDown.clear());

function moveCameraWithKeys(delta: number): void {
  if (keysDown.size === 0 || dragState) return;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const distance = Math.max(0.01, controls.getDistance() * delta * 0.7);
  const movement = new THREE.Vector3();
  if (keysDown.has("w") || keysDown.has("arrowup")) movement.addScaledVector(forward, distance);
  if (keysDown.has("s") || keysDown.has("arrowdown")) movement.addScaledVector(forward, -distance);
  if (keysDown.has("d") || keysDown.has("arrowright")) movement.addScaledVector(right, distance);
  if (keysDown.has("a") || keysDown.has("arrowleft")) movement.addScaledVector(right, -distance);
  camera.position.add(movement);
  controls.target.add(movement);
}

function animate(): void {
  requestAnimationFrame(animate);
  moveCameraWithKeys(1 / 60);
  controls.update();
  updateBillboardFacing();
  renderer.render(scene, camera);
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener("resize", resize);

document.querySelector<HTMLButtonElement>("#close-viewer")?.addEventListener("click", () => {
  endTokenDrag();
  void OBR.modal.close(MODAL_ID);
});
document.querySelector<HTMLButtonElement>("#camera-reset")?.addEventListener("click", () => {
  if (currentFrame) fitCamera(currentFrame);
});
document.querySelector<HTMLButtonElement>("#view-iso")?.addEventListener("click", () => {
  const distance = Math.max(8, controls.getDistance());
  camera.position.set(distance * 0.72, distance * 0.82, distance * 0.72);
  controls.update();
});
document.querySelector<HTMLButtonElement>("#view-top")?.addEventListener("click", () => {
  const distance = Math.max(8, controls.getDistance());
  camera.position.set(0, distance, 0.001);
  controls.update();
});
document.querySelector<HTMLButtonElement>("#message-retry")?.addEventListener("click", () => void loadScene());

if (!OBR.isAvailable) {
  showMessage("Abra pelo Owlbear Rodeo", "Este visualizador precisa ser aberto pelo botão da extensão dentro de uma sala do Owlbear Rodeo.");
} else {
  OBR.onReady(() => {
    // A seleção do 3D e a seleção normal do Owlbear são a mesma seleção do jogador.
    unsubscribePlayer = OBR.player.onChange((player) => {
      syncSelectedTokens(player.selection ?? []);
    });
    void OBR.player.getSelection().then((ids) => syncSelectedTokens(ids ?? [])).catch((error) => {
      console.warn("[Sistema 3D] Não foi possível ler a seleção inicial:", error);
    });
    void OBR.player.getRole().then((role) => {
      currentPlayerRole = role;
      refreshTokenToolbar();
    }).catch((error) => {
      console.warn("[Sistema 3D] Não foi possível identificar o papel do jogador:", error);
    });

    // Instale os listeners antes da consulta inicial. Assim, uma cena que
    // terminar de carregar durante loadScene() não fica sem atualização.
    unsubscribeReady = OBR.scene.onReadyChange((ready: boolean) => {
      if (ready) void loadScene();
      else {
        sceneOperationVersion += 1;
        endTokenDrag();
        blockedByFog = false;
        clearWorld();
        updateCounts([]);
        showMessage("Cena fechada", "Abra uma cena no Owlbear Rodeo para continuar.");
        setStatus("Aguardando uma cena do Owlbear");
      }
    });
    unsubscribeItems = OBR.scene.items.onChange((items: Item[]) => {
      const requestVersion = ++sceneOperationVersion;
      const isCurrent = () => requestVersion === sceneOperationVersion;
      void (async () => {
        try {
          const safe = await checkFogSafety(items, isCurrent);
          if (isCurrent() && safe) syncScene(items);
        } catch (error) {
          if (!isCurrent()) return;
          console.error("[Sistema 3D] Erro ao sincronizar alterações da cena:", error);
          setStatus("Erro ao sincronizar a cena");
        }
      })();
    });
    unsubscribeFog = OBR.scene.fog.onChange(() => void loadScene());
    void loadScene();
  });
}

window.addEventListener("pagehide", () => {
  endTokenDrag();
  unsubscribeItems?.();
  unsubscribeFog?.();
  unsubscribeReady?.();
  unsubscribePlayer?.();
  controls.dispose();
  renderer.dispose();
  for (const texture of textures.values()) texture.dispose();
});

animate();
