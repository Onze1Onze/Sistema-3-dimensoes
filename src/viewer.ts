import OBR, {
  buildCurve,
  buildLabel,
  buildLine,
  buildRuler,
  buildShape,
  type Image as OBRImage,
  type Item,
} from "@owlbear-rodeo/sdk";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
  calculateSceneFrame,
  calculateSceneFrameFromBounds,
  getImageWorldSize,
  getSceneCounts,
  getSceneImages,
  isRenderableImage,
  mapToWorld,
  worldToMap,
  type SceneFrame,
  WORLD_UNITS_PER_PIXEL,
} from "./scene-model";
import { createImageMaterial } from "./image-material";
import { scaleMapLayout } from "./map-scaling";
import {
  canModifyCharacter,
  nextTokenSelection,
  normalizeRotation,
  translateTokenPositions,
} from "./token-interaction";
import { PointerDragGesture } from "./pointer-gesture";
import { filterSceneStrokePoints, formatGridDistance, getSceneShapeVertices, getSceneToolBounds, type ScenePoint, type SceneShapeTool } from "./scene-tools";
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
const scaleDownButton = document.querySelector<HTMLButtonElement>("#scale-token-down");
const scaleUpButton = document.querySelector<HTMLButtonElement>("#scale-token-up");
const rotateLeftButton = document.querySelector<HTMLButtonElement>("#rotate-token-left");
const rotateRightButton = document.querySelector<HTMLButtonElement>("#rotate-token-right");
const lockButton = document.querySelector<HTMLButtonElement>("#toggle-token-lock");
const visibilityButton = document.querySelector<HTMLButtonElement>("#toggle-token-visibility");
const deleteButton = document.querySelector<HTMLButtonElement>("#delete-selected-tokens");
const deselectButton = document.querySelector<HTMLButtonElement>("#deselect-tokens");
const sceneToolsDock = document.querySelector<HTMLElement>("#scene-tools");
const toolSettingsPanel = document.querySelector<HTMLElement>("#tool-settings");
const toolSettingsTitle = document.querySelector<HTMLElement>("#tool-settings-title");
const toolSettingsDescription = document.querySelector<HTMLElement>("#tool-settings-description");
const drawingSettings = document.querySelector<HTMLElement>("#drawing-settings");
const measureSettings = document.querySelector<HTMLElement>("#measure-settings");
const fireSettings = document.querySelector<HTMLElement>("#fire-settings");
const textSettings = document.querySelector<HTMLElement>("#text-settings");
const integrationsPanel = document.querySelector<HTMLElement>("#integrations-panel");
const measureReadout = document.querySelector<HTMLElement>("#measure-readout");
const strokeColorInput = document.querySelector<HTMLInputElement>("#tool-stroke-color");
const fillColorInput = document.querySelector<HTMLInputElement>("#tool-fill-color");
const strokeWidthInput = document.querySelector<HTMLInputElement>("#tool-stroke-width");
const strokeWidthValue = document.querySelector<HTMLOutputElement>("#tool-stroke-width-value");
const fillOpacityInput = document.querySelector<HTMLInputElement>("#tool-fill-opacity");
const fillOpacityValue = document.querySelector<HTMLOutputElement>("#tool-fill-opacity-value");
const snapGridInput = document.querySelector<HTMLInputElement>("#tool-snap-grid");
const measurePersistInput = document.querySelector<HTMLInputElement>("#measure-persist");
const fireRadiusInput = document.querySelector<HTMLInputElement>("#fire-radius");
const fireRadiusValue = document.querySelector<HTMLOutputElement>("#fire-radius-value");
const sceneTextInput = document.querySelector<HTMLTextAreaElement>("#scene-text-value");
const sceneToolButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-scene-tool]")];
const toolSettingsToggle = document.querySelector<HTMLButtonElement>("#tool-settings-toggle");
const toolSettingsClose = document.querySelector<HTMLButtonElement>("#tool-settings-close");
const integrationsToggle = document.querySelector<HTMLButtonElement>("#integrations-toggle");
const integrationsClose = document.querySelector<HTMLButtonElement>("#integrations-close");
const toolUndoButton = document.querySelector<HTMLButtonElement>("#tool-undo");
const mapScaleToggle = document.querySelector<HTMLButtonElement>("#map-scale-toggle");
const mapScalePanel = document.querySelector<HTMLElement>("#map-scale-panel");
const mapScaleClose = document.querySelector<HTMLButtonElement>("#map-scale-close");
const mapScaleInput = document.querySelector<HTMLInputElement>("#map-scale-input");
const mapScaleValue = document.querySelector<HTMLOutputElement>("#map-scale-value");

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
const drawingRoot = new THREE.Group();
const previewRoot = new THREE.Group();
worldRoot.add(mapRoot, propRoot, tokenRoot, drawingRoot, previewRoot);
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
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  itemRotation: number;
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

interface PendingTokenDrag {
  record: RenderRecord;
  gesture: PointerDragGesture;
  selectedIds: string[];
  startPosition: { x: number; y: number };
}

type SceneTool = "select" | "pan" | "measure" | "marker" | "brush" | "line" | "rectangle" | "circle" | "triangle" | "hexagon" | "fire" | "text";

interface SceneToolGesture {
  pointerId: number;
  tool: SceneTool;
  start: ScenePoint;
  current: ScenePoint;
  points: ScenePoint[];
  requestId: number;
}

interface DrawingRecord {
  object: THREE.Object3D;
  signature: string;
}

interface FireEffect {
  flames: THREE.Mesh[];
  light: THREE.PointLight;
  phase: number;
}

const SCENE_TOOL_METADATA = "com.onze1onze.sistema-3-dimensoes/tool";
const TOOL_COPY: Record<SceneTool, { title: string; description: string }> = {
  select: { title: "Selecionar", description: "Selecione e mova miniaturas" },
  pan: { title: "Câmera", description: "Arraste o espaço para navegar" },
  measure: { title: "Medir distância", description: "Arraste entre dois pontos do tabuleiro" },
  marker: { title: "Marcador", description: "Desenhe uma linha livre sobre o mapa" },
  brush: { title: "Pincel", description: "Desenhe uma área livre preenchida" },
  line: { title: "Linha", description: "Arraste para desenhar uma linha" },
  rectangle: { title: "Retângulo", description: "Arraste para definir uma área retangular" },
  circle: { title: "Círculo", description: "Arraste para definir uma área circular" },
  triangle: { title: "Triângulo", description: "Arraste para desenhar um triângulo" },
  hexagon: { title: "Hexágono", description: "Arraste para desenhar um hexágono" },
  fire: { title: "Fogo 3D", description: "Clique no chão para criar uma chama" },
  text: { title: "Texto", description: "Clique no chão para inserir uma anotação" },
};

const records = new Map<string, RenderRecord>();
const drawingRecords = new Map<string, DrawingRecord>();
const fireEffects = new Map<string, FireEffect>();
const textures = new Map<string, THREE.Texture>();
const pendingTextures = new Map<string, Promise<THREE.Texture>>();
let viewerDisposed = false;
const notifiedTextureFailures = new Set<string>();
const wideLineMaterials = new Set<LineMaterial>();
let currentItems: Item[] = [];
let currentFrame: SceneFrame | null = null;
let dragState: DragState | null = null;
let activePointerGesture: PointerDragGesture | null = null;
let pendingTokenDrag: PendingTokenDrag | null = null;
let emptyClickCandidate: { pointerId: number; x: number; y: number } | null = null;
let selectedTokenIds = new Set<string>();
let currentPlayerRole: "GM" | "PLAYER" = "PLAYER";
let blockedByFog = false;
let activeSceneTool: SceneTool = "select";
let sceneToolGesture: SceneToolGesture | null = null;
let lastCreatedSceneItemIds: string[] = [];
let gridDpi = 100;
let gridScaleInfo: { multiplier: number; unit: string; digits: number } | null = null;
let latestSceneFrameSignature: string | null = null;
let cachedSceneFrameSignature: string | null = null;
let cachedSceneFrame: SceneFrame | null = null;
let pendingSceneFrame: { signature: string; promise: Promise<SceneFrame | null> } | null = null;
let sceneOperationVersion = 0;
let sceneSessionVersion = 0;
let gridSettingsVersion = 0;
let mapScaleCommitInProgress = false;
let animationFrameId = 0;
let animationRunning = true;
let lastToastTimer = 0;
let unsubscribeItems: (() => void) | null = null;
let unsubscribeFog: (() => void) | null = null;
let unsubscribeReady: (() => void) | null = null;
let unsubscribePlayer: (() => void) | null = null;
let unsubscribeGrid: (() => void) | null = null;

function setStatus(text: string, state: "loading" | "ready" | "warning" | "error" = "loading"): void {
  if (statusLabel) statusLabel.textContent = text;
  const statusContainer = statusLabel?.closest<HTMLElement>(".scene-status-wrap");
  if (statusContainer) statusContainer.dataset.state = state;
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

function resetMapScalePreview(): void {
  mapRoot.scale.set(1, 1, 1);
  if (mapScaleInput) {
    mapScaleInput.value = "100";
    mapScaleInput.disabled = mapScaleCommitInProgress;
  }
  if (mapScaleValue) mapScaleValue.value = "100%";
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

  // Several tokens often share the same image URL. Reuse the in-flight request
  // rather than downloading and allocating one GPU texture per token.
  let request = pendingTextures.get(url);
  if (!request) {
    request = new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(url, resolve, undefined, reject);
    }).then((texture) => {
      if (viewerDisposed) {
        texture.dispose();
        return texture;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      textures.set(url, texture);
      return texture;
    }).finally(() => {
      pendingTextures.delete(url);
    });
    pendingTextures.set(url, request);
  }

  void request.then(onLoad, (error: unknown) => {
    if (viewerDisposed) return;
    console.warn("[Sistema 3D] Não foi possível carregar uma textura. Verifique o CORS do arquivo.", error);
    onError();
  });
}

