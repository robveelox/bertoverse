import Phaser from 'phaser';
import { io } from 'socket.io-client';
import './style.css';
import './style-v06.css';

type AvatarKey = 'avatar-green' | 'avatar-lime';
type AvatarAppearance = { bodyTone: string; hairStyle: string; hairColor: string; topStyle: string; topColor: string; bottomStyle: string; bottomColor: string; shoesStyle: string; shoesColor: string; accessory: string | null };
type Player = { id: string; name: string; motto: string; joinedAt: string | null; x: number; y: number; color: string; direction: 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw'; avatarKey: AvatarKey; appearance: AvatarAppearance; registered: boolean };
type AuthUser = { publicId: string; username: string; email?: string; motto: string; joinedAt: string; avatarKey: AvatarKey; appearance: AvatarAppearance };
type Room = { id?: string; name?: string; ownerName?: string; createdAt?: string | null; occupancy?: number; width: number; height: number; blocked: string[] };
type RoomCard = { publicId: string; name: string; description: string; layoutKey: string; maxVisitors: number; occupancy: number; width: number; height: number; blocked?: string[]; ownerName?: string; createdAt?: string };
type CatalogItem = { id: number; code: string; name: string; assetKey: string; priceCoins: number };
type InventoryItem = { catalogId: number; code: string; name: string; assetKey: string; quantity: number };
type Direction = Player['direction'];
// Male atlas order is back, back-right, right, front-right, front,
// front-left, with the left profile mirrored from the right profile and the
// final back-left row authored in the reference sheet.
const maleDirectionRows: Record<Direction, number> = {
  n: 0, ne: 1, e: 2, se: 3, s: 4, sw: 5, w: 6, nw: 7,
};
// The braided atlas is repacked into the same runtime row order, but retains
// its own table because its source sheet is authored front-first.
const femaleDirectionRows: Record<Direction, number> = {
  n: 0, ne: 1, e: 2, se: 3, s: 4, sw: 5, w: 6, nw: 7,
};
const directionRowsByAvatar: Record<AvatarKey, Record<Direction, number>> = {
  'avatar-green': maleDirectionRows,
  'avatar-lime': femaleDirectionRows,
};
const idleColumn = 0;
const assetRevision = '0.10.5';

// One deliberately small palette keeps the room legible while making future
// room themes a data change instead of another rendering rewrite.
const roomTheme = {
  wallLeft: 0x35213c,
  wallRight: 0x48284d,
  wallShadow: 0x211528,
  wallPanel: 0x70436e,
  wallTrim: 0xe3c99c,
  floorA: 0x915b39,
  floorB: 0x814d32,
  floorLine: 0x3a241d,
  floorHighlight: 0xc18452,
  floorOutline: 0x241729,
  floorEdge: 0xf0c47c,
};

// The source atlases are 7 columns by 8 direction rows. Keep this contract in
// one place so Phaser and the profile preview use the same frame geometry.
const SPRITE_COLUMNS = 7;
const SPRITE_FRAME_WIDTH = 220;
const SPRITE_FRAME_HEIGHT = 240;
const PROFILE_FRAME_WIDTH = 72;
const PROFILE_FRAME_HEIGHT = 86;
const MOVE_MS_CARDINAL = 260;
const MOVE_MS_DIAGONAL = 365;

function setSingleAvatarFrame(element: HTMLElement, avatarKey: AvatarKey, direction: Direction = 's') {
  const scale = PROFILE_FRAME_HEIGHT / SPRITE_FRAME_HEIGHT;
  const frameWidth = SPRITE_FRAME_WIDTH * scale;
  const frameHeight = SPRITE_FRAME_HEIGHT * scale;
  const row = directionRowsByAvatar[avatarKey][direction];
  const column = idleColumn;
  // Align the selected cell to the bottom of the preview box. Setting the
  // complete sheet as the background without this offset shows every frame.
  element.style.backgroundImage = `url('/assets/avatars/${avatarKey}-walk.png?v=${assetRevision}')`;
  element.style.backgroundSize = `${frameWidth * SPRITE_COLUMNS}px ${frameHeight * 8}px`;
  element.style.backgroundPosition = `${-column * frameWidth}px ${Math.round(PROFILE_FRAME_HEIGHT - frameHeight - row * frameHeight)}px`;
  element.style.backgroundRepeat = 'no-repeat';
  element.style.imageRendering = 'pixelated';
  element.dataset.avatarFrame = `${avatarKey}:${direction}`;
}

// Keep legacy markup harmless while the stable two-avatar contract is active.
document.querySelectorAll<HTMLInputElement>('input[name="avatar"]').forEach(input => {
  if (input.value !== 'avatar-green' && input.value !== 'avatar-lime') input.closest('label')?.remove();
});

const socket = io(import.meta.env.VITE_SERVER_URL || undefined, { autoConnect: false });
const status = document.querySelector<HTMLElement>('#status');
const messages = document.querySelector<HTMLDivElement>('#messages')!;
const dialog = document.querySelector<HTMLDialogElement>('#join-dialog')!;
const loginForm = document.querySelector<HTMLFormElement>('#login-form')!;
const registerForm = document.querySelector<HTMLFormElement>('#register-form')!;
const guestForm = document.querySelector<HTMLFormElement>('#guest-form')!;
const authError = document.querySelector<HTMLDivElement>('#auth-error')!;
const accountButton = document.querySelector<HTMLButtonElement>('#account-button')!;
const accountMenu = document.querySelector<HTMLElement>('#account-menu')!;
const settingsModal = document.querySelector<HTMLElement>('#settings-modal')!;
const settingsForm = document.querySelector<HTMLFormElement>('#settings-form')!;
const settingsFeedback = document.querySelector<HTMLElement>('#settings-feedback')!;
const helpModal = document.querySelector<HTMLElement>('#help-modal')!;
const avatarStudio = document.querySelector<HTMLElement>('#avatar-studio')!;
const chatForm = document.querySelector<HTMLFormElement>('#chat-form')!;
const chatInput = document.querySelector<HTMLInputElement>('#chat')!;
const people = document.querySelector<HTMLDivElement>('#people')!;
const onlineCount = document.querySelector<HTMLElement>('#online-count')!;
const panelCount = document.querySelector<HTMLElement>('#panel-count')!;
const socialPanel = document.querySelector<HTMLElement>('#social-panel')!;
const phonePanel = document.querySelector<HTMLElement>('#phone-panel')!;
const phoneHome = document.querySelector<HTMLElement>('#phone-home')!;
const phoneView = document.querySelector<HTMLElement>('#phone-view')!;
const phoneViewContent = document.querySelector<HTMLElement>('#phone-view-content')!;
const looksPanel = document.querySelector<HTMLElement>('#looks-panel')!;
const roomsPanel = document.querySelector<HTMLElement>('#rooms-panel')!;
const catalogPanel = document.querySelector<HTMLElement>('#catalog-panel')!;
const bagPanel = document.querySelector<HTMLElement>('#bag-panel')!;
const allPanels = [socialPanel, phonePanel, looksPanel, roomsPanel, catalogPanel, bagPanel];
const roomList = document.querySelector<HTMLElement>('#room-list')!;
const catalogList = document.querySelector<HTMLElement>('#catalog-list')!;
const inventoryList = document.querySelector<HTMLElement>('#inventory-list')!;
const createRoomForm = document.querySelector<HTMLFormElement>('#create-room-form')!;
const createRoomModal = document.querySelector<HTMLElement>('#create-room-modal')!;
const createRoomCancel = document.querySelector<HTMLButtonElement>('#create-room-cancel')!;
const createRoomCancelBottom = document.querySelector<HTMLButtonElement>('#create-room-cancel-bottom')!;
const wallet = document.querySelector<HTMLElement>('#wallet')!;
const coinBalance = document.querySelector<HTMLElement>('#coin-balance')!;
const gemBalance = document.querySelector<HTMLElement>('#gem-balance')!;
const currentRoomName = document.querySelector<HTMLElement>('#current-room-name')!;
const roomToggle = document.querySelector<HTMLButtonElement>('#room-toggle')!;
const roomDetails = document.querySelector<HTMLElement>('#room-details')!;
const roomDetailsName = document.querySelector<HTMLElement>('#room-details-name')!;
const roomDetailsOwner = document.querySelector<HTMLElement>('#room-details-owner')!;
const roomDetailsCreated = document.querySelector<HTMLElement>('#room-details-created')!;
const roomDetailsActive = document.querySelector<HTMLElement>('#room-details-active')!;
const chatLog = document.querySelector<HTMLElement>('#chat-log')!;
const roomChatBubbles = document.querySelector<HTMLElement>('#room-chat-bubbles')!;
const userCard = document.querySelector<HTMLElement>('#user-card')!;
const userCardAvatar = document.querySelector<HTMLElement>('#user-card-avatar')!;
const userCardKicker = document.querySelector<HTMLElement>('#user-card-kicker')!;
const userCardName = document.querySelector<HTMLElement>('#user-card-name')!;
const userCardMotto = document.querySelector<HTMLElement>('#user-card-motto')!;
const userCardStatus = document.querySelector<HTMLElement>('#user-card-status')!;
const userCardLook = document.querySelector<HTMLElement>('#user-card-look')!;
const userCardJoined = document.querySelector<HTMLElement>('#user-card-joined')!;
const userCardMessage = document.querySelector<HTMLButtonElement>('#user-card-message')!;
const userCardReport = document.querySelector<HTMLButtonElement>('#user-card-report')!;
let displayName = 'Guest';
let currentUser: AuthUser | null = null;
let currentRoomId = '00000000-0000-4000-8000-000000000001';
const knownPlayers = new Map<string, Player>();
let selectedPlayerId: string | null = null;
let selfPlayerId: string | null = null;
let activePhoneApp: 'messages' | 'hq' | 'people' | 'future' | null = null;
let directMessageTargetId: string | null = null;
const directMessageThreads = new Map<string, { self: boolean; message: string }[]>();
let loungeReady = false;
let connectionRequested = false;
let roomsByTab: Record<'public'|'mine'|'recent', RoomCard[]> = { public: [], mine: [], recent: [] };
let activeRoomTab: 'public'|'mine'|'recent' = 'public';
let chatMuteTimer: number | undefined;

function connectWhenLoungeReady() {
  if (connectionRequested && loungeReady && !socket.connected) socket.connect();
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

function startGame(user: AuthUser | null, guestName = 'Guest') {
  currentUser = user;
  displayName = user?.username ?? guestName;
  accountButton.textContent = user ? user.username.slice(0, 2).toUpperCase() : '⚙';
  accountButton.title = user ? `Signed in as ${user.username}` : 'Guest account';
  accountMenu.hidden = true;
  accountMenu.querySelector<HTMLElement>('#account-menu-label')!.textContent = user ? user.username : 'GUEST MODE';
  const settingsEmail = document.querySelector<HTMLInputElement>('#settings-email');
  const settingsMotto = document.querySelector<HTMLInputElement>('#settings-motto');
  if (settingsEmail) settingsEmail.value = user?.email ?? '';
  if (settingsMotto) settingsMotto.value = user?.motto ?? '';
  avatarStudio.hidden = !user;
  avatarStudio.querySelectorAll<HTMLButtonElement>('[data-avatar]').forEach(button => button.classList.toggle('active', button.dataset.avatar === user?.avatarKey));
  wallet.hidden = !user;
  if (user) refreshWallet();
  if (dialog.open) dialog.close();
  connectionRequested = true;
  connectWhenLoungeReady();
}

function closeAccountMenu() { accountMenu.hidden = true; accountButton.setAttribute('aria-expanded', 'false'); }
function openSettings() {
  closeAccountMenu();
  if (!currentUser) { addMessage('Settings are available after you register.', true); return; }
  settingsFeedback.textContent = '';
  settingsModal.hidden = false;
  document.querySelector<HTMLInputElement>('#settings-email')?.focus();
}
function closeSettings() { settingsModal.hidden = true; settingsForm.reset(); if (currentUser) startGame(currentUser); }
function openHelp() { closeAccountMenu(); helpModal.hidden = false; }
function closeHelp() { helpModal.hidden = true; }

function renderPeople(players: Player[]) {
  knownPlayers.clear();
  players.forEach(player => knownPlayers.set(player.id, player));
  onlineCount.textContent = String(players.length);
  panelCount.textContent = `${players.length} ${players.length === 1 ? 'person' : 'people'} relaxing`;
  people.replaceChildren(...players.map(player => {
    const row = document.createElement('div'); row.className = 'person'; row.dataset.playerId = player.id; row.tabIndex = 0; row.setAttribute('role', 'button');
    const portrait = document.createElement('div'); portrait.className = 'portrait'; portrait.style.background = player.color; portrait.textContent = player.name.slice(0, 2).toUpperCase();
    const info = document.createElement('div'); info.className = 'person-info';
    const name = document.createElement('strong'); name.textContent = player.name;
    const state = document.createElement('small'); state.textContent = 'In the lounge';
    const dot = document.createElement('span'); dot.className = 'online-dot';
    info.append(name, state); row.append(portrait, info, dot); return row;
  }));
}

function formatDate(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function updateRoomDetails(room: Room, fallbackOccupancy = knownPlayers.size) {
  const name = room.name || currentRoomName.textContent || 'The Sunken Lounge';
  currentRoomName.textContent = name.toUpperCase();
  roomDetailsName.textContent = name;
  roomDetailsOwner.textContent = room.ownerName || 'Bertoverse HQ';
  roomDetailsCreated.textContent = formatDate(room.createdAt, 'Original lounge');
  const count = room.occupancy ?? fallbackOccupancy;
  roomDetailsActive.textContent = `${count} ${count === 1 ? 'visitor' : 'visitors'}`;
}

function showUserCard(player: Player) {
  selectedPlayerId = player.id;
  userCardKicker.textContent = player.name;
  userCardAvatar.textContent = '';
  userCardAvatar.style.backgroundColor = '#2b2032';
  setSingleAvatarFrame(userCardAvatar, player.avatarKey, 's');
  userCardAvatar.dataset.avatar = player.avatarKey;
  userCardName.textContent = player.name;
  userCardMotto.textContent = player.motto || 'Just drifting through Bertoverse.';
  userCardStatus.textContent = player.registered ? 'REGISTERED VISITOR' : 'GUEST VISITOR';
  userCardLook.textContent = player.avatarKey === 'avatar-lime' ? 'Lime Fit' : 'Forest Fit';
  userCardJoined.textContent = `Joined Bertoverse ${formatDate(player.joinedAt, 'as a guest')}`;
  userCard.hidden = false;
}

function hideUserCard() {
  selectedPlayerId = null;
  userCard.hidden = true;
}

function openPhoneHome() {
  activePhoneApp = null;
  directMessageTargetId = null;
  phoneHome.hidden = false;
  phoneView.hidden = true;
}

function openPhoneApp(app: 'messages' | 'hq' | 'people' | 'future') {
  activePhoneApp = app;
  phoneHome.hidden = true;
  phoneView.hidden = false;
  if (app === 'messages') renderPhoneMessages();
  if (app === 'hq') renderPhoneHq();
  if (app === 'people') renderPhonePeople();
  if (app === 'future') {
    phoneViewContent.innerHTML = '<h3>More apps soon</h3><p>Bertoverse HQ is sketching out events, badges, room invites and a proper friends list for this phone.</p><div class="phone-news"><small>COMING NEXT</small><strong>More ways to stay connected</strong><p>The phone is designed to grow without changing the room controls.</p></div>';
  }
}

function renderPhoneMessages() {
  const recipients = [...knownPlayers.values()].filter(player => player.id !== selfPlayerId);
  phoneViewContent.innerHTML = '<h3>Messages</h3><p>Send a private note to someone currently in Bertoverse.</p>';
  if (!recipients.length) {
    phoneViewContent.insertAdjacentHTML('beforeend', '<div class="phone-news"><small>NO ONE ELSE IS ONLINE</small><strong>Your inbox is quiet</strong><p>When somebody joins, they will appear here.</p></div>');
    return;
  }
  const list = document.createElement('div');
  list.className = 'phone-list';
  recipients.forEach(player => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${player.name} · ${player.registered ? 'registered' : 'guest'}`;
    button.addEventListener('click', () => openDirectMessage(player.id));
    list.append(button);
  });
  phoneViewContent.append(list);
}

function openDirectMessage(playerId: string) {
  const target = knownPlayers.get(playerId);
  if (!target) return renderPhoneMessages();
  directMessageTargetId = playerId;
  const thread = directMessageThreads.get(playerId) ?? [];
  phoneViewContent.innerHTML = `<h3>Message ${escapeHtml(target.name)}</h3><p>Private between you and ${escapeHtml(target.name)}.</p>`;
  const shell = document.createElement('div'); shell.className = 'dm-thread';
  const timeline = document.createElement('div'); timeline.className = 'dm-messages';
  thread.forEach(item => {
    const line = document.createElement('div'); line.className = `dm-line${item.self ? ' self' : ''}`; line.textContent = item.message; timeline.append(line);
  });
  const form = document.createElement('form'); form.className = 'dm-form';
  form.innerHTML = '<input maxlength="160" placeholder="Write privately…" autocomplete="off"><button>Send</button>';
  form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('input')!;
    const message = input.value.trim();
    if (!message || !directMessageTargetId) return;
    socket.emit('dm:send', { playerId: directMessageTargetId, message });
    input.value = '';
  });
  shell.append(timeline, form); phoneViewContent.append(shell); timeline.scrollTop = timeline.scrollHeight;
}

function addDirectMessage(playerId: string, message: string, self: boolean) {
  const thread = directMessageThreads.get(playerId) ?? [];
  thread.push({ self, message });
  directMessageThreads.set(playerId, thread.slice(-60));
  if (activePhoneApp === 'messages' && directMessageTargetId === playerId) openDirectMessage(playerId);
  else if (!self) addMessage('New private message received.', true);
}

async function renderPhoneHq() {
  phoneViewContent.innerHTML = '<h3>Bertoverse HQ</h3><p>Important notes from the people keeping the lights on.</p><div class="phone-news"><small>LOADING</small><strong>Checking the HQ feed…</strong></div>';
  try {
    const { updates } = await api<{ updates: { title: string; body: string; tone: string; pinned: boolean }[] }>('/api/hq/updates');
    phoneViewContent.innerHTML = '<h3>Bertoverse HQ</h3><p>Important notes from the people keeping the lights on.</p>';
    const list = document.createElement('div'); list.className = 'phone-list';
    updates.forEach(update => {
      const card = document.createElement('article'); card.className = `phone-news ${update.tone}`;
      card.innerHTML = `<small>${update.pinned ? 'PINNED · ' : ''}HQ UPDATE</small><strong>${escapeHtml(update.title)}</strong><p>${escapeHtml(update.body)}</p>`;
      list.append(card);
    });
    phoneViewContent.append(list);
  } catch (error) {
    phoneViewContent.innerHTML = `<h3>Bertoverse HQ</h3><div class="phone-news alert"><small>OFFLINE</small><strong>HQ feed unavailable</strong><p>${escapeHtml((error as Error).message)}</p></div>`;
  }
}

function renderPhonePeople() {
  phoneViewContent.innerHTML = '<h3>People in the room</h3><p>Tap somebody to view their Bertoverse card.</p>';
  const list = document.createElement('div'); list.className = 'phone-list';
  [...knownPlayers.values()].forEach(player => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `${player.name} · ${player.registered ? 'registered' : 'guest'}`;
    button.addEventListener('click', () => showUserCard(player)); list.append(button);
  });
  phoneViewContent.append(list);
}

const railButtons = [...document.querySelectorAll<HTMLButtonElement>('.rail [data-panel]')];
const panelsByName: Record<string, HTMLElement> = { friends: phonePanel, looks: looksPanel, rooms: roomsPanel, catalog: catalogPanel, bag: bagPanel };
const railOrderKey = 'bertoverse.rail-order';
const panelPositionKey = 'bertoverse.panel-positions';
const savedRailOrder = (() => { try { return JSON.parse(localStorage.getItem(railOrderKey) ?? '[]') as string[]; } catch { return []; } })();
const savedPanelPositions = (() => {
  try {
    const value = JSON.parse(localStorage.getItem(panelPositionKey) ?? '{}') as Record<string, { left?: unknown; top?: unknown }>;
    return Object.fromEntries(Object.entries(value).flatMap(([name, position]) => {
      const left = Number(position?.left); const top = Number(position?.top);
      return Number.isFinite(left) && Number.isFinite(top) ? [[name, { left, top }]] : [];
    }));
  } catch { return {}; }
})();
if (savedRailOrder.length) {
  const rail = railButtons[0]?.parentElement;
  const ordered = savedRailOrder.map(panelName => railButtons.find(item => item.dataset.panel === panelName)).filter((button): button is HTMLButtonElement => Boolean(button));
  const remaining = railButtons.filter(button => !ordered.includes(button));
  rail?.replaceChildren(...ordered, ...remaining);
}
let draggedRailButton: HTMLButtonElement | null = null;
railButtons.forEach(button => {
  button.draggable = true;
  button.addEventListener('dragstart', () => { draggedRailButton = button; button.classList.add('dragging'); });
  button.addEventListener('dragend', () => { draggedRailButton = null; button.classList.remove('dragging'); });
  button.addEventListener('dragover', event => event.preventDefault());
  button.addEventListener('drop', event => {
    event.preventDefault();
    if (!draggedRailButton || draggedRailButton === button) return;
    const rect = button.getBoundingClientRect();
    button.parentElement?.insertBefore(draggedRailButton, event.clientY < rect.top + rect.height / 2 ? button : button.nextSibling);
    localStorage.setItem(railOrderKey, JSON.stringify([...document.querySelectorAll<HTMLButtonElement>('.rail [data-panel]')].map(item => item.dataset.panel)));
  });
});
function layoutOpenPanels() {
  const openPanels = allPanels.filter(panel => panel.classList.contains('open') && panel !== phonePanel);
  openPanels.forEach((panel, index) => {
    if (panel.dataset.positioned === 'true') panel.style.removeProperty('--stack-offset');
    else panel.style.setProperty('--stack-offset', `${index * 18}px`);
  });
}

function clampPanelPosition(panel: HTMLElement, left: number, top: number) {
  const margin = 8;
  const width = panel.offsetWidth || 260;
  const height = panel.offsetHeight || 240;
  return {
    left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
  };
}

function setPanelPosition(panel: HTMLElement, left: number, top: number, persist = true) {
  const position = clampPanelPosition(panel, left, top);
  panel.dataset.positioned = 'true';
  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
  panel.style.removeProperty('--stack-offset');
  if (!persist) return;
  const positions = Object.fromEntries(Object.entries(panelsByName).flatMap(([name, candidate]) => {
    if (candidate.dataset.positioned !== 'true') return [];
    return [[name, { left: candidate.offsetLeft, top: candidate.offsetTop }]];
  }));
  localStorage.setItem(panelPositionKey, JSON.stringify(positions));
}

Object.entries(savedPanelPositions).forEach(([name, position]) => {
  const panel = panelsByName[name];
  if (panel) setPanelPosition(panel, position.left, position.top, false);
});

let panelZIndex = 40;
const panelDragHandles: [keyof typeof panelsByName, HTMLElement][] = [
  ['rooms', roomsPanel], ['friends', phonePanel], ['looks', looksPanel], ['catalog', catalogPanel], ['bag', bagPanel],
];
panelDragHandles.forEach(([name, panel]) => {
  const handle = panel.querySelector<HTMLElement>(name === 'friends' ? '.phone-head' : '.panel-head');
  if (!handle) return;
  handle.title = 'Drag to move this panel';
  handle.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    panel.style.zIndex = String(++panelZIndex);
    setPanelPosition(panel, rect.left, rect.top, false);
    panel.classList.add('dragging');
    handle.setPointerCapture?.(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      if (!panel.classList.contains('dragging')) return;
      setPanelPosition(panel, moveEvent.clientX - offsetX, moveEvent.clientY - offsetY, false);
    };
    const finish = () => {
      panel.classList.remove('dragging');
      handle.releasePointerCapture?.(event.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      setPanelPosition(panel, panel.offsetLeft, panel.offsetTop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish, { once: true });
    handle.addEventListener('pointercancel', finish, { once: true });
  });
});
window.addEventListener('resize', () => {
  Object.values(panelsByName).forEach(panel => {
    if (panel.dataset.positioned !== 'true') return;
    const position = clampPanelPosition(panel, panel.offsetLeft, panel.offsetTop);
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
  });
});
function showPanel(name: keyof typeof panelsByName) {
  const target = panelsByName[name];
  const shouldOpen = !target.classList.contains('open');
  target.classList.toggle('open', shouldOpen);
  layoutOpenPanels();
  if (!shouldOpen) return;
  if (name === 'rooms') refreshRooms();
  if (name === 'catalog') refreshCatalog();
  if (name === 'bag') refreshInventory();
  if (name === 'friends') openPhoneHome();
}
function closePanel(name: keyof typeof panelsByName) {
  panelsByName[name].classList.remove('open');
  layoutOpenPanels();
}
document.querySelector('#panel-close')?.addEventListener('click', () => closePanel('friends'));
document.querySelector('#looks-close')?.addEventListener('click', () => closePanel('looks'));
document.querySelector('#phone-close')?.addEventListener('click', () => closePanel('friends'));
document.querySelectorAll<HTMLElement>('[data-close-panel]').forEach(button => button.addEventListener('click', () => {
  const owner = button.closest<HTMLElement>('.panel')?.id;
  const fallback: Record<string, keyof typeof panelsByName> = { 'rooms-panel': 'rooms', 'catalog-panel': 'catalog', 'bag-panel': 'bag' };
  const name = (button.dataset.closePanel ?? (owner ? fallback[owner] : undefined)) as keyof typeof panelsByName | undefined;
  if (name) closePanel(name);
}));
railButtons.forEach(button => button.addEventListener('click', () => showPanel(button.dataset.panel!)));
roomToggle.addEventListener('click', () => {
  const open = roomDetails.hidden;
  roomDetails.hidden = !open;
  roomToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  closeAccountMenu();
  settingsModal.hidden = true;
  helpModal.hidden = true;
  allPanels.forEach(panel => panel.classList.remove('open'));
  roomDetails.hidden = true;
  roomToggle.setAttribute('aria-expanded', 'false');
  hideUserCard();
  layoutOpenPanels();
});
document.querySelector('#chat-close')?.addEventListener('click', () => chatLog.classList.remove('open'));
document.querySelector('#user-card-close')?.addEventListener('click', event => {
  event.stopPropagation();
  hideUserCard();
});
// Profile cards are transient room overlays. Capture the pointer before
// Phaser receives it so clicking any empty room area dismisses the card while
// still allowing the same click to select a destination tile.
document.addEventListener('pointerdown', event => {
  if (userCard.hidden || userCard.contains(event.target as Node)) return;
  hideUserCard();
}, true);
document.querySelectorAll<HTMLButtonElement>('[data-phone-app]').forEach(button => button.addEventListener('click', () => openPhoneApp(button.dataset.phoneApp as 'messages' | 'hq' | 'people' | 'future')));
document.querySelector('#phone-back')?.addEventListener('click', openPhoneHome);
userCardMessage.addEventListener('click', () => {
  if (!selectedPlayerId) return;
  const target = selectedPlayerId;
  if (!phonePanel.classList.contains('open')) showPanel('friends');
  openPhoneApp('messages');
  openDirectMessage(target);
});
userCardReport.addEventListener('click', async () => {
  const player = selectedPlayerId ? knownPlayers.get(selectedPlayerId) : undefined;
  if (!player || !currentUser) { addMessage('Sign in to report a visitor.', true); return; }
  const reason = window.prompt('Briefly tell Bertoverse HQ what to review:', 'Inappropriate behaviour');
  if (!reason) return;
  try {
    await api('/api/moderation/report', { method: 'POST', body: JSON.stringify({ roomPublicId: currentRoomId, targetType: 'profile', targetId: player.id, reason }) });
    addMessage('Report sent to Bertoverse HQ.', true); hideUserCard();
  } catch (error) { addMessage((error as Error).message, true); }
});
people.addEventListener('click', event => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-player-id]');
  const player = row ? knownPlayers.get(row.dataset.playerId!) : undefined;
  if (player) showUserCard(player);
});
people.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-player-id]');
  const player = row ? knownPlayers.get(row.dataset.playerId!) : undefined;
  if (player) { event.preventDefault(); showUserCard(player); }
});

function addMessage(content: string, system = false) {
  const node = document.createElement('div');
  node.className = `message${system ? ' system' : ''}`;
  node.textContent = content;
  messages.append(node);
  messages.scrollTop = messages.scrollHeight;
  while (messages.children.length > 40) messages.firstElementChild?.remove();
}

function furnitureIcon(assetKey: string) {
  return ({ 'moss-seat': '▰', 'amber-lamp': '♨', 'cloud-table': '▱', 'vinyl-stack': '◉', 'fern-planter': '♣', 'plum-rug': '⬡' } as Record<string, string>)[assetKey] ?? '◇';
}

async function refreshWallet() {
  if (!currentUser) return;
  try {
    const result = await api<{ wallet: { coins: number; gems: number } }>('/api/wallet');
    coinBalance.textContent = String(result.wallet.coins); gemBalance.textContent = String(result.wallet.gems);
  } catch (error) { addMessage((error as Error).message, true); }
}

function renderRoomPreview(room: RoomCard) {
  const width = Math.max(1, Math.min(12, room.width || 10));
  const height = Math.max(1, Math.min(10, room.height || 10));
  const blocked = new Set(room.blocked ?? []);
  const tiles: string[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) tiles.push(`<i class="room-preview-tile${blocked.has(`${x},${y}`) ? ' blocked' : ''}"></i>`);
  return `<div class="room-preview" style="--preview-cols:${width}" aria-label="${width} by ${height} room preview">${tiles.join('')}</div>`;
}

function renderRooms() {
  const rooms = roomsByTab[activeRoomTab];
  if (!rooms.length) { roomList.innerHTML = `<p class="empty-state">No rooms here yet.</p>`; return; }
  roomList.innerHTML = rooms.map(room => `<article class="room-card"><div class="room-card-main">${renderRoomPreview(room)}<div class="room-card-copy"><strong>${escapeHtml(room.name)}</strong><small>${escapeHtml(room.description || 'An unfurnished Bertoverse space.')}</small><em>${room.width}×${room.height} · ${room.occupancy}/${room.maxVisitors} relaxing${room.ownerName ? ` · by ${escapeHtml(room.ownerName)}` : ''}</em></div></div><button data-join-room="${room.publicId}" data-room-name="${escapeHtml(room.name)}">JOIN</button></article>`).join('');
}

async function refreshRooms() {
  try {
    roomsByTab = await api<typeof roomsByTab>('/api/rooms'); renderRooms();
  } catch (error) { roomList.innerHTML = `<p class="empty-state error">${escapeHtml((error as Error).message)}</p>`; }
}

async function refreshCatalog() {
  try {
    const { items } = await api<{ items: CatalogItem[] }>('/api/catalog');
    catalogList.innerHTML = items.length ? items.map(item => `<article class="shop-card"><span>${furnitureIcon(item.assetKey)}</span><strong>${escapeHtml(item.name)}</strong><small>● ${item.priceCoins}</small><button data-buy-item="${item.id}">BUY</button></article>`).join('') : '<p class="empty-state">The catalog is being restocked.</p>';
  } catch (error) { catalogList.innerHTML = `<p class="empty-state error">${escapeHtml((error as Error).message)}</p>`; }
}

async function refreshInventory() {
  if (!currentUser) { inventoryList.innerHTML = '<p class="empty-state">Sign in to use your furniture bag.</p>'; return; }
  try {
    const { items } = await api<{ items: InventoryItem[] }>('/api/inventory');
    inventoryList.innerHTML = items.length ? items.map(item => `<article class="inventory-card"><span>${furnitureIcon(item.assetKey)}</span><div><strong>${escapeHtml(item.name)}</strong><small>Quantity: ${item.quantity}</small></div><button disabled>PLACE SOON</button></article>`).join('') : '<p class="empty-state">Your bag is empty. Visit the Catalog to pick something up.</p>';
  } catch (error) { inventoryList.innerHTML = `<p class="empty-state error">${escapeHtml((error as Error).message)}</p>`; }
}

function escapeHtml(value: string) {
  const node = document.createElement('span'); node.textContent = value; return node.innerHTML;
}

document.querySelectorAll<HTMLButtonElement>('[data-room-tab]').forEach(button => button.addEventListener('click', () => {
  activeRoomTab = button.dataset.roomTab as typeof activeRoomTab;
  document.querySelectorAll('[data-room-tab]').forEach(item => item.classList.toggle('active', item === button)); renderRooms();
}));
function closeCreateRoom() {
  createRoomModal.hidden = true;
  createRoomForm.reset();
}
document.querySelector('#create-room-toggle')?.addEventListener('click', () => { createRoomModal.hidden = false; document.querySelector<HTMLInputElement>('#room-name')?.focus(); });
createRoomCancel.addEventListener('click', closeCreateRoom);
createRoomCancelBottom.addEventListener('click', closeCreateRoom);
createRoomForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await api<{ room: RoomCard }>('/api/rooms', { method: 'POST', body: JSON.stringify({ name: (document.querySelector<HTMLInputElement>('#room-name')!).value, description: (document.querySelector<HTMLInputElement>('#room-description')!).value, layoutKey: (document.querySelector<HTMLSelectElement>('#room-layout')!).value }) });
    closeCreateRoom(); activeRoomTab = 'mine'; await refreshRooms(); addMessage(`${result.room.name} is ready.`, true);
  } catch (error) { addMessage((error as Error).message, true); }
});
roomList.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-join-room]'); if (!button) return;
  currentRoomId = button.dataset.joinRoom!; currentRoomName.textContent = button.dataset.roomName!.toUpperCase(); socket.emit('room:join', currentRoomId);
  closePanel('rooms');
});
catalogList.addEventListener('click', async event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-buy-item]'); if (!button) return;
  button.disabled = true;
  try { const result = await api<{ purchased: { name: string }; wallet: { coins: number; gems: number } }>(`/api/catalog/${button.dataset.buyItem}/purchase`, { method: 'POST' }); coinBalance.textContent = String(result.wallet.coins); addMessage(`${result.purchased.name} was added to your bag.`, true); }
  catch (error) { addMessage((error as Error).message, true); }
  finally { button.disabled = false; }
});

document.querySelectorAll<HTMLButtonElement>('[data-auth-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll<HTMLButtonElement>('[data-auth-tab]').forEach(item => item.classList.toggle('active', item === button));
  loginForm.hidden = button.dataset.authTab !== 'login'; registerForm.hidden = button.dataset.authTab !== 'register'; guestForm.hidden = button.dataset.authTab !== 'guest'; authError.textContent = '';
}));
loginForm.addEventListener('submit', async event => {
  event.preventDefault(); authError.textContent = '';
  try { const result = await api<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ identity: (document.querySelector<HTMLInputElement>('#identity')!).value, password: (document.querySelector<HTMLInputElement>('#login-password')!).value }) }); startGame(result.user); }
  catch (error) { authError.textContent = (error as Error).message; }
});
registerForm.addEventListener('submit', async event => {
  event.preventDefault(); authError.textContent = '';
  const avatarKey = (document.querySelector<HTMLInputElement>('input[name="avatar"]:checked')!).value;
  try { const result = await api<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: (document.querySelector<HTMLInputElement>('#register-email')!).value, username: (document.querySelector<HTMLInputElement>('#register-name')!).value, password: (document.querySelector<HTMLInputElement>('#register-password')!).value, avatarKey }) }); startGame(result.user); }
  catch (error) { authError.textContent = (error as Error).message; }
});
guestForm.addEventListener('submit', event => { event.preventDefault(); startGame(null, document.querySelector<HTMLInputElement>('#name')!.value); });
accountButton.addEventListener('click', event => {
  event.stopPropagation();
  const open = accountMenu.hidden;
  accountMenu.hidden = !open;
  accountButton.setAttribute('aria-expanded', String(open));
});
accountMenu.querySelector('[data-account-action="settings"]')?.addEventListener('click', openSettings);
accountMenu.querySelector('[data-account-action="help"]')?.addEventListener('click', openHelp);
accountMenu.querySelector('[data-account-action="logout"]')?.addEventListener('click', async () => {
  closeAccountMenu();
  if (currentUser) await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  socket.disconnect();
  location.reload();
});
document.addEventListener('pointerdown', event => {
  if (!accountMenu.hidden && !accountMenu.contains(event.target as Node) && event.target !== accountButton) closeAccountMenu();
});
document.querySelector('#settings-close')?.addEventListener('click', closeSettings);
document.querySelector('#settings-cancel')?.addEventListener('click', closeSettings);
settingsForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  settingsFeedback.textContent = 'Saving…';
  try {
    const result = await api<{ user: AuthUser }>('/api/profile/settings', { method: 'PATCH', body: JSON.stringify({
      email: document.querySelector<HTMLInputElement>('#settings-email')!.value,
      motto: document.querySelector<HTMLInputElement>('#settings-motto')!.value,
      currentPassword: document.querySelector<HTMLInputElement>('#settings-current-password')!.value,
      newPassword: document.querySelector<HTMLInputElement>('#settings-new-password')!.value || undefined,
    }) });
    currentUser = result.user; startGame(currentUser); settingsFeedback.textContent = 'Settings saved.';
    document.querySelector<HTMLInputElement>('#settings-current-password')!.value = '';
    document.querySelector<HTMLInputElement>('#settings-new-password')!.value = '';
    socket.disconnect(); socket.connect();
  } catch (error) { settingsFeedback.textContent = (error as Error).message; }
});
document.querySelector('#help-close')?.addEventListener('click', closeHelp);
document.querySelector('#help-done')?.addEventListener('click', closeHelp);
avatarStudio.querySelectorAll<HTMLButtonElement>('[data-avatar]').forEach(button => button.addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    const result = await api<{ user: AuthUser }>('/api/profile/avatar', { method: 'PATCH', body: JSON.stringify({ avatarKey: button.dataset.avatar }) });
    currentUser = result.user; avatarStudio.querySelectorAll<HTMLButtonElement>('[data-avatar]').forEach(item => item.classList.toggle('active', item.dataset.avatar === currentUser?.avatarKey));
    socket.emit('avatar:change', currentUser.avatarKey);
  } catch (error) { addMessage((error as Error).message, true); }
}));
api<{ user: AuthUser | null }>('/api/auth/session').then(({ user }) => user ? startGame(user) : dialog.showModal()).catch(() => dialog.showModal());
chatForm.addEventListener('pointerdown', event => {
  // The form is intentionally the whole hit target. Clicking its left padding
  // or background should focus the input just like clicking the input itself.
  if (!(event.target as HTMLElement).closest('button')) chatInput.focus();
});
chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (chatInput.value.trim()) socket.emit('chat', chatInput.value);
  chatInput.value = '';
});

let roomChatBubbleIndex = 0;
function addRoomChatBubble(playerId: string, name: string, message: string, tone: 'green' | 'purple') {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${tone}`;
  bubble.dataset.playerId = playerId;
  bubble.style.setProperty('--bubble-offset', `${((roomChatBubbleIndex++ % 5) - 2) * 12}px`);
  const sender = document.createElement('strong'); sender.textContent = name;
  const text = document.createElement('span'); text.textContent = message;
  bubble.append(sender, document.createTextNode(': '), text);
  roomChatBubbles.append(bubble);
  while (roomChatBubbles.children.length > 10) roomChatBubbles.firstElementChild?.remove();
  bubble.addEventListener('animationend', () => bubble.remove(), { once: true });
}

socket.on('dm:received', ({ fromPlayerId, message }: { fromPlayerId: string; message: string }) => addDirectMessage(fromPlayerId, message, false));
socket.on('dm:sent', ({ toPlayerId, message }: { toPlayerId: string; message: string }) => addDirectMessage(toPlayerId, message, true));
socket.on('chat:blocked', ({ reason, until }: { reason: string; until: number }) => {
  if (chatMuteTimer) window.clearInterval(chatMuteTimer);
  const update = () => {
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    chatInput.disabled = remaining > 0;
    chatInput.placeholder = remaining > 0 ? `Chat paused · ${remaining}s` : 'Say something mellow…';
    if (!remaining && chatMuteTimer) { window.clearInterval(chatMuteTimer); chatMuteTimer = undefined; }
  };
  update(); chatMuteTimer = window.setInterval(update, 1000);
  addMessage(`Chat paused: ${reason}`, true);
});

class Lounge extends Phaser.Scene {
  private room: Room = { width: 10, height: 10, blocked: [] };
  private playerData = new Map<string, Player>();
  private avatars = new Map<string, Phaser.GameObjects.Container>();
  private selection?: Phaser.GameObjects.Graphics;
  private hoverSelection?: Phaser.GameObjects.Graphics;
  private originX = 480;
  private originY = 120;
  private tileW = 64;
  private tileH = 32;
  private roomScale = 1;

  preload() {
    const avatarAssets: Record<AvatarKey, string> = { 'avatar-green': 'forest-male', 'avatar-lime': 'lime-female' };
    (Object.entries(avatarAssets) as [AvatarKey, string][]).forEach(([key]) => this.load.spritesheet(key, `/assets/avatars/${key}-walk.png?v=${assetRevision}`, { frameWidth: 220, frameHeight: 240 }));
  }

  create() {
    const avatarKeys: AvatarKey[] = ['avatar-green', 'avatar-lime'];
    avatarKeys.forEach(avatarKey => this.textures.get(avatarKey).setFilter(Phaser.Textures.FilterMode.NEAREST));
    avatarKeys.forEach(avatarKey => {
      (Object.entries(directionRowsByAvatar[avatarKey]) as [Direction, number][]).forEach(([direction, row]) => {
        this.anims.create({ key: `${avatarKey}-walk-${direction}`, frames: this.anims.generateFrameNumbers(avatarKey, { start: row * 7 + 1, end: row * 7 + 6 }), frameRate: 12, repeat: -1 });
      });
    });
    this.cameras.main.setBackgroundColor('#211929');
    this.scale.on('resize', this.onResize, this);
    this.onResize({ width: this.scale.width, height: this.scale.height });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if ((pointer.event.target as HTMLElement)?.tagName !== 'CANVAS') return;
      const tile = this.screenToTile(pointer.worldX, pointer.worldY);
      if (tile && !this.room.blocked.includes(`${tile.x},${tile.y}`)) {
        this.drawSelection(tile.x, tile.y);
        socket.emit('move', { ...tile, requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if ((pointer.event.target as HTMLElement)?.tagName !== 'CANVAS') {
        this.hoverSelection?.clear();
        return;
      }
      const tile = this.screenToTile(pointer.worldX, pointer.worldY);
      if (!tile) {
        this.hoverSelection?.clear();
        return;
      }
      this.drawHoverTile(tile.x, tile.y);
    });

    socket.on('snapshot', (payload: { selfId: string; players: Player[]; room: Room }) => {
      selfPlayerId = payload.selfId;
      this.room = payload.room;
      if (payload.room.id) currentRoomId = payload.room.id;
      this.playerData.clear();
      payload.players.forEach(player => this.playerData.set(player.id, player));
      renderPeople([...this.playerData.values()]);
      updateRoomDetails(payload.room, payload.players.length);
      this.redraw();
    });
    socket.on('move:blocked', ({ reason }: { reason: string }) => addMessage(reason, true));
    socket.on('room:unavailable', ({ reason }: { reason: string }) => addMessage(reason, true));
    socket.on('player:joined', (player: Player) => { this.playerData.set(player.id, player); renderPeople([...this.playerData.values()]); updateRoomDetails(this.room, this.playerData.size); this.upsertAvatar(player); });
    socket.on('player:path', ({ playerId, path }: { playerId: string; path: { x: number; y: number }[] }) => this.animatePath(playerId, path));
    socket.on('player:stopped', ({ playerId }: { playerId: string }) => {
      const avatar = this.avatars.get(playerId);
      if (!avatar) return;
      this.tweens.killTweensOf(avatar);
      const sprite = avatar.getByName('body') as Phaser.GameObjects.Sprite;
      sprite.stop();
      const player = this.playerData.get(playerId);
      if (player) sprite.setFrame(directionRowsByAvatar[player.avatarKey][player.direction] * 7 + idleColumn);
    });
    socket.on('player:moved', (player: Player) => {
      this.playerData.set(player.id, player);
      knownPlayers.set(player.id, player);
      if (selectedPlayerId === player.id) showUserCard(player);
    });
    socket.on('player:avatar', ({ playerId, avatarKey }: { playerId: string; avatarKey: AvatarKey }) => {
      const player = this.playerData.get(playerId);
      const avatar = this.avatars.get(playerId);
      if (!player || !avatar) return;
      player.avatarKey = avatarKey;
      knownPlayers.set(playerId, player);
      if (selectedPlayerId === playerId) showUserCard(player);
      const sprite = avatar.getByName('body') as Phaser.GameObjects.Sprite;
      sprite.stop();
      sprite.setTexture(avatarKey, directionRowsByAvatar[avatarKey][player.direction] * 7 + idleColumn);
    });
    socket.on('player:left', (id: string) => {
      this.playerData.delete(id);
      if (selectedPlayerId === id) hideUserCard();
      renderPeople([...this.playerData.values()]);
      updateRoomDetails(this.room, this.playerData.size);
      this.avatars.get(id)?.destroy();
      this.avatars.delete(id);
    });
    socket.on('chat', ({ playerId, name, message }: { id: number | null; playerId: string; name: string; message: string }) => {
      addMessage(`${name}: ${message}`);
      addRoomChatBubble(playerId, name, message, this.playerData.get(playerId)?.avatarKey === 'avatar-lime' ? 'green' : 'purple');
    });
    loungeReady = true;
    connectWhenLoungeReady();
  }

  private onResize(size: { width: number; height: number }) {
    const availableWidth = Math.max(360, size.width - (size.width > 760 ? 210 : 50));
    const availableHeight = Math.max(420, size.height - 105);
    this.tileW = Phaser.Math.Clamp(Math.min(availableWidth / 10, availableHeight / 6.7), 52, 96);
    this.tileH = this.tileW / 2;
    this.roomScale = this.tileW / 64;
    const wallHeight = this.tileH * 3;
    // The vertical footprint is the sum of both isometric axes. Using only
    // room.height made wide rooms shift their floor into the walls.
    const floorHeight = (this.room.width + this.room.height) * this.tileH / 2;
    this.originX = size.width / 2;
    this.originY = (size.height - floorHeight + wallHeight) / 2;
    this.redraw();
  }

  private redraw() {
    this.children.removeAll(true);
    this.avatars.clear();
    this.drawRoomShell();
    [...this.playerData.values()].forEach(player => this.upsertAvatar(player));
  }

  private drawRoomShell() {
    const g = this.add.graphics().setDepth(-20);
    const rear = { x: this.originX, y: this.originY };
    // These are the actual floor edge corners: (0,height) on the left and
    // (width,0) on the right. The old implementation swapped width/height,
    // which only looked correct for square rooms.
    const left = this.tileToScreen(0, this.room.height);
    const right = this.tileToScreen(this.room.width, 0);
    const wallHeight = this.tileH * 3;

    g.fillStyle(roomTheme.wallLeft, 1); g.lineStyle(2, roomTheme.wallShadow, 1);
    g.beginPath(); g.moveTo(rear.x, rear.y - wallHeight); g.lineTo(left.x, left.y - wallHeight); g.lineTo(left.x, left.y); g.lineTo(rear.x, rear.y); g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(roomTheme.wallRight, 1);
    g.beginPath(); g.moveTo(rear.x, rear.y - wallHeight); g.lineTo(right.x, right.y - wallHeight); g.lineTo(right.x, right.y); g.lineTo(rear.x, rear.y); g.closePath(); g.fillPath(); g.strokePath();

    g.lineStyle(Math.max(1, this.roomScale), roomTheme.wallPanel, .65);
    for (let i = 1; i < this.room.height; i++) {
      const t = i / this.room.height;
      g.lineBetween(Phaser.Math.Linear(rear.x, left.x, t), Phaser.Math.Linear(rear.y - wallHeight, left.y - wallHeight, t), Phaser.Math.Linear(rear.x, left.x, t), Phaser.Math.Linear(rear.y, left.y, t));
    }
    for (let i = 1; i < this.room.width; i++) {
      const t = i / this.room.width;
      g.lineBetween(Phaser.Math.Linear(rear.x, right.x, t), Phaser.Math.Linear(rear.y - wallHeight, right.y - wallHeight, t), Phaser.Math.Linear(rear.x, right.x, t), Phaser.Math.Linear(rear.y, right.y, t));
    }

    g.lineStyle(this.tileH * .24, roomTheme.wallShadow, 1);
    g.lineBetween(rear.x, rear.y - this.tileH * .1, left.x, left.y - this.tileH * .1);
    g.lineBetween(rear.x, rear.y - this.tileH * .1, right.x, right.y - this.tileH * .1);
    g.lineStyle(this.tileH * .07, roomTheme.wallTrim, 1);
    g.lineBetween(rear.x, rear.y - wallHeight, left.x, left.y - wallHeight);
    g.lineBetween(rear.x, rear.y - wallHeight, right.x, right.y - wallHeight);

    for (let y = 0; y < this.room.height; y++) for (let x = 0; x < this.room.width; x++) {
      const p = this.tileToScreen(x, y);
      const shade = (x + y) % 2 === 0 ? roomTheme.floorA : roomTheme.floorB;
      g.fillStyle(shade, 1); g.lineStyle(Math.max(1, this.roomScale), roomTheme.floorLine, .9);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + this.tileW / 2, p.y + this.tileH / 2); g.lineTo(p.x, p.y + this.tileH); g.lineTo(p.x - this.tileW / 2, p.y + this.tileH / 2); g.closePath(); g.fillPath(); g.strokePath();
      g.lineStyle(Math.max(1, this.roomScale * .7), roomTheme.floorHighlight, .35);
      g.lineBetween(p.x - this.tileW * .34, p.y + this.tileH * .5, p.x, p.y + this.tileH * .83);
      g.lineBetween(p.x, p.y + this.tileH * .17, p.x + this.tileW * .34, p.y + this.tileH * .5);
    }

    // A strong double perimeter makes the walkable footprint read as a room,
    // especially against the dark backdrop and on smaller screens.
    const corners = [
      this.tileToScreen(0, 0),
      this.tileToScreen(this.room.width, 0),
      this.tileToScreen(this.room.width, this.room.height),
      this.tileToScreen(0, this.room.height),
    ];
    const outline = (color: number, width: number, alpha: number) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach(point => g.lineTo(point.x, point.y));
      g.closePath();
      g.strokePath();
    };
    outline(roomTheme.floorOutline, Math.max(4, 6 * this.roomScale), 1);
    outline(roomTheme.floorEdge, Math.max(1.5, 2 * this.roomScale), .9);
  }

  private drawBackdrop() {
    const g = this.add.graphics().setDepth(-20);
    const w = this.scale.width, h = this.scale.height;
    g.fillGradientStyle(0x211827, 0x211827, 0x4b2e35, 0x35243b, 1); g.fillRect(0, 0, w, h);
    const wallY = Math.max(75, this.originY - 15);
    g.fillStyle(0x39293e, 1); g.fillRect(90, wallY - 165, Math.max(0, w - 180), 190);
    g.lineStyle(3, 0x1b1420, 1); g.strokeRect(90, wallY - 165, Math.max(0, w - 180), 190);
    const windowX = Math.max(120, this.originX + 95);
    g.fillStyle(0x15192a, 1); g.fillRect(windowX, wallY - 145, 180, 115); g.lineStyle(5, 0x674656, 1); g.strokeRect(windowX, wallY - 145, 180, 115);
    g.lineBetween(windowX + 90, wallY - 145, windowX + 90, wallY - 30); g.lineBetween(windowX, wallY - 88, windowX + 180, wallY - 88);
    g.fillStyle(0xf1b65d, .7); for (let i = 0; i < 12; i++) g.fillRect(windowX + 12 + (i * 37) % 155, wallY - 45 - (i * 23) % 82, 4, 7);
    g.fillStyle(0xf6bd60, .15); g.fillCircle(this.originX - 175, wallY - 80, 75); g.fillStyle(0xf6bd60, 1); g.fillCircle(this.originX - 175, wallY - 80, 10);
  }

  private drawFurniture() {
    const g = this.add.graphics().setDepth(65);
    const rug = this.tileToScreen(4, 6);
    g.fillStyle(0x183f35, .95); g.fillEllipse(rug.x, rug.y + 18, 245, 94); g.lineStyle(4, 0xc99b58, .55); g.strokeEllipse(rug.x, rug.y + 18, 225, 77);
    const sofa = this.tileToScreen(2, 6);
    g.fillStyle(0x183a2c, 1); g.fillRoundedRect(sofa.x - 66, sofa.y - 9, 132, 48, 13); g.fillStyle(0x2d6245, 1); g.fillRoundedRect(sofa.x - 58, sofa.y - 18, 116, 33, 11); g.lineStyle(2, 0x11281e, 1); g.strokeRoundedRect(sofa.x - 58, sofa.y - 18, 116, 33, 11);
    g.fillStyle(0x9b536f, 1); g.fillRoundedRect(sofa.x - 46, sofa.y - 10, 29, 23, 6); g.fillStyle(0xd19c5d, 1); g.fillRoundedRect(sofa.x + 17, sofa.y - 9, 30, 22, 6);
    const table = this.tileToScreen(5, 6); g.fillStyle(0x4b2d24, 1); g.fillEllipse(table.x, table.y + 15, 85, 38); g.fillStyle(0x795039, 1); g.fillEllipse(table.x, table.y + 8, 88, 34); g.fillStyle(0xf0c56a, 1); g.fillCircle(table.x - 12, table.y + 2, 5); g.fillStyle(0x7c5bea, 1); g.fillCircle(table.x + 15, table.y + 1, 7);
    const lamp = this.tileToScreen(7, 1); g.fillStyle(0x542842, 1); g.fillRect(lamp.x - 5, lamp.y - 25, 10, 36); g.fillStyle(0xe2589d, 1); g.fillTriangle(lamp.x, lamp.y - 53, lamp.x - 14, lamp.y - 20, lamp.x + 14, lamp.y - 20); g.fillStyle(0xffb9de, .7); g.fillCircle(lamp.x, lamp.y - 33, 6);
  }

  private upsertAvatar(player: Player, animate = false) {
    if (!this.textures.exists(player.avatarKey)) {
      // A snapshot can arrive during a browser cache transition. Retry after
      // Phaser's loader has had a frame to finish instead of dropping the
      // player permanently.
      this.time.delayedCall(0, () => this.upsertAvatar(player, animate));
      return;
    }
    const p = this.tileToScreen(player.x, player.y);
    let avatar = this.avatars.get(player.id);
    if (!avatar) {
      avatar = this.makeAvatar(player);
      this.avatars.set(player.id, avatar);
    }
    avatar.setDepth(100 + player.x + player.y);
    // Avatars stand in the lower half of the diamond, not on its bottom
    // vertex. The atlas baseline is normalized, so this one contact point is
    // shared by idle and every walking frame.
    const groundY = p.y + this.tileH * 0.72;
    if (animate) this.tweens.add({ targets: avatar, x: p.x, y: groundY, duration: MOVE_MS_CARDINAL, ease: 'Linear' });
    else avatar.setPosition(p.x, groundY);
  }

  private animatePath(playerId: string, path: { x: number; y: number }[]) {
    const avatar = this.avatars.get(playerId);
    const player = this.playerData.get(playerId);
    if (!avatar || !player || !path.length) return;
    this.tweens.killTweensOf(avatar);
    const sprite = avatar.getByName('body') as Phaser.GameObjects.Sprite;
    let index = 0;
    const nextStep = () => {
      const target = path[index++];
      if (!target) {
        sprite.stop();
        sprite.setFrame(directionRowsByAvatar[sprite.texture.key as AvatarKey][player.direction] * 7 + idleColumn);
        return;
      }
      const direction = this.directionBetween(player, target);
      player.direction = direction;
      sprite.play(`${sprite.texture.key}-walk-${direction}`, true);
      const point = this.tileToScreen(target.x, target.y);
      const diagonal = player.x !== target.x && player.y !== target.y;
      avatar.setDepth(100 + target.x + target.y);
      this.tweens.add({
        targets: avatar,
        x: point.x,
        y: point.y + this.tileH * 0.72,
        duration: diagonal ? MOVE_MS_DIAGONAL : MOVE_MS_CARDINAL,
        ease: 'Linear',
        onComplete: () => {
          player.x = target.x;
          player.y = target.y;
          nextStep();
        },
      });
    };
    nextStep();
  }

  private directionBetween(from: { x: number; y: number }, to: { x: number; y: number }): Direction {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    const directions: Record<string, Direction> = {
      '0:-1': 'ne', '1:-1': 'e', '1:0': 'se',
      '1:1': 's', '0:1': 'sw', '-1:1': 'w',
      '-1:0': 'nw', '-1:-1': 'n',
    };
    return directions[`${dx}:${dy}`] ?? 's';
  }

  private makeAvatar(player: Player) {
    const container = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 2 * this.roomScale, 32 * this.roomScale, 8 * this.roomScale, 0x140f19, .52).setName('shadow');
    const body = this.add.sprite(0, 0, player.avatarKey, directionRowsByAvatar[player.avatarKey][player.direction] * 7 + idleColumn).setName('body').setOrigin(.5, 1).setScale(.36 * this.roomScale);
    const tooltip = this.add.text(0, -92 * this.roomScale, player.name, { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: `${Math.max(10, 10 * this.roomScale)}px`, color: '#d9ff9f', backgroundColor: '#17121de8', padding: { x: 6, y: 4 }, stroke: '#0d0911', strokeThickness: 3 }).setOrigin(.5, 1).setName('hover-name').setAlpha(0);
    container.add([shadow, body, tooltip]);
    // Keep the hit area to the visible body. The surrounding tile must remain
    // available for walking, even when it sits close to an avatar.
    container.setInteractive(new Phaser.Geom.Rectangle(-38, -88, 76, 88), Phaser.Geom.Rectangle.Contains);
    container.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: any) => {
      event?.stopPropagation?.();
      const current = this.playerData.get(player.id);
      if (current) showUserCard(current);
    });
    container.on('pointerover', () => this.tweens.add({ targets: tooltip, alpha: 1, y: -98 * this.roomScale, duration: 100 }));
    container.on('pointerout', () => this.tweens.add({ targets: tooltip, alpha: 0, y: -92 * this.roomScale, duration: 100 }));
    return container;
  }

  private drawSelection(x: number, y: number) {
    this.selection?.destroy();
    const p = this.tileToScreen(x, y);
    this.selection = this.add.graphics().setDepth(50);
    this.selection.fillStyle(0xb9ef66, .13); this.selection.lineStyle(Math.max(2, 3 * this.roomScale), 0xd9ff9f, .9);
    this.selection.beginPath(); this.selection.moveTo(p.x, p.y); this.selection.lineTo(p.x + this.tileW / 2, p.y + this.tileH / 2); this.selection.lineTo(p.x, p.y + this.tileH); this.selection.lineTo(p.x - this.tileW / 2, p.y + this.tileH / 2); this.selection.closePath(); this.selection.fillPath(); this.selection.strokePath();
  }

  private drawHoverTile(x: number, y: number) {
    this.hoverSelection?.destroy();
    const p = this.tileToScreen(x, y);
    this.hoverSelection = this.add.graphics().setDepth(49);
    this.hoverSelection.fillStyle(0xd9ff9f, .08);
    this.hoverSelection.lineStyle(Math.max(1, 1.5 * this.roomScale), 0xd9ff9f, .55);
    this.hoverSelection.beginPath();
    this.hoverSelection.moveTo(p.x, p.y);
    this.hoverSelection.lineTo(p.x + this.tileW / 2, p.y + this.tileH / 2);
    this.hoverSelection.lineTo(p.x, p.y + this.tileH);
    this.hoverSelection.lineTo(p.x - this.tileW / 2, p.y + this.tileH / 2);
    this.hoverSelection.closePath();
    this.hoverSelection.fillPath();
    this.hoverSelection.strokePath();
  }

  private tileToScreen(x: number, y: number) { return { x: this.originX + (x - y) * this.tileW / 2, y: this.originY + (x + y) * this.tileH / 2 }; }

  private screenToTile(x: number, y: number): { x: number; y: number } | null {
    const dx = x - this.originX;
    const dy = y - this.originY;
    // Inverse isometric coordinates around each tile centre. Trying nearby
    // candidates and validating the diamond avoids Math.round selecting the
    // wrong neighbour along the upper edge of the room.
    const fractionalX = dx / this.tileW + dy / this.tileH;
    const fractionalY = dy / this.tileH - dx / this.tileW;
    const baseX = Math.floor(fractionalX);
    const baseY = Math.floor(fractionalY);
    let best: { x: number; y: number; distance: number } | null = null;
    for (let tileY = baseY - 1; tileY <= baseY + 1; tileY++) {
      for (let tileX = baseX - 1; tileX <= baseX + 1; tileX++) {
        if (tileX < 0 || tileY < 0 || tileX >= this.room.width || tileY >= this.room.height) continue;
        const point = this.tileToScreen(tileX, tileY);
        const horizontal = Math.abs(x - point.x) / (this.tileW / 2);
        const vertical = Math.abs(y - (point.y + this.tileH / 2)) / (this.tileH / 2);
        const distance = horizontal + vertical;
        if (distance <= 1.0001 && (!best || distance < best.distance)) best = { x: tileX, y: tileY, distance };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', backgroundColor: '#211929', antialias: true, pixelArt: false, roundPixels: false, scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, scene: Lounge });

socket.on('connect', () => { status?.setAttribute('data-state', 'online'); socket.emit('join', { name: displayName, roomId: currentRoomId }); });
socket.on('disconnect', () => { status?.setAttribute('data-state', 'reconnecting'); });
socket.on('connect_error', () => { status?.setAttribute('data-state', 'offline'); });
socket.on('system', (message: string) => addMessage(message, true));