function createRecord(item: OBRImage, kind: "map" | "token" | "prop"): RenderRecord {
  const worldSize = getImageWorldSize(item, gridDpi);
  const geometry = new THREE.PlaneGeometry(worldSize.width, worldSize.height);
  const material = createImageMaterial(kind, placeholderTexture);
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
  const record: RenderRecord = {
    object,
    mesh,
    url: item.image.url,
    width: worldSize.width,
    height: worldSize.height,
    material,
    itemRotation: item.rotation,
    selectionRing,
  };
  // Registre antes de consultar o cache: em cache hit o callback é síncrono.
  records.set(item.id, record);
  getTexture(item.image.url, (texture) => {
    const current = records.get(item.id);
    if (current && current.url === item.image.url) {
      current.material.map = texture;
      current.material.needsUpdate = true;
    }
  }, () => {
    if (!notifiedTextureFailures.has(item.image.url)) {
      notifiedTextureFailures.add(item.image.url);
      notify(`Não foi possível carregar a imagem: ${item.name || "item sem nome"}`);
    }
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
  const size = getImageWorldSize(item, gridDpi);
  record.itemRotation = item.rotation;
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

function getSceneFrameSignature(items: Item[]): string | null {
  const maps = getSceneImages(items)
    .filter((item) => item.layer === "MAP" && item.image.mime.startsWith("image/") &&
      item.image.width > 0 && item.image.height > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (maps.length === 0) return null;

  return JSON.stringify({
    sceneDpi: gridDpi,
    maps: maps.map((item) => ({
      id: item.id,
      position: item.position,
      rotation: item.rotation,
      scale: item.scale,
      width: item.image.width,
      height: item.image.height,
      imageDpi: item.grid?.dpi,
    })),
  });
}

/**
 * Ask Owlbear for the actual transformed MAP bounds. Cache until a map's
 * transform or the scene grid DPI changes; moving tokens does not invalidate it.
 */
async function resolveSceneFrame(items: Item[]): Promise<SceneFrame | null> {
  const maps = getSceneImages(items).filter((item) =>
    item.layer === "MAP" && item.image.mime.startsWith("image/") &&
    item.image.width > 0 && item.image.height > 0,
  );
  const signature = getSceneFrameSignature(items);
  if (!signature || maps.length === 0) {
    latestSceneFrameSignature = null;
    cachedSceneFrameSignature = null;
    cachedSceneFrame = null;
    pendingSceneFrame = null;
    return null;
  }

  if (cachedSceneFrameSignature === signature && cachedSceneFrame) return cachedSceneFrame;
  if (pendingSceneFrame?.signature === signature) return pendingSceneFrame.promise;

  latestSceneFrameSignature = signature;
  const request = {
    signature,
    promise: OBR.scene.items.getItemBounds(maps.map((item) => item.id)).then((bounds) => {
      const frame = calculateSceneFrameFromBounds(bounds);
      if (!frame) throw new Error("Owlbear retornou limites vazios para os mapas visíveis.");
      return frame;
    }).catch((error: unknown) => {
      console.warn("[Sistema 3D] Não foi possível obter os limites oficiais dos mapas; usando cálculo de contingência.", error);
      return calculateSceneFrame(items, gridDpi);
    }),
  };
  pendingSceneFrame = request;

  try {
    const frame = await request.promise;
    if (latestSceneFrameSignature === signature) {
      cachedSceneFrameSignature = signature;
      cachedSceneFrame = frame;
    }
    return frame;
  } finally {
    if (pendingSceneFrame === request) pendingSceneFrame = null;
  }
}

async function syncSceneWithResolvedFrame(items: Item[], isCurrent: () => boolean = () => true): Promise<void> {
  const signature = getSceneFrameSignature(items);
  const frame = await resolveSceneFrame(items);
  if (!isCurrent() || signature !== getSceneFrameSignature(items)) return;
  syncScene(items, frame);
}

function syncScene(items: Item[], frame: SceneFrame | null): void {
  if (blockedByFog) return;
  currentItems = items;
  const images = getSceneImages(items).filter((item) => classifyImage(item) !== null);
  updateCounts(items);
  if (!frame) {
    clearWorld();
    showMessage("Nenhum mapa encontrado", "Esta cena não possui uma imagem na camada MAP. Adicione ou selecione uma cena com um mapa no Owlbear e tente novamente.");
    setStatus("Aguardando mapa na camada MAP", "warning");
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

  syncDrawingItems(items, frame);

  const count = images.length;
  hideMessage();
  setStatus(`${count} elemento(s) sincronizado(s) · cena em tempo real`, "ready");
}

function disposeObjectTree(object: THREE.Object3D): void {
  object.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.Line | Line2;
    if ("geometry" in renderable && renderable.geometry) renderable.geometry.dispose();
    if ("material" in renderable && renderable.material) {
      const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      materials.forEach((material) => {
        const map = (material as THREE.Material & { map?: THREE.Texture | null }).map;
        map?.dispose();
        if (material instanceof LineMaterial) wideLineMaterials.delete(material);
        material.dispose();
      });
    }
  });
}

/** Wide lines render consistently in WebGL, unlike LineBasicMaterial.linewidth. */
function createWorldPolyline(
  vertices: THREE.Vector3[],
  color: string,
  opacity = 1,
  strokeWidth = 3,
): Line2 | null {
  if (vertices.length < 2) return null;
  const geometry = new LineGeometry();
  geometry.setPositions(vertices.flatMap((point) => [point.x, point.y, point.z]));
  const material = new LineMaterial({
    color,
    linewidth: Math.max(1, strokeWidth),
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  material.resolution.set(window.innerWidth, window.innerHeight);
  wideLineMaterials.add(material);
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  line.renderOrder = 12000;
  return line;
}

function createPolyline(
  points: ScenePoint[],
  color: string,
  opacity = 1,
  strokeWidth = 3,
): Line2 | null {
  if (points.length < 2 || !currentFrame) return null;
  const vertices = points.map((point) => {
    const world = mapToWorld(point.x, point.y, currentFrame!);
    return new THREE.Vector3(world.x, 0.045, world.z);
  });
  return createWorldPolyline(vertices, color, opacity, strokeWidth);
}

function createTextSprite(text: string, color = "#ffffff"): THREE.Sprite {
  const canvasText = document.createElement("canvas");
  const canvasWidth = 720;
  const padding = 28;
  const fontSize = 34;
  const lineHeight = 42;
  canvasText.width = canvasWidth;
  const context = canvasText.getContext("2d");
  const lines: string[] = [];

  if (context) {
    context.font = `bold ${fontSize}px Segoe UI, sans-serif`;
    const maxTextWidth = canvasWidth - padding * 2;
    for (const paragraph of text.split(/\r?\n/)) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width <= maxTextWidth) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = word;
        while (context.measureText(line).width > maxTextWidth && line.length > 1) {
          let splitAt = line.length - 1;
          while (splitAt > 1 && context.measureText(line.slice(0, splitAt)).width > maxTextWidth) splitAt -= 1;
          lines.push(line.slice(0, splitAt));
          line = line.slice(splitAt);
        }
      }
      if (line) lines.push(line);
    }
    const safeLines = lines.length ? lines : [""];
    canvasText.height = Math.max(92, padding * 2 + safeLines.length * lineHeight);
    context.font = `bold ${fontSize}px Segoe UI, sans-serif`;
    context.fillStyle = "#111a27e8";
    context.strokeStyle = "#9bc3ff";
    context.lineWidth = 4;
    if (typeof context.roundRect === "function") context.roundRect(4, 4, canvasWidth - 8, canvasText.height - 8, 18);
    else context.rect(4, 4, canvasWidth - 8, canvasText.height - 8);
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    safeLines.forEach((line, index) => {
      context.fillText(line, canvasWidth / 2, padding + lineHeight * (index + 0.5), maxTextWidth);
    });
  }

  const texture = new THREE.CanvasTexture(canvasText);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  const width = 1.25;
  sprite.scale.set(width, width * (canvasText.height / canvasWidth), 1);
  sprite.renderOrder = 13000;
  return sprite;
}

function createFireEffect(item: Item, frame: SceneFrame): THREE.Group {
  const data = item as unknown as {
    position: ScenePoint;
    width: number;
    metadata?: Record<string, unknown>;
  };
  const metadata = data.metadata?.[SCENE_TOOL_METADATA] as { kind?: string; radiusPixels?: number } | undefined;
  const radius = Math.max(0.18, ((metadata?.radiusPixels ?? data.width ?? 80) * WORLD_UNITS_PER_PIXEL) / 2);
  const world = mapToWorld(data.position.x, data.position.y, frame);
  const group = new THREE.Group();
  group.position.set(world.x, 0.035, world.z);
  group.rotation.y = THREE.MathUtils.degToRad(item.rotation || 0);

  const area = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({ color: "#ff7a32", transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  area.rotation.x = -Math.PI / 2;
  area.position.y = 0.008;
  group.add(area);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.94, radius, 48),
    new THREE.MeshBasicMaterial({ color: "#ffb46a", transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.02;
  group.add(rim);

  const flames: THREE.Mesh[] = [];
  const flameColors = ["#ff5b24", "#ff9b32", "#ffd36d", "#ff7227", "#ffe09a"];
  const count = Math.max(5, Math.min(9, Math.round(radius * 7)));
  for (let i = 0; i < count; i += 1) {
    const geometry = new THREE.ConeGeometry(0.075 + (i % 3) * 0.025, 0.36 + (i % 4) * 0.1, 6);
    const material = new THREE.MeshBasicMaterial({
      color: flameColors[i % flameColors.length],
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const flame = new THREE.Mesh(geometry, material);
    const angle = (i / count) * Math.PI * 2;
    const distance = radius * (0.15 + (i % 3) * 0.12);
    flame.position.set(Math.cos(angle) * distance, 0.2 + (i % 2) * 0.06, Math.sin(angle) * distance);
    flame.rotation.z = Math.sin(angle) * 0.17;
    flame.userData.firePhase = i * 0.9;
    group.add(flame);
    flames.push(flame);
  }
  const light = new THREE.PointLight("#ff8a35", 1.5, Math.max(1.5, radius * 5), 2);
  light.position.set(0, 0.75, 0);
  group.add(light);
  group.userData.fireEffect = { flames, light, phase: Math.random() * Math.PI * 2 } satisfies FireEffect;
  return group;
}

function createDrawingObject(item: Item, frame: SceneFrame): THREE.Object3D | null {
  const data = item as unknown as {
    type: string;
    position?: ScenePoint;
    rotation?: number;
    width?: number;
    height?: number;
    shapeType?: string;
    style?: Record<string, unknown>;
    startPosition?: ScenePoint;
    endPosition?: ScenePoint;
    points?: ScenePoint[];
    measurement?: string;
    text?: { plainText?: string };
    metadata?: Record<string, unknown>;
  };
  if (data.type === "SHAPE") {
    const style = data.style ?? {};
    const metadata = data.metadata?.[SCENE_TOOL_METADATA] as { kind?: string } | undefined;
    if (metadata?.kind === "fire") return createFireEffect(item, frame);
    const width = Math.max(1, Math.abs(data.width ?? 1)) * WORLD_UNITS_PER_PIXEL;
    const height = Math.max(1, Math.abs(data.height ?? 1)) * WORLD_UNITS_PER_PIXEL;
    const shape = new THREE.Shape();
    if (data.shapeType === "CIRCLE") {
      shape.absellipse(0, 0, width / 2, height / 2, 0, Math.PI * 2, false, 0);
    } else if (data.shapeType === "TRIANGLE") {
      shape.moveTo(0, height / 2);
      shape.lineTo(-width / 2, -height / 2);
      shape.lineTo(width / 2, -height / 2);
      shape.closePath();
    } else if (data.shapeType === "HEXAGON") {
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * width / 2;
        const y = Math.sin(angle) * height / 2;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
    } else {
      shape.moveTo(-width / 2, -height / 2);
      shape.lineTo(width / 2, -height / 2);
      shape.lineTo(width / 2, height / 2);
      shape.lineTo(-width / 2, height / 2);
      shape.closePath();
    }
    const group = new THREE.Group();
    const fillColor = String(style.fillColor ?? "#8bb8ff");
    const fillOpacity = Number(style.fillOpacity ?? 0.16);
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: fillColor, transparent: true, opacity: Number.isFinite(fillOpacity) ? fillOpacity : 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04;
    group.add(mesh);
    const outlinePoints = shape.getPoints(48).map((point) => new THREE.Vector3(point.x, 0.05, -point.y));
    if (outlinePoints.length > 1) {
      if (outlinePoints[0].distanceTo(outlinePoints[outlinePoints.length - 1]) > 1e-6) {
        outlinePoints.push(outlinePoints[0].clone());
      }
      const outline = createWorldPolyline(
        outlinePoints,
        String(style.strokeColor ?? "#8bb8ff"),
        Number(style.strokeOpacity ?? 1),
        Number(style.strokeWidth ?? 3),
      );
      if (outline) group.add(outline);
    }
    if (data.position) {
      const world = mapToWorld(data.position.x, data.position.y, frame);
      group.position.set(world.x, 0, world.z);
    }
    group.rotation.y = THREE.MathUtils.degToRad(data.rotation ?? 0);
    return group;
  }

  if (data.type === "LINE" || data.type === "RULER") {
    if (!data.startPosition || !data.endPosition) return null;
    const color = data.type === "RULER" ? "#9bc3ff" : String(data.style?.strokeColor ?? "#8bb8ff");
    const points = [data.startPosition, data.endPosition];
    const line = createPolyline(
      points,
      color,
      Number(data.style?.strokeOpacity ?? 1),
      Number(data.style?.strokeWidth ?? (data.type === "RULER" ? 2 : 3)),
    );
    if (!line) return null;
    const group = new THREE.Group();
    group.add(line);
    if (data.type === "RULER" && data.measurement) {
      const start = mapToWorld(data.startPosition.x, data.startPosition.y, frame);
      const end = mapToWorld(data.endPosition.x, data.endPosition.y, frame);
      const label = createTextSprite(data.measurement, "#dceaff");
      label.position.set((start.x + end.x) / 2, 0.42, (start.z + end.z) / 2);
      group.add(label);
    }
    return group;
  }

  if (data.type === "CURVE" && data.points?.length) {
    const points = data.points;
    const style = data.style ?? {};
    const line = createPolyline(
      points,
      String(style.strokeColor ?? "#8bb8ff"),
      Number(style.strokeOpacity ?? 1),
      Number(style.strokeWidth ?? 3),
    );
    if (!line) return null;
    const group = new THREE.Group();
    group.add(line);
    return group;
  }

  if ((data.type === "LABEL" || data.type === "TEXT") && data.position) {
    const text = data.text?.plainText;
    if (!text) return null;
    const world = mapToWorld(data.position.x, data.position.y, frame);
    const sprite = createTextSprite(text, "#f0f4ff");
    sprite.position.set(world.x, 0.36, world.z);
    return sprite;
  }
  return null;
}

function syncDrawingItems(items: Item[], frame: SceneFrame): void {
  const candidates = items.filter((item) =>
    item.visible !== false && (item.layer === "DRAWING" || item.layer === "RULER" || item.layer === "TEXT") &&
    ["SHAPE", "LINE", "CURVE", "RULER", "LABEL", "TEXT"].includes(item.type),
  );
  const allowedIds = new Set(candidates.map((item) => item.id));
  for (const [id, record] of drawingRecords) {
    if (!allowedIds.has(id)) {
      record.object.removeFromParent();
      disposeObjectTree(record.object);
      drawingRecords.delete(id);
    }
  }
  for (const item of candidates) {
    const signature = JSON.stringify(item);
    const existing = drawingRecords.get(item.id);
    if (existing?.signature === signature) continue;
    if (existing) {
      existing.object.removeFromParent();
      disposeObjectTree(existing.object);
      drawingRecords.delete(item.id);
    }
    const object = createDrawingObject(item, frame);
    if (!object) continue;
    object.userData.itemId = item.id;
    drawingRoot.add(object);
    drawingRecords.set(item.id, { object, signature });
    const fireData = object.userData.fireEffect as FireEffect | undefined;
    if (fireData) fireEffects.set(item.id, fireData);
  }
  for (const [id, effect] of fireEffects) {
    if (!drawingRecords.has(id)) fireEffects.delete(id);
    else if (drawingRecords.get(id)?.object.userData.fireEffect !== effect) {
      const updated = drawingRecords.get(id)?.object.userData.fireEffect as FireEffect | undefined;
      if (updated) fireEffects.set(id, updated);
      else fireEffects.delete(id);
    }
  }
}

function updateFireEffects(time: number): void {
  for (const effect of fireEffects.values()) {
    for (const flame of effect.flames) {
      const phase = Number(flame.userData.firePhase ?? 0);
      const flicker = 0.88 + Math.sin(time * 7 + phase) * 0.12 + Math.sin(time * 13 + phase * 1.7) * 0.05;
      flame.scale.y = flicker;
      flame.rotation.y = Math.sin(time * 3 + phase) * 0.35;
    }
    effect.light.intensity = 1.25 + (Math.sin(time * 8 + effect.phase) + 1) * 0.28;
  }
}

function clearWorld(): void {
  resetMapScalePreview();
  sceneToolGesture = null;
  clearToolPreview();
  if (measureReadout) measureReadout.hidden = true;
  controls.enabled = true;
  for (const record of records.values()) {
    record.object.removeFromParent();
    disposeRecord(record);
  }
  records.clear();
  for (const record of drawingRecords.values()) {
    record.object.removeFromParent();
    disposeObjectTree(record.object);
  }
  drawingRecords.clear();
  fireEffects.clear();
  for (const child of [...previewRoot.children]) {
    child.removeFromParent();
    disposeObjectTree(child);
  }

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
  latestSceneFrameSignature = null;
  cachedSceneFrameSignature = null;
  cachedSceneFrame = null;
  pendingSceneFrame = null;
  selectedTokenIds.clear();
  refreshTokenToolbar();
}

function fitCamera(frame: SceneFrame): void {
  const width = Math.max(frame.width * WORLD_UNITS_PER_PIXEL, 3);
  const height = Math.max(frame.height * WORLD_UNITS_PER_PIXEL, 3);
  const distance = Math.max(width, height) * 1.15 + 5;
  controls.maxDistance = Math.max(80, distance * 2.5);
  const requiredFar = Math.max(250, distance * 10);
  if (camera.far < requiredFar) {
    camera.far = requiredFar;
    camera.updateProjectionMatrix();
  }
  camera.position.set(distance * 0.65, distance * 0.85, distance * 0.72);
  controls.target.set(0, 0, 0);
  controls.update();
}

async function refreshGridSettings(): Promise<void> {
  const requestVersion = ++gridSettingsVersion;
  try {
    const [dpi, scale, measurement] = await Promise.all([
      OBR.scene.grid.getDpi(),
      OBR.scene.grid.getScale(),
      OBR.scene.grid.getMeasurement(),
    ]);
    if (requestVersion !== gridSettingsVersion) return;
    if (Number.isFinite(dpi) && dpi > 0) gridDpi = dpi;
    const measurementNames: Record<string, string> = {
      CHEBYSHEV: "xadrez",
      ALTERNATING: "diagonal alternada",
      EUCLIDEAN: "euclidiana",
      MANHATTAN: "Manhattan",
    };
    const gridInfo = document.querySelector<HTMLElement>("#grid-measurement-info");
    if (gridInfo) {
      gridInfo.textContent = `Grade: ${scale?.raw ?? "sem escala"} · Medição: ${measurementNames[measurement] ?? measurement}`;
    }
    const parsed = scale?.parsed;
    if (parsed) {
      gridScaleInfo = {
        multiplier: Number(parsed.multiplier) || 1,
        unit: String(parsed.unit ?? ""),
        digits: Number(parsed.digits) || 0,
      };
    } else {
      gridScaleInfo = null;
    }
  } catch (error) {
    if (requestVersion !== gridSettingsVersion) return;
    console.warn("[Sistema 3D] Não foi possível ler a configuração da grade:", error);
    gridScaleInfo = null;
  }
}

function hasVisionBlockingItems(items: Item[]): boolean {
  // Without a 3D visibility/occlusion implementation, even hidden vision items
  // are treated as blockers. Their hidden flag is not proof that they are inert.
  return items.some((item) =>
    item.layer === "FOG" || item.type === "WALL" || item.type === "LIGHT",
  );
}

async function checkFogSafety(items: Item[], isCurrent: () => boolean = () => true): Promise<boolean> {
  const playerRole = await OBR.player.getRole();
  if (!isCurrent()) return false;
  currentPlayerRole = playerRole;
  refreshTokenToolbar();
  const fogFilled = await OBR.scene.fog.getFilled();
  if (!isCurrent()) return false;
  const isFogScene = fogFilled || hasVisionBlockingItems(items);
  if (isFogScene) {
    blockedByFog = true;
    endTokenDrag();
    clearWorld();
    const detail = playerRole === "GM"
      ? "Esta sala possui Fog of War, paredes ou fontes de luz de visão. O protótipo ainda não reproduz a visibilidade dinâmica do Owlbear; a visualização foi bloqueada para evitar inconsistências. Remova/desative o Fog of War apenas em uma cópia de teste para experimentar o modo 3D."
      : "Esta sala utiliza Fog of War, paredes ou fontes de luz de visão. Como o protótipo ainda não reproduz a visibilidade dinâmica do Owlbear, o modo 3D foi bloqueado para impedir que áreas ocultas sejam reveladas. O mapa 2D continua funcionando normalmente.";
    showMessage("Modo 3D indisponível nesta cena", detail, "!");
    setStatus("Cena bloqueada por configuração de visão", "warning");
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
      setStatus("Aguardando cena do Owlbear", "warning");
      return;
    }

    const items = await OBR.scene.items.getItems();
    if (!isCurrent()) return;

    await refreshGridSettings();
    if (!isCurrent()) return;

    const safe = await checkFogSafety(items, isCurrent);
    if (!isCurrent()) return;
    if (safe) {
      await syncSceneWithResolvedFrame(items, isCurrent);
      if (!isCurrent()) return;
      // A primeira leitura da seleção pode terminar antes da criação dos meshes.
      // Releia depois do render inicial para refletir também seleções feitas no 2D.
      const selection = await OBR.player.getSelection();
      if (isCurrent()) syncSelectedTokens(selection ?? []);
    }
  } catch (error) {
    if (!isCurrent()) return;
    console.error("[Sistema 3D] Erro ao carregar a cena:", error);
    showMessage("Erro ao carregar a cena", "Não foi possível ler os dados desta sala. Verifique se a extensão está habilitada e tente novamente.");
    setStatus("Erro na leitura da cena", "error");
  }
}

function findTokenAtPointer(event: PointerEvent): RenderRecord | null {
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld(true);
  worldRoot.updateMatrixWorld(true);
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
  if (!Number.isFinite(hit.x) || !Number.isFinite(hit.z)) return null;
  const position = worldToMap(hit.x, hit.z, frame);
  return Number.isFinite(position.x) && Number.isFinite(position.y) ? position : null;
}

function clearToolPreview(): void {
  for (const child of [...previewRoot.children]) {
    child.removeFromParent();
    disposeObjectTree(child);
  }
}

function updateToolSettingsPanel(): void {
  const copy = TOOL_COPY[activeSceneTool];
  if (toolSettingsTitle) toolSettingsTitle.textContent = copy.title;
  if (toolSettingsDescription) toolSettingsDescription.textContent = copy.description;
  if (drawingSettings) drawingSettings.hidden = !["marker", "brush", "line", "rectangle", "circle", "triangle", "hexagon"].includes(activeSceneTool);
  if (measureSettings) measureSettings.hidden = activeSceneTool !== "measure";
  if (fireSettings) fireSettings.hidden = activeSceneTool !== "fire";
  if (textSettings) textSettings.hidden = activeSceneTool !== "text";
}

function setActiveSceneTool(tool: SceneTool): void {
  closeMapScalePanel();
  if (sceneToolGesture) {
    sceneToolGesture = null;
    clearToolPreview();
    if (measureReadout) measureReadout.hidden = true;
    controls.enabled = true;
  }
  endTokenDrag();
  activeSceneTool = tool;
  sceneToolButtons.forEach((button) => {
    const active = button.dataset.sceneTool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  canvas?.classList.toggle("tool-active", !["select", "pan"].includes(tool));
  canvas?.classList.toggle("tool-pan", tool === "pan");
  sceneToolsDock?.classList.toggle("tool-drawing-mode", ["measure", "marker", "brush", "line", "rectangle", "circle", "triangle", "hexagon", "fire", "text"].includes(tool));
  updateToolSettingsPanel();
  if (["select", "pan"].includes(tool)) {
    closeToolPanels();
  } else {
    if (toolSettingsPanel) toolSettingsPanel.hidden = false;
    if (integrationsPanel) integrationsPanel.hidden = true;
  }
}

function readDrawingSettings(): { stroke: string; fill: string; width: number; opacity: number } {
  return {
    stroke: strokeColorInput?.value || "#8bb8ff",
    fill: fillColorInput?.value || "#8bb8ff",
    width: Math.max(1, Number(strokeWidthInput?.value ?? 3)),
    opacity: THREE.MathUtils.clamp(Number(fillOpacityInput?.value ?? 25) / 100, 0, 1),
  };
}

async function snapToolPoint(point: ScenePoint): Promise<ScenePoint> {
  if (!snapGridInput?.checked) return point;
  try {
    return await OBR.scene.grid.snapPosition(point, 1, false, true);
  } catch (error) {
    console.warn("[Sistema 3D] Não foi possível ajustar o ponto à grade:", error);
    return point;
  }
}

function updateMeasureReadout(start: ScenePoint, end: ScenePoint, gesture: SceneToolGesture): void {
  if (!measureReadout) return;
  const requestId = ++gesture.requestId;
  void OBR.scene.grid.getDistance(start, end).then((distance) => {
    if (sceneToolGesture !== gesture || requestId !== gesture.requestId) return;
    measureReadout.textContent = formatGridDistance(distance, gridScaleInfo);
    measureReadout.hidden = false;
  }).catch((error) => {
    console.warn("[Sistema 3D] Falha ao medir distância:", error);
    if (sceneToolGesture === gesture && measureReadout) {
      measureReadout.textContent = "Não foi possível medir";
      measureReadout.hidden = false;
    }
  });
}

function updateSceneToolPreview(gesture: SceneToolGesture): void {
  clearToolPreview();
  const settings = readDrawingSettings();
  const frame = currentFrame;
  if (!frame) return;

  const markerPoints = gesture.tool === "marker"
    ? filterSceneStrokePoints(gesture.points, 3)
    : [gesture.start, gesture.current];

  if (gesture.tool === "measure" || gesture.tool === "line" || gesture.tool === "marker") {
    const line = createPolyline(
      markerPoints,
      gesture.tool === "measure" ? "#9bc3ff" : settings.stroke,
      0.95,
      gesture.tool === "measure" ? 2 : settings.width,
    );
    if (line) previewRoot.add(line);
    if (gesture.tool === "measure") updateMeasureReadout(gesture.start, gesture.current, gesture);
    return;
  }

  if (gesture.tool === "brush") {
    const brushPoints = filterSceneStrokePoints(gesture.points, 3);
    if (brushPoints.length >= 3) {
      const anchor = brushPoints[0];
      const anchorWorld = mapToWorld(anchor.x, anchor.y, frame);
      const shape = new THREE.Shape();
      brushPoints.forEach((point, index) => {
        const x = (point.x - anchor.x) * WORLD_UNITS_PER_PIXEL;
        const y = (point.y - anchor.y) * WORLD_UNITS_PER_PIXEL;
        if (index === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
      shape.closePath();
      const fill = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: settings.fill, transparent: true, opacity: Math.max(0.08, settings.opacity), side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(anchorWorld.x, 0.055, anchorWorld.z);
      previewRoot.add(fill);
      const outline = createPolyline([...brushPoints, brushPoints[0]], settings.stroke, 1, settings.width);
      if (outline) previewRoot.add(outline);
    } else {
      const line = createPolyline(brushPoints, settings.stroke, 0.95, settings.width);
      if (line) previewRoot.add(line);
    }
    return;
  }

  if (!["rectangle", "circle", "triangle", "hexagon"].includes(gesture.tool)) return;
  const shapeTool = gesture.tool as SceneShapeTool;
  const bounds = getSceneToolBounds(gesture.start, gesture.current);
  const center = mapToWorld(bounds.center.x, bounds.center.y, frame);
  const worldWidth = bounds.width * WORLD_UNITS_PER_PIXEL;
  const worldHeight = bounds.height * WORLD_UNITS_PER_PIXEL;
  const vertices = getSceneShapeVertices(shapeTool, gesture.start, gesture.current);
  let geometry: THREE.BufferGeometry;

  if (shapeTool === "circle") {
    geometry = new THREE.CircleGeometry(Math.max(worldWidth, worldHeight) / 2, 48);
  } else {
    const shape = new THREE.Shape();
    vertices.slice(0, -1).forEach((point, index) => {
      const x = (point.x - bounds.center.x) * WORLD_UNITS_PER_PIXEL;
      const y = (point.y - bounds.center.y) * WORLD_UNITS_PER_PIXEL;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    geometry = new THREE.ShapeGeometry(shape);
  }

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: settings.fill,
      transparent: true,
      opacity: Math.max(0.08, settings.opacity),
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, 0.055, center.z);
  previewRoot.add(mesh);
  const outline = createPolyline(vertices, settings.stroke, 1, settings.width);
  if (outline) previewRoot.add(outline);
}

async function addSceneItems(
  items: Item[],
  permission: "DRAWING_CREATE" | "RULER_CREATE" | "TEXT_CREATE",
  expectedSceneVersion = sceneSessionVersion,
): Promise<void> {
  try {
    if (!await OBR.player.hasPermission(permission)) {
      notify("Você não tem permissão para criar este tipo de item nesta cena.");
      return;
    }
    const sceneReady = await OBR.scene.isReady();
    if (expectedSceneVersion !== sceneSessionVersion || !sceneReady || blockedByFog) {
      notify("A cena mudou ou ficou indisponível. A criação foi cancelada.");
      return;
    }
    await OBR.scene.items.addItems(items);
    if (expectedSceneVersion !== sceneSessionVersion || viewerDisposed) return;
    lastCreatedSceneItemIds = items.map((item) => item.id);
    if (toolUndoButton) toolUndoButton.disabled = false;
    notify(items.length > 1 ? "Elementos adicionados à cena." : "Item adicionado à cena.");
  } catch (error) {
    console.error("[Sistema 3D] Falha ao criar item:", error);
    notify("Não foi possível adicionar o item à cena.");
  }
}

async function createSceneDrawing(gesture: SceneToolGesture): Promise<void> {
  if (!currentFrame || blockedByFog) return;
  const expectedSceneVersion = sceneSessionVersion;
  const settings = readDrawingSettings();
  try {
    if (gesture.tool === "measure") {
      const [start, end, distance] = await Promise.all([
        snapToolPoint(gesture.start),
        snapToolPoint(gesture.current),
        OBR.scene.grid.getDistance(gesture.start, gesture.current),
      ]);
      const measurement = formatGridDistance(distance, gridScaleInfo);
      if (measurePersistInput?.checked) {
        const ruler = buildRuler()
          .startPosition(start)
          .endPosition(end)
          .measurement(measurement)
          .variant("DASHED")
          .name("Régua 3D")
          .layer("RULER")
          .build();
        await addSceneItems([ruler], "RULER_CREATE", expectedSceneVersion);
      } else {
        if (measureReadout) {
          measureReadout.textContent = measurement;
          measureReadout.hidden = false;
          window.setTimeout(() => {
            if (measureReadout) measureReadout.hidden = true;
          }, 1800);
        }
        notify(`Distância: ${measurement}`);
      }
      return;
    }

    const start = await snapToolPoint(gesture.start);
    const end = await snapToolPoint(gesture.current);
    if (gesture.tool === "line") {
      const line = buildLine()
        .startPosition(start)
        .endPosition(end)
        .strokeColor(settings.stroke)
        .strokeOpacity(1)
        .strokeWidth(settings.width)
        .layer("DRAWING")
        .name("Linha 3D")
        .build();
      await addSceneItems([line], "DRAWING_CREATE", expectedSceneVersion);
      return;
    }
    if (gesture.tool === "marker" || gesture.tool === "brush") {
      const rawPoints = filterSceneStrokePoints(gesture.points, 2);
      const points = await Promise.all(rawPoints.map(snapToolPoint));
      const minimumPoints = gesture.tool === "brush" ? 3 : 2;
      if (points.length < minimumPoints) {
        if (gesture.tool === "brush") notify("O pincel preenchido precisa de pelo menos três pontos distintos.");
        return;
      }
      const curve = buildCurve()
        .points(points)
        .tension(0.2)
        .closed(gesture.tool === "brush")
        .fillColor(settings.fill)
        .fillOpacity(gesture.tool === "brush" ? settings.opacity : 0)
        .strokeColor(settings.stroke)
        .strokeOpacity(1)
        .strokeWidth(settings.width)
        .layer("DRAWING")
        .name(gesture.tool === "brush" ? "Pincel 3D" : "Marcador 3D")
        .build();
      await addSceneItems([curve], "DRAWING_CREATE", expectedSceneVersion);
      return;
    }
    if (["rectangle", "circle", "triangle", "hexagon"].includes(gesture.tool)) {
      const bounds = getSceneToolBounds(start, end);
      const circleDiameter = Math.max(bounds.width, bounds.height);
      const shapeType = gesture.tool === "circle" ? "CIRCLE"
        : gesture.tool === "triangle" ? "TRIANGLE"
        : gesture.tool === "hexagon" ? "HEXAGON"
        : "RECTANGLE";
      const dimension = gesture.tool === "circle" ? circleDiameter : null;
      const shape = buildShape()
        .position(bounds.center)
        .width(dimension ?? bounds.width)
        .height(dimension ?? bounds.height)
        .shapeType(shapeType)
        .fillColor(settings.fill)
        .fillOpacity(settings.opacity)
        .strokeColor(settings.stroke)
        .strokeOpacity(1)
        .strokeWidth(settings.width)
        .layer("DRAWING")
        .name(`${TOOL_COPY[gesture.tool].title} 3D`)
        .build();
      await addSceneItems([shape], "DRAWING_CREATE", expectedSceneVersion);
    }
  } catch (error) {
    console.error("[Sistema 3D] Falha ao finalizar ferramenta:", error);
    notify("Não foi possível finalizar a ferramenta.");
  }
}

async function createFireAt(point: ScenePoint): Promise<void> {
  if (!currentFrame || blockedByFog) return;
  const expectedSceneVersion = sceneSessionVersion;
  const snapped = await snapToolPoint(point);
  if (expectedSceneVersion !== sceneSessionVersion || blockedByFog) return;
  const radiusCells = Math.max(1, Number(fireRadiusInput?.value ?? 2));
  const radiusPixels = Math.max(1, gridDpi) * radiusCells;
  const zone = buildShape()
    .position(snapped)
    .width(radiusPixels * 2)
    .height(radiusPixels * 2)
    .shapeType("CIRCLE")
    .fillColor("#ff782e")
    .fillOpacity(0.12)
    .strokeColor("#ffb56d")
    .strokeOpacity(0.9)
    .strokeWidth(4)
    .name("Área de fogo 3D")
    .metadata({ [SCENE_TOOL_METADATA]: { kind: "fire", radiusPixels, version: 1 } })
    .layer("DRAWING")
    .build();
  const marker = buildLabel()
    .plainText("FOGO")
    .position(snapped)
    .backgroundColor("#3b1d15")
    .backgroundOpacity(0.88)
    .fillColor("#ffe1c4")
    .fontSize(18)
    .name("Marcador de fogo")
    .layer("DRAWING")
    .build();
  await addSceneItems([zone, marker], "DRAWING_CREATE", expectedSceneVersion);
}

async function createSceneTextAt(point: ScenePoint): Promise<void> {
  const expectedSceneVersion = sceneSessionVersion;
  if (blockedByFog || !currentFrame) return;
  const value = sceneTextInput?.value.trim() ?? "";
  if (!value) {
    notify("Escreva o texto no painel de configurações antes de inseri-lo.");
    return;
  }
  const position = await snapToolPoint(point);
  if (expectedSceneVersion !== sceneSessionVersion || blockedByFog) return;
  const label = buildLabel()
    .plainText(value)
    .position(position)
    .backgroundColor("#142033")
    .backgroundOpacity(0.9)
    .fillColor("#f1f5fb")
    .fontSize(18)
    .name("Anotação 3D")
    .layer("DRAWING")
    .build();
  await addSceneItems([label], "DRAWING_CREATE", expectedSceneVersion);
}

function startSceneToolGesture(event: PointerEvent): void {
  const frame = currentFrame;
  if (!frame) return;
  const point = getMapPositionAtPointer(event, frame);
  if (!point) {
    notify("Não foi possível identificar o ponto no tabuleiro.");
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    renderer.domElement.setPointerCapture(event.pointerId);
  } catch (error) {
    console.warn("[Sistema 3D] Captura de ponteiro indisponível:", error);
  }
  if (activeSceneTool === "fire") {
    void createFireAt(point);
    return;
  }
  if (activeSceneTool === "text") {
    void createSceneTextAt(point);
    return;
  }
  const gesture: SceneToolGesture = {
    pointerId: event.pointerId,
    tool: activeSceneTool,
    start: point,
    current: point,
    points: [point],
    requestId: 0,
  };
  sceneToolGesture = gesture;
  controls.enabled = false;
  updateSceneToolPreview(gesture);
}

function moveSceneToolGesture(event: PointerEvent): void {
  const gesture = sceneToolGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const point = getMapPositionAtPointer(event, currentFrame!);
  if (!point) return;
  gesture.current = point;
  if (gesture.tool === "marker") {
    const last = gesture.points[gesture.points.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 3) gesture.points.push(point);
  }
  updateSceneToolPreview(gesture);
}

function endSceneToolGesture(event: PointerEvent, cancelled = false): void {
  const gesture = sceneToolGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const finalPoint = getMapPositionAtPointer(event, currentFrame!);
  if (finalPoint) {
    gesture.current = finalPoint;
    if (gesture.tool === "marker") gesture.points.push(finalPoint);
  }
  sceneToolGesture = null;
  controls.enabled = true;
  clearToolPreview();
  if (gesture.tool !== "measure" && measureReadout) measureReadout.hidden = true;
  if (cancelled) {
    if (measureReadout) measureReadout.hidden = true;
    return;
  }
  void createSceneDrawing(gesture);
}

function closeMapScalePanel(): void {
  if (mapScalePanel) mapScalePanel.hidden = true;
  mapScaleToggle?.setAttribute("aria-expanded", "false");
  if (!mapScaleCommitInProgress) resetMapScalePreview();
}

function openMapScalePanel(): void {
  if (mapScaleCommitInProgress) return;
  closeMapScalePanel();
  if (toolSettingsPanel) toolSettingsPanel.hidden = true;
  if (integrationsPanel) integrationsPanel.hidden = true;
  if (mapScalePanel) mapScalePanel.hidden = false;
  mapScaleToggle?.setAttribute("aria-expanded", "true");
  toolSettingsToggle?.setAttribute("aria-expanded", "false");
  integrationsToggle?.setAttribute("aria-expanded", "false");
}

async function applyMapScaleFromSlider(): Promise<void> {
  if (!mapScaleInput || mapScaleCommitInProgress) return;
  const percent = THREE.MathUtils.clamp(Number(mapScaleInput.value) || 100, 50, 200);
  const factor = percent / 100;
  if (Math.abs(factor - 1) < 1e-6) {
    resetMapScalePreview();
    return;
  }

  const expectedSceneVersion = sceneSessionVersion;
  mapScaleCommitInProgress = true;
  mapScaleInput.disabled = true;
  if (mapScaleToggle) mapScaleToggle.disabled = true;

  try {
    const [ready, allowed, items] = await Promise.all([
      OBR.scene.isReady(),
      OBR.player.hasPermission("MAP_UPDATE"),
      OBR.scene.items.getItems(),
    ]);
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !ready) {
      notify("A cena mudou ou não está disponível. O redimensionamento foi cancelado.");
      return;
    }
    if (!allowed) {
      notify("Você não tem permissão para redimensionar mapas nesta cena.");
      return;
    }

    const mapItems = getSceneImages(items).filter((item) =>
      item.layer === "MAP" && item.image.mime.startsWith("image/") &&
      item.image.width > 0 && item.image.height > 0,
    );
    if (mapItems.length === 0) {
      notify("Não há imagens visíveis na camada MAP para redimensionar.");
      return;
    }

    const bounds = await OBR.scene.items.getItemBounds(mapItems.map((item) => item.id));
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !await OBR.scene.isReady()) {
      notify("A cena mudou durante o redimensionamento. A operação foi cancelada.");
      return;
    }
    const center = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
    };
    const transforms = scaleMapLayout(mapItems, center, factor);
    const transformsById = new Map(transforms.map((transform) => [transform.id, transform]));

    await OBR.scene.items.updateItems(mapItems, (draft) => {
      for (const item of draft) {
        const transform = transformsById.get(item.id);
        if (!transform) continue;
        item.position = transform.position;
        item.scale = transform.scale;
      }
    });

    if (expectedSceneVersion === sceneSessionVersion) {
      notify(`${mapItems.length} ${mapItems.length === 1 ? "imagem de mapa redimensionada" : "imagens de mapa redimensionadas"} para ${percent}%.`);
    }
  } catch (error) {
    console.error("[Sistema 3D] Falha ao redimensionar os mapas:", error);
    notify("Não foi possível redimensionar os mapas. Verifique a permissão MAP_UPDATE.");
  } finally {
    mapScaleCommitInProgress = false;
    resetMapScalePreview();
    if (mapScaleToggle) mapScaleToggle.disabled = false;
  }
}

function openToolSettings(): void {
  closeMapScalePanel();
  if (toolSettingsPanel) toolSettingsPanel.hidden = false;
  if (integrationsPanel) integrationsPanel.hidden = true;
  toolSettingsToggle?.setAttribute("aria-expanded", "true");
  integrationsToggle?.setAttribute("aria-expanded", "false");
  updateToolSettingsPanel();
}

function closeToolPanels(): void {
  closeMapScalePanel();
  if (toolSettingsPanel) toolSettingsPanel.hidden = true;
  if (integrationsPanel) integrationsPanel.hidden = true;
  toolSettingsToggle?.setAttribute("aria-expanded", "false");
  integrationsToggle?.setAttribute("aria-expanded", "false");
}

async function undoLastSceneToolItem(): Promise<void> {
  const expectedSceneVersion = sceneSessionVersion;
  if (lastCreatedSceneItemIds.length === 0) {
    notify("Não há item recente para desfazer.");
    return;
  }
  try {
    const items = await OBR.scene.items.getItems(lastCreatedSceneItemIds);
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog) return;
    if (items.length === 0) {
      lastCreatedSceneItemIds = [];
      if (toolUndoButton) toolUndoButton.disabled = true;
      return;
    }
    const permissionByLayer: Record<string, string> = {
      DRAWING: "DRAWING_DELETE",
      RULER: "RULER_DELETE",
      TEXT: "TEXT_DELETE",
    };
    const permissions = [...new Set(items.map((item) => permissionByLayer[item.layer]).filter(Boolean))];
    const results = await Promise.all(permissions.map((permission) => OBR.player.hasPermission(permission as "DRAWING_DELETE" | "RULER_DELETE" | "TEXT_DELETE")));
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !await OBR.scene.isReady()) return;
    if (results.some((allowed) => !allowed)) {
      notify("Você não tem permissão para desfazer a criação desses itens.");
      return;
    }
    await OBR.scene.items.deleteItems(items.map((item) => item.id));
    lastCreatedSceneItemIds = [];
    if (toolUndoButton) toolUndoButton.disabled = true;
    notify("Última criação desfeita.");
  } catch (error) {
    console.error("[Sistema 3D] Falha ao desfazer criação:", error);
    notify("Não foi possível desfazer a última criação.");
  }
}

type TokenPermission = "CHARACTER_UPDATE" | "CHARACTER_DELETE" | "MOUNT_UPDATE" | "MOUNT_DELETE";

const UPDATE_PERMISSION_BY_LAYER: Record<string, string> = {
  MAP: "MAP_UPDATE",
  DRAWING: "DRAWING_UPDATE",
  PROP: "PROP_UPDATE",
  MOUNT: "MOUNT_UPDATE",
  CHARACTER: "CHARACTER_UPDATE",
  ATTACHMENT: "ATTACHMENT_UPDATE",
  NOTE: "NOTE_UPDATE",
  TEXT: "TEXT_UPDATE",
  RULER: "RULER_UPDATE",
  FOG: "FOG_UPDATE",
  POINTER: "POINTER_UPDATE",
};

const DELETE_PERMISSION_BY_LAYER: Record<string, string> = {
  MAP: "MAP_DELETE",
  DRAWING: "DRAWING_DELETE",
  PROP: "PROP_DELETE",
  MOUNT: "MOUNT_DELETE",
  CHARACTER: "CHARACTER_DELETE",
  ATTACHMENT: "ATTACHMENT_DELETE",
  NOTE: "NOTE_DELETE",
  TEXT: "TEXT_DELETE",
  RULER: "RULER_DELETE",
  FOG: "FOG_DELETE",
  POINTER: "POINTER_DELETE",
};

function getTokenPermission(item: Item, operation: "UPDATE" | "DELETE"): TokenPermission {
  return item.layer === "CHARACTER"
    ? operation === "UPDATE" ? "CHARACTER_UPDATE" : "CHARACTER_DELETE"
    : operation === "UPDATE" ? "MOUNT_UPDATE" : "MOUNT_DELETE";
}

async function getPermittedTokenItems(items: Item[], operation: "UPDATE" | "DELETE"): Promise<Item[]> {
  const requiredPermissions = [...new Set(items.map((item) => getTokenPermission(item, operation)))];
  const [permissionResults, ownerOnly, role] = await Promise.all([
    Promise.all(requiredPermissions.map(async (permission) =>
      [permission, await OBR.player.hasPermission(permission)] as const)),
    items.some((item) => item.layer === "CHARACTER")
      ? OBR.player.hasPermission("CHARACTER_OWNER_ONLY")
      : Promise.resolve(false),
    OBR.player.getRole(),
  ]);
  const allowedPermissions = new Set(
    permissionResults.filter(([, allowed]) => allowed).map(([permission]) => permission),
  );
  return items.filter((item) => {
    if (!allowedPermissions.has(getTokenPermission(item, operation))) return false;
    if (item.layer === "CHARACTER" &&
        !canModifyCharacter(role, ownerOnly, item.createdUserId, OBR.player.id)) return false;
    return true;
  });
}

async function getPermittedAttachedItems(items: Item[]): Promise<Item[]> {
  if (items.length === 0) return [];
  const permissions = new Map<Item, string>();
  for (const item of items) {
    const permission = UPDATE_PERMISSION_BY_LAYER[item.layer];
    if (!permission) return [];
    permissions.set(item, permission);
  }
  const requiredPermissions = [...new Set(permissions.values())];
  const [permissionResults, ownerOnly, role] = await Promise.all([
    Promise.all(requiredPermissions.map(async (permission) =>
      [permission, await OBR.player.hasPermission(permission as "ATTACHMENT_UPDATE")] as const)),
    items.some((item) => item.layer === "CHARACTER")
      ? OBR.player.hasPermission("CHARACTER_OWNER_ONLY")
      : Promise.resolve(false),
    OBR.player.getRole(),
  ]);
  const allowedPermissions = new Set(permissionResults.filter(([, allowed]) => allowed).map(([permission]) => permission));
  return items.filter((item) => {
    if (!allowedPermissions.has(permissions.get(item)!)) return false;
    if (item.locked) return false;
    if (item.layer === "CHARACTER" &&
        !canModifyCharacter(role, ownerOnly, item.createdUserId, OBR.player.id)) return false;
    return true;
  });
}

async function canDeleteAttachedItems(items: Item[]): Promise<boolean> {
  if (items.length === 0) return true;
  const requiredPermissions = new Set<string>();
  for (const item of items) {
    const permission = DELETE_PERMISSION_BY_LAYER[item.layer];
    if (!permission) return false;
    requiredPermissions.add(permission);
  }
  const permissionResults = await Promise.all(
    [...requiredPermissions].map(async (permission) =>
      [permission, await OBR.player.hasPermission(permission as "MAP_DELETE")] as const),
  );
  const allowed = new Set(permissionResults.filter(([, result]) => result).map(([permission]) => permission));
  if (items.some((item) => !allowed.has(DELETE_PERMISSION_BY_LAYER[item.layer]))) return false;

  const characterOwnerOnly = items.some((item) => item.layer === "CHARACTER")
    ? await OBR.player.hasPermission("CHARACTER_OWNER_ONLY")
    : false;
  if (!characterOwnerOnly) return true;
  const role = await OBR.player.getRole();
  return items.every((item) =>
    item.layer !== "CHARACTER" ||
    canModifyCharacter(role, characterOwnerOnly, item.createdUserId, OBR.player.id),
  );
}

async function canUpdateTokenItems(items: Item[], operation: "UPDATE" | "DELETE"): Promise<boolean> {
  const permittedItems = await getPermittedTokenItems(items, operation);
  return permittedItems.length === items.length;
}

async function rotateSelectedTokens(amount: number): Promise<void> {
  const expectedSceneVersion = sceneSessionVersion;
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
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !await OBR.scene.isReady()) return;
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

async function scaleSelectedTokens(factor: number): Promise<void> {
  const expectedSceneVersion = sceneSessionVersion;
  const items = getSelectedTokenItems();
  if (items.length === 0) return;
  if (items.some((item) => item.locked)) {
    notify("Desbloqueie os tokens antes de redimensioná-los.");
    return;
  }
  try {
    if (!await canUpdateTokenItems(items, "UPDATE")) {
      notify("Você não tem permissão para redimensionar todos os tokens selecionados.");
      return;
    }
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !await OBR.scene.isReady()) return;
    const ids = new Set(items.map((item) => item.id));
    await OBR.scene.items.updateItems(items, (draft) => {
      for (const item of draft) {
        if (!ids.has(item.id)) continue;
        item.scale = {
          x: THREE.MathUtils.clamp(item.scale.x * factor, 0.05, 20),
          y: THREE.MathUtils.clamp(item.scale.y * factor, 0.05, 20),
        };
      }
    });
  } catch (error) {
    console.error("[Sistema 3D] Falha ao redimensionar tokens:", error);
    notify("Não foi possível redimensionar os tokens selecionados.");
  }
}

async function toggleSelectedTokenLock(): Promise<void> {
  const expectedSceneVersion = sceneSessionVersion;
  const items = getSelectedTokenItems();
  if (items.length === 0) return;
  try {
    if (!await canUpdateTokenItems(items, "UPDATE")) {
      notify("Você não tem permissão para bloquear ou desbloquear todos os tokens selecionados.");
      return;
    }
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !await OBR.scene.isReady()) return;
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
  const expectedSceneVersion = sceneSessionVersion;
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
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !await OBR.scene.isReady()) return;
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
  const expectedSceneVersion = sceneSessionVersion;
  const items = getSelectedTokenItems();
  if (items.length === 0) return;
  try {
    if (!await canUpdateTokenItems(items, "DELETE")) {
      notify("Você não tem permissão para excluir todos os tokens selecionados.");
      return;
    }
    const count = items.length;
    if (!window.confirm("Excluir " + count + (count === 1 ? " token selecionado?" : " tokens selecionados?"))) return;
    const ids = items.map((item) => item.id);
    const attachments = await OBR.scene.items.getItemAttachments(ids);
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog) return;
    const selectedIds = new Set(ids);
    const attachmentItems = attachments.filter((item) => !selectedIds.has(item.id));
    if (!await canDeleteAttachedItems(attachmentItems)) {
      notify("A exclusão foi cancelada: você não tem permissão para remover todos os anexos desses tokens.");
      return;
    }
    if (expectedSceneVersion !== sceneSessionVersion || blockedByFog || !await OBR.scene.isReady()) return;
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

function finishPendingPointerGesture(gesture: PointerDragGesture): void {
  gesture.cancel();
  if (activePointerGesture === gesture) activePointerGesture = null;
  if (pendingTokenDrag?.gesture === gesture) pendingTokenDrag = null;
  if (dragState?.pointerId === gesture.pointerId) endTokenDrag();
  else controls.enabled = true;
}

function requestPendingTokenDrag(gesture: PointerDragGesture): void {
  const pending = pendingTokenDrag;
  if (!pending || pending.gesture !== gesture || !gesture.requestStart()) return;
  void beginTokenDrag(pending.record, pending.gesture, pending.selectedIds, pending.startPosition);
}

async function beginTokenDrag(
  record: RenderRecord,
  gesture: PointerDragGesture,
  selectedIds: string[],
  startPosition: { x: number; y: number },
): Promise<void> {
  const frame = currentFrame;
  if (!frame || dragState || !gesture.isActive || activePointerGesture !== gesture) {
    finishPendingPointerGesture(gesture);
    return;
  }

  const clickedId = record.mesh.userData.itemId as string;
  const clickedItem = currentItems.find((item) => item.id === clickedId);
  if (!clickedItem || clickedItem.locked) {
    if (clickedItem?.locked) notify("Este token está bloqueado. Desbloqueie-o para movê-lo.");
    finishPendingPointerGesture(gesture);
    return;
  }

  try {
    const selectedItems = selectedIds
      .map((id) => currentItems.find((item) => item.id === id))
      .filter((item): item is Item => item !== undefined &&
        (item.layer === "CHARACTER" || item.layer === "MOUNT") &&
        item.type === "IMAGE" && "image" in item);
    const unlockedItems = selectedItems.filter((item) => !item.locked);
    const movableItems = await getPermittedTokenItems(unlockedItems, "UPDATE");

    if (!gesture.isActive || activePointerGesture !== gesture) {
      finishPendingPointerGesture(gesture);
      return;
    }
    if (movableItems.length < selectedItems.length) {
      notify("Tokens bloqueados ou sem permissão foram ignorados no arraste.");
    }
    if (movableItems.length === 0) {
      notify("Nenhum token selecionado pode ser movido.");
      finishPendingPointerGesture(gesture);
      return;
    }

    // A interação só é solicitada depois de movimento real. Se o dedo já foi
    // solto enquanto o SDK inicializava, o último ponto ainda será aplicado.

    // O caminho rápido de interação do SDK não recalcula a hierarquia de
    // anexos. Incluímos os anexos/subanexos e deslocamos tudo pelo mesmo delta.
    const movableIds = movableItems.map((item) => item.id);
    const [selectedState, attachmentState] = await Promise.all([
      OBR.scene.items.getItems(movableIds),
      OBR.scene.items.getItemAttachments(movableIds),
    ]);
    if (!gesture.isActive || activePointerGesture !== gesture) {
      finishPendingPointerGesture(gesture);
      return;
    }
    if (gesture.released && !gesture.shouldMove) {
      finishPendingPointerGesture(gesture);
      return;
    }

    const stateById = new Map<string, Item>();
    for (const item of [...attachmentState, ...selectedState]) stateById.set(item.id, item);
    const baseState = [...stateById.values()];
    if (baseState.length === 0) {
      finishPendingPointerGesture(gesture);
      return;
    }

    const rootIds = new Set(movableIds);
    const attachedItems = baseState.filter((item) => !rootIds.has(item.id));
    const permittedAttachments = await getPermittedAttachedItems(attachedItems);
    if (!gesture.isActive || activePointerGesture !== gesture) {
      finishPendingPointerGesture(gesture);
      return;
    }
    if (permittedAttachments.length !== attachedItems.length) {
      notify("Não foi possível mover o grupo: um ou mais anexos estão bloqueados ou sem permissão de atualização.");
      finishPendingPointerGesture(gesture);
      return;
    }

    const [dispatch, stop] = await OBR.interaction.startItemInteraction(baseState);
    if (!gesture.isActive || activePointerGesture !== gesture || (gesture.released && !gesture.shouldMove)) {
      stop();
      finishPendingPointerGesture(gesture);
      return;
    }

    dragState = {
      itemIds: baseState.map((item) => item.id),
      frame,
      initialPositions: baseState.map((item) => ({ id: item.id, x: item.position.x, y: item.position.y })),
      startPosition,
      dispatch,
      stop,
      pointerId: gesture.pointerId,
    };
    controls.enabled = false;

    // O dedo pode ter percorrido boa parte do mapa enquanto o SDK resolvia as
    // permissões e inicializava a interação. Aplique imediatamente o ponto mais
    // recente para que o token acompanhe o dedo desde o começo do gesto.
    if (gesture.shouldMove) {
      moveDraggedTokenAt(gesture.current.clientX, gesture.current.clientY);
    }

    // O dedo também pode ter sido solto durante a inicialização assíncrona.
    // Nesse caso aplicamos a última posição acima e encerramos sem perder o drag.
    if (gesture.released) {
      endTokenDrag();
      if (activePointerGesture === gesture) activePointerGesture = null;
    }
  } catch (error) {
    if (!gesture.isActive || activePointerGesture !== gesture) {
      finishPendingPointerGesture(gesture);
      return;
    }
    console.error("[Sistema 3D] Falha ao iniciar interação dos tokens:", error);
    notify("Não foi possível iniciar a movimentação. Tente arrastar novamente.");
    finishPendingPointerGesture(gesture);
  }
}

function moveDraggedTokenAt(clientX: number, clientY: number): void {
  if (!dragState) return;
  const activeDrag = dragState;
  const syntheticPointer = { clientX, clientY } as PointerEvent;
  const position = getMapPositionAtPointer(syntheticPointer, activeDrag.frame);
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

function moveDraggedToken(event: PointerEvent): void {
  moveDraggedTokenAt(event.clientX, event.clientY);
}

function endTokenDrag(): void {
  pendingTokenDrag = null;
  if (dragState) {
    try {
      dragState.stop();
    } catch (error) {
      console.error("[Sistema 3D] Erro ao finalizar interação:", error);
    }
    dragState = null;
  }
  activePointerGesture?.cancel();
  activePointerGesture = null;
  controls.enabled = true;
}

renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
  // Toque primário e botão esquerdo do mouse iniciam o mesmo gesto de arraste.
  // Segundo dedo continua disponível para o OrbitControls tratar gestos de câmera.
  if (blockedByFog || activePointerGesture || sceneToolGesture ||
      (event.pointerType === "mouse" && event.button !== 0) || event.isPrimary === false) return;
  if (activeSceneTool === "pan") return;
  if (activeSceneTool !== "select") {
    startSceneToolGesture(event);
    return;
  }

  const record = findTokenAtPointer(event);
  if (!record) {
    if (event.button === 0) {
      emptyClickCandidate = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    }
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  emptyClickCandidate = null;

  const frame = currentFrame;
  const startPosition = frame ? getMapPositionAtPointer(event, frame) : null;
  if (!frame || !startPosition) {
    notify("Não foi possível calcular a posição do toque no tabuleiro.");
    return;
  }

  const itemId = record.mesh.userData.itemId as string;
  const current = [...selectedTokenIds];
  const toggle = event.ctrlKey || event.metaKey;
  const alreadySelected = current.includes(itemId);
  const next = toggle
    ? nextTokenSelection(current, itemId, { additive: false, toggle: true })
    : event.shiftKey
      ? nextTokenSelection(current, itemId, { additive: true, toggle: false })
      : alreadySelected ? current : [itemId];

  syncSelectedTokens(next);
  if (toggle && alreadySelected) {
    void OBR.player.deselect([itemId]).catch((error) => {
      console.warn("[Sistema 3D] Não foi possível atualizar a seleção:", error);
    });
    return;
  }

  const gesture = new PointerDragGesture(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  });
  activePointerGesture = gesture;
  pendingTokenDrag = { record, gesture, selectedIds: next, startPosition };
  controls.enabled = false;

  // Capturar o ponteiro faz o canvas continuar recebendo os movimentos mesmo
  // quando o dedo sai visualmente de cima da miniatura.
  try {
    renderer.domElement.setPointerCapture(event.pointerId);
  } catch (error) {
    console.warn("[Sistema 3D] Não foi possível capturar o toque:", error);
  }

  // Atualize a seleção do Owlbear sem bloquear o início do arraste. A espera
  // pela rede/API de seleção não pode fazer o dedo "perder" os primeiros pixels.
  void OBR.player.select(next, true).catch((error) => {
    console.warn("[Sistema 3D] Não foi possível sincronizar a seleção:", error);
  });
}, { capture: true });

window.addEventListener("pointermove", (event: PointerEvent) => {
  if (sceneToolGesture?.pointerId === event.pointerId) {
    event.preventDefault();
    moveSceneToolGesture(event);
    return;
  }
  if (emptyClickCandidate?.pointerId === event.pointerId) {
    const dx = event.clientX - emptyClickCandidate.x;
    const dy = event.clientY - emptyClickCandidate.y;
    if (Math.hypot(dx, dy) > 5) emptyClickCandidate = null;
  }

  const gesture = activePointerGesture;
  if (gesture?.pointerId === event.pointerId && gesture.isActive) {
    event.preventDefault();
    gesture.move({ clientX: event.clientX, clientY: event.clientY });
    if (gesture.shouldMove) requestPendingTokenDrag(gesture);
    if (dragState?.pointerId === event.pointerId && gesture.shouldMove) {
      moveDraggedToken(event);
    }
  }
}, { capture: true });

window.addEventListener("pointerup", (event: PointerEvent) => {
  if (sceneToolGesture?.pointerId === event.pointerId) {
    endSceneToolGesture(event);
    return;
  }
  const wasEmptyClick = emptyClickCandidate?.pointerId === event.pointerId;
  emptyClickCandidate = null;

  const gesture = activePointerGesture;
  if (gesture?.pointerId === event.pointerId) {
    gesture.release({ clientX: event.clientX, clientY: event.clientY });

    if (gesture.shouldMove) requestPendingTokenDrag(gesture);
    if (dragState?.pointerId === event.pointerId) {
      if (gesture.shouldMove) moveDraggedTokenAt(gesture.current.clientX, gesture.current.clientY);
      endTokenDrag();
      activePointerGesture = null;
    } else if (!gesture.shouldMove) {
      // Um toque sem deslocamento seleciona, mas não cria uma interação de rede.
      finishPendingPointerGesture(gesture);
    }
    // Se startItemInteraction ainda está resolvendo, mantemos o gesto liberado
    // vivo. beginTokenDrag aplicará sua posição final assim que o SDK responder.
  }

  if (wasEmptyClick) {
    void OBR.player.deselect().then(() => syncSelectedTokens([])).catch((error) => {
      console.warn("[Sistema 3D] Não foi possível limpar a seleção:", error);
    });
  }
}, { capture: true });

window.addEventListener("pointercancel", (event: PointerEvent) => {
  if (sceneToolGesture?.pointerId === event.pointerId) endSceneToolGesture(event, true);
  emptyClickCandidate = null;
  const gesture = activePointerGesture;
  if (gesture?.pointerId === event.pointerId) {
    gesture.cancel();
    if (pendingTokenDrag?.gesture === gesture) pendingTokenDrag = null;
    activePointerGesture = null;
  }
  if (dragState?.pointerId === event.pointerId) endTokenDrag();
  else controls.enabled = true;
}, { capture: true });

renderer.domElement.addEventListener("lostpointercapture", (event: PointerEvent) => {
  if (sceneToolGesture?.pointerId === event.pointerId) {
    endSceneToolGesture({ pointerId: event.pointerId } as PointerEvent, true);
    return;
  }
  const gesture = activePointerGesture;
  // O navegador também dispara este evento após um pointerup normal. Nesse
  // caso o gesto precisa continuar vivo até o SDK concluir a interação.
  if (!gesture || gesture.pointerId !== event.pointerId || gesture.released) return;
  finishPendingPointerGesture(gesture);
});

sceneToolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tool = button.dataset.sceneTool as SceneTool | undefined;
    if (tool && Object.hasOwn(TOOL_COPY, tool)) setActiveSceneTool(tool);
  });
});
toolSettingsToggle?.addEventListener("click", () => {
  if (toolSettingsPanel?.hidden) openToolSettings();
  else closeToolPanels();
});
toolSettingsClose?.addEventListener("click", closeToolPanels);
mapScaleToggle?.addEventListener("click", () => {
  if (mapScalePanel?.hidden) openMapScalePanel();
  else closeMapScalePanel();
});
mapScaleClose?.addEventListener("click", closeToolPanels);
mapScaleInput?.addEventListener("input", () => {
  const percent = THREE.MathUtils.clamp(Number(mapScaleInput.value) || 100, 50, 200);
  if (mapScaleValue) mapScaleValue.value = `${Math.round(percent)}%`;
  // Preview is local; no SDK write is sent for each slider movement.
  mapRoot.scale.setScalar(percent / 100);
});
mapScaleInput?.addEventListener("change", () => void applyMapScaleFromSlider());
integrationsToggle?.addEventListener("click", () => {
  const shouldOpen = Boolean(integrationsPanel?.hidden);
  closeMapScalePanel();
  if (integrationsPanel) integrationsPanel.hidden = !shouldOpen;
  if (toolSettingsPanel) toolSettingsPanel.hidden = true;
  integrationsToggle?.setAttribute("aria-expanded", String(shouldOpen));
  toolSettingsToggle?.setAttribute("aria-expanded", "false");
});
integrationsClose?.addEventListener("click", closeToolPanels);
toolUndoButton?.addEventListener("click", () => void undoLastSceneToolItem());
strokeWidthInput?.addEventListener("input", () => {
  if (strokeWidthValue) strokeWidthValue.value = `${strokeWidthInput.value} px`;
  if (sceneToolGesture) updateSceneToolPreview(sceneToolGesture);
});
fillOpacityInput?.addEventListener("input", () => {
  if (fillOpacityValue) fillOpacityValue.value = `${fillOpacityInput.value}%`;
  if (sceneToolGesture) updateSceneToolPreview(sceneToolGesture);
});
strokeColorInput?.addEventListener("input", () => {
  if (sceneToolGesture) updateSceneToolPreview(sceneToolGesture);
});
fillColorInput?.addEventListener("input", () => {
  if (sceneToolGesture) updateSceneToolPreview(sceneToolGesture);
});
fireRadiusInput?.addEventListener("input", () => {
  if (fireRadiusValue) fireRadiusValue.value = `${fireRadiusInput.value} células`;
});
toolUndoButton && (toolUndoButton.disabled = true);
setActiveSceneTool("select");

scaleDownButton?.addEventListener("click", () => void scaleSelectedTokens(0.9));
scaleUpButton?.addEventListener("click", () => void scaleSelectedTokens(1.1));
rotateLeftButton?.addEventListener("click", () => void rotateSelectedTokens(-15));
rotateRightButton?.addEventListener("click", () => void rotateSelectedTokens(15));
lockButton?.addEventListener("click", () => void toggleSelectedTokenLock());
visibilityButton?.addEventListener("click", () => void toggleSelectedTokenVisibility());
deleteButton?.addEventListener("click", () => void deleteSelectedTokens());
deselectButton?.addEventListener("click", () => {
  void OBR.player.deselect().then(() => syncSelectedTokens([])).catch((error) => {
    console.warn("[Sistema 3D] Não foi possível limpar a seleção:", error);
    notify("Não foi possível limpar a seleção.");
  });
});

function updateBillboardFacing(): void {
  for (const record of records.values()) {
    if (record.object.parent !== tokenRoot) continue;
    const dx = camera.position.x - record.object.position.x;
    const dz = camera.position.z - record.object.position.z;
    record.object.rotation.y = Math.atan2(dx, dz) + THREE.MathUtils.degToRad(record.itemRotation);
  }
}

const keysDown = new Set<string>();
window.addEventListener("keydown", (event) => {
  const target = event.target;
  const isEditingText = target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  if (isEditingText) return;

  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) {
    keysDown.add(event.key.toLowerCase());
    if (event.key.toLowerCase().startsWith("arrow")) event.preventDefault();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    if (sceneToolGesture) {
      sceneToolGesture = null;
      clearToolPreview();
      if (measureReadout) measureReadout.hidden = true;
      controls.enabled = true;
      return;
    }
    if (activePointerGesture && !activePointerGesture.released) {
      finishPendingPointerGesture(activePointerGesture);
      return;
    }
    if (event.key.toLowerCase() === "r" && currentFrame) {
      event.preventDefault();
      fitCamera(currentFrame);
      return;
    }
    if ((toolSettingsPanel && !toolSettingsPanel.hidden) || (integrationsPanel && !integrationsPanel.hidden)) {
      closeToolPanels();
      return;
    }
    void OBR.modal.close(MODAL_ID);
  }
});
window.addEventListener("keyup", (event) => keysDown.delete(event.key.toLowerCase()));
function cancelUnreleasedPointerGesture(): void {
  const gesture = activePointerGesture;
  if (gesture && !gesture.released) finishPendingPointerGesture(gesture);
}

window.addEventListener("blur", () => {
  keysDown.clear();
  cancelUnreleasedPointerGesture();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelUnreleasedPointerGesture();
});

function moveCameraWithKeys(delta: number): void {
  if (keysDown.size === 0 || dragState || sceneToolGesture) return;
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

const frameClock = new THREE.Clock();

function animate(): void {
  if (!animationRunning) return;
  animationFrameId = requestAnimationFrame(animate);
  // Cap long pauses (background tabs / mobile suspension) to avoid jumps.
  const delta = Math.min(frameClock.getDelta(), 0.05);
  moveCameraWithKeys(delta);
  controls.update();
  updateBillboardFacing();
  updateFireEffects(performance.now() / 1000);
  renderer.render(scene, camera);
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  for (const material of wideLineMaterials) material.resolution.set(width, height);
}
window.addEventListener("resize", resize);

renderer.domElement.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setStatus("Contexto gráfico perdido. Aguardando restauração…", "error");
});
renderer.domElement.addEventListener("webglcontextrestored", () => {
  setStatus("Contexto gráfico restaurado. Reconstruindo…", "loading");
  void loadScene();
});

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
      currentPlayerRole = player.role;
      syncSelectedTokens(player.selection ?? []);
      refreshTokenToolbar();
    });
    unsubscribeGrid = OBR.scene.grid.onChange(() => {
      const requestVersion = ++sceneOperationVersion;
      void refreshGridSettings().then(() => {
        if (requestVersion === sceneOperationVersion && !blockedByFog && currentItems.length > 0) {
          return syncSceneWithResolvedFrame(currentItems, () => requestVersion === sceneOperationVersion);
        }
      }).catch((error) => {
        if (requestVersion !== sceneOperationVersion) return;
        console.error("[Sistema 3D] Falha ao atualizar o enquadramento após mudança da grade:", error);
        setStatus("Erro ao atualizar a escala da cena", "error");
      });
    });
    void refreshGridSettings();
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
      sceneSessionVersion += 1;
      if (ready) void loadScene();
      else {
        sceneOperationVersion += 1;
        endTokenDrag();
        blockedByFog = false;
        clearWorld();
        updateCounts([]);
        showMessage("Cena fechada", "Abra uma cena no Owlbear Rodeo para continuar.");
        setStatus("Aguardando uma cena do Owlbear", "warning");
      }
    });
    unsubscribeItems = OBR.scene.items.onChange((items: Item[]) => {
      const requestVersion = ++sceneOperationVersion;
      const isCurrent = () => requestVersion === sceneOperationVersion;

      // Token movement emits frequent full-scene snapshots. Only re-query Fog
      // and role state when visibility blockers may have changed.
      if (!blockedByFog && !hasVisionBlockingItems(items)) {
        void syncSceneWithResolvedFrame(items, isCurrent).catch((error) => {
          if (!isCurrent()) return;
          console.error("[Sistema 3D] Erro ao resolver os limites do mapa:", error);
          setStatus("Erro ao posicionar os elementos da cena", "error");
        });
        return;
      }

      void checkFogSafety(items, isCurrent).then((safe) => {
        if (isCurrent() && safe) return syncSceneWithResolvedFrame(items, isCurrent);
      }).catch((error) => {
        if (!isCurrent()) return;
        console.error("[Sistema 3D] Erro ao sincronizar alterações da cena:", error);
        setStatus("Erro ao sincronizar a cena", "error");
      });
    });
    unsubscribeFog = OBR.scene.fog.onChange(() => void loadScene());
    void loadScene();
  });
}

window.addEventListener("pagehide", () => {
  viewerDisposed = true;
  animationRunning = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  endTokenDrag();
  sceneToolGesture = null;
  clearWorld();
  unsubscribeItems?.();
  unsubscribeFog?.();
  unsubscribeReady?.();
  unsubscribePlayer?.();
  unsubscribeGrid?.();
  controls.dispose();
  renderer.dispose();
  placeholderTexture.dispose();
  for (const texture of textures.values()) texture.dispose();
  textures.clear();
  pendingTextures.clear();
  notifiedTextureFailures.clear();
  wideLineMaterials.clear();
});

animate();
