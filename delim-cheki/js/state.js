// Управление состоянием (черновик, подписки, мутации)
import {
  generateId,
  loadDraft,
  saveDraft,
  loadSettings,
  loadEvents,
  saveOrUpdateEvent,
  deleteEvent
} from './storage.js';

let state = {
  currentEvent: null,
  openEventId: null,
  isDirty: false
};

const listeners = new Set();
let saveTimeout = null;

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(options = {}) {
  scheduleDraftSave();
  checkDirty();
  for (const listener of listeners) {
    try {
      listener(state, options);
    } catch (e) {
      // Игнорируем ошибки слушателей
    }
  }
}

function scheduleDraftSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    flushDraftSave();
  }, 300);
}

export function flushDraftSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (state.currentEvent) {
    saveDraft({
      event: state.currentEvent,
      openEventId: state.openEventId
    });
  }
}

// Принудительное сохранение при уходе со страницы
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushDraftSave();
    }
  });

  window.addEventListener('pagehide', () => {
    flushDraftSave();
  });

  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function normalizeForComparison(event) {
  if (!event) return null;
  return JSON.stringify({
    name: event.name?.trim() || '',
    date: event.date || '',
    participants: (event.participants || []).map((p) => ({ id: p.id, name: p.name.trim() })),
    receipts: (event.receipts || []).map((r) => ({
      id: r.id,
      title: r.title?.trim() || '',
      payerId: r.payerId,
      amount: r.amount,
      sharedWith: [...(r.sharedWith || [])].sort(),
      personal: (r.personal || []).map((item) => ({
        id: item.id,
        personId: item.personId,
        amount: item.amount,
        note: item.note?.trim() || ''
      }))
    }))
  });
}

function checkDirty() {
  if (!state.currentEvent) {
    state.isDirty = false;
    return;
  }

  if (state.openEventId) {
    const events = loadEvents();
    const original = events.find((e) => e.id === state.openEventId);
    if (!original) {
      state.isDirty = true;
    } else {
      state.isDirty = normalizeForComparison(state.currentEvent) !== normalizeForComparison(original);
    }
  } else {
    // Несохраненное событие: грязно, если есть имя, дата или чеки
    const hasName = Boolean(state.currentEvent.name?.trim());
    const hasDate = Boolean(state.currentEvent.date);
    const hasReceipts = (state.currentEvent.receipts || []).length > 0;
    state.isDirty = hasName || hasDate || hasReceipts;
  }
}

export function createEmptyEvent(defaultNames) {
  const names = Array.isArray(defaultNames) && defaultNames.length >= 2
    ? defaultNames
    : ['Михаил', 'Дмитрий', 'Анна', 'Елена'];

  return {
    id: null,
    name: '',
    date: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    participants: names.map((name) => ({
      id: generateId(),
      name
    })),
    receipts: []
  };
}

export function initDraft() {
  const savedDraft = loadDraft();
  const settings = loadSettings();

  if (savedDraft && savedDraft.event) {
    state.currentEvent = savedDraft.event;
    state.openEventId = savedDraft.openEventId || null;

    // Если указан openEventId, но его нет в сохраненных событиях
    if (state.openEventId) {
      const events = loadEvents();
      const exists = events.some((e) => e.id === state.openEventId);
      if (!exists) {
        state.openEventId = null;
        state.currentEvent.id = null;
      }
    }
  } else {
    state.currentEvent = createEmptyEvent(settings.defaultParticipants);
    state.openEventId = null;
  }

  checkDirty();
  notify({ initial: true });
}

export function resetToNew() {
  const settings = loadSettings();
  state.currentEvent = createEmptyEvent(settings.defaultParticipants);
  state.openEventId = null;
  state.isDirty = false;
  flushDraftSave();
  notify({ fullRebuild: true });
}

export function saveCurrentEvent() {
  if (!state.currentEvent) return false;
  if (!state.currentEvent.name?.trim() || !state.currentEvent.date) return false;

  const saved = saveOrUpdateEvent(state.currentEvent);
  state.currentEvent = JSON.parse(JSON.stringify(saved));
  state.openEventId = saved.id;
  state.isDirty = false;
  flushDraftSave();
  notify({ target: 'event-saved' });
  return true;
}

export function saveCurrentEventAsNew() {
  if (!state.currentEvent) return null;
  if (!state.currentEvent.name?.trim() || !state.currentEvent.date) return null;

  const copy = {
    ...JSON.parse(JSON.stringify(state.currentEvent)),
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const saved = saveOrUpdateEvent(copy);
  state.currentEvent = JSON.parse(JSON.stringify(saved));
  state.openEventId = saved.id;
  state.isDirty = false;
  flushDraftSave();
  notify({ target: 'event-saved-as-new' });
  return saved;
}

export function openSavedEvent(event) {
  state.currentEvent = JSON.parse(JSON.stringify(event));
  state.openEventId = event.id;
  state.isDirty = false;
  flushDraftSave();
  notify({ fullRebuild: true });
}

export function deleteSavedEvent(id) {
  deleteEvent(id);
  if (state.openEventId === id) {
    state.openEventId = null;
    if (state.currentEvent) {
      state.currentEvent.id = null;
    }
    state.isDirty = true;
    flushDraftSave();
  }
  notify({ target: 'event-deleted' });
}

export function setEventName(name) {
  if (!state.currentEvent) return;
  state.currentEvent.name = name;
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'event-name' });
}

export function setEventDate(date) {
  if (!state.currentEvent) return;
  state.currentEvent.date = date;
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'event-date' });
}

export function addParticipant(rawName) {
  if (!state.currentEvent) return { success: false, error: 'errorParticipantEmpty' };

  const name = rawName.trim();
  if (!name) {
    return { success: false, error: 'errorParticipantEmpty' };
  }
  if (name.length > 30) {
    return { success: false, error: 'errorParticipantNameLength' };
  }

  const participants = state.currentEvent.participants || [];
  if (participants.length >= 30) {
    return { success: false, error: 'errorParticipantLimit' };
  }

  const isDuplicate = participants.some(
    (p) => p.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (isDuplicate) {
    return { success: false, error: 'errorParticipantDuplicate' };
  }

  const newParticipant = {
    id: generateId(),
    name
  };

  participants.push(newParticipant);
  state.currentEvent.updatedAt = Date.now();
  // Обратите внимание: новый участник НЕ добавляется в sharedWith уже существующих чеков!
  notify({ target: 'participants' });
  return { success: true };
}

export function renameParticipant(id, rawName) {
  if (!state.currentEvent) return { success: false, error: 'errorParticipantEmpty' };

  const name = rawName.trim();
  if (!name) {
    return { success: false, error: 'errorParticipantEmpty' };
  }
  if (name.length > 30) {
    return { success: false, error: 'errorParticipantNameLength' };
  }

  const participants = state.currentEvent.participants || [];
  const isDuplicate = participants.some(
    (p) => p.id !== id && p.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (isDuplicate) {
    return { success: false, error: 'errorParticipantDuplicate' };
  }

  const target = participants.find((p) => p.id === id);
  if (target) {
    target.name = name;
    state.currentEvent.updatedAt = Date.now();
    notify({ target: 'participants-rename' });
    return { success: true };
  }
  return { success: false };
}

export function isParticipantUsedInReceipts(id) {
  if (!state.currentEvent || !state.currentEvent.receipts) return false;
  for (const receipt of state.currentEvent.receipts) {
    if (receipt.payerId === id) return true;
    if (Array.isArray(receipt.sharedWith) && receipt.sharedWith.includes(id)) return true;
    if (Array.isArray(receipt.personal) && receipt.personal.some((p) => p.personId === id)) return true;
  }
  return false;
}

export function removeParticipant(id) {
  if (!state.currentEvent) return;
  const participants = state.currentEvent.participants || [];
  if (participants.length <= 2) return; // Минимум 2 участника

  state.currentEvent.participants = participants.filter((p) => p.id !== id);

  // Сбрасываем в чеках
  for (const receipt of state.currentEvent.receipts || []) {
    if (receipt.payerId === id) {
      receipt.payerId = null;
    }
    if (Array.isArray(receipt.sharedWith)) {
      receipt.sharedWith = receipt.sharedWith.filter((pid) => pid !== id);
    }
    if (Array.isArray(receipt.personal)) {
      for (const item of receipt.personal) {
        if (item.personId === id) {
          item.personId = null;
        }
      }
    }
  }

  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'participants-remove' });
}

export function addReceipt() {
  if (!state.currentEvent) return null;

  const currentParticipants = state.currentEvent.participants || [];
  const newReceipt = {
    id: generateId(),
    title: '',
    payerId: null,
    amount: 0,
    sharedWith: currentParticipants.map((p) => p.id), // все текущие участники
    personal: [],
    collapsed: false
  };

  if (!state.currentEvent.receipts) {
    state.currentEvent.receipts = [];
  }
  state.currentEvent.receipts.push(newReceipt);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'receipt-add', newReceiptId: newReceipt.id });
  return newReceipt;
}

export function updateReceipt(receiptId, updates) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (!receipt) return;

  Object.assign(receipt, updates);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'receipt-update', receiptId });
}

export function toggleReceiptCollapse(receiptId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (receipt) {
    receipt.collapsed = !receipt.collapsed;
    notify({ target: 'receipt-collapse', receiptId });
  }
}

export function duplicateReceipt(receiptId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return null;
  const index = state.currentEvent.receipts.findIndex((r) => r.id === receiptId);
  if (index === -1) return null;

  const original = state.currentEvent.receipts[index];
  const copy = {
    ...original,
    id: generateId(),
    title: original.title ? `${original.title} (копия)` : '',
    personal: (original.personal || []).map((item) => ({
      ...item,
      id: generateId()
    })),
    collapsed: false
  };

  state.currentEvent.receipts.splice(index + 1, 0, copy);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'receipt-duplicate', newReceiptId: copy.id });
  return copy;
}

export function removeReceipt(receiptId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  state.currentEvent.receipts = state.currentEvent.receipts.filter((r) => r.id !== receiptId);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'receipt-remove', receiptId });
}

export function addPersonalPurchase(receiptId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return null;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (!receipt) return null;

  if (!receipt.personal) {
    receipt.personal = [];
  }

  const newItem = {
    id: generateId(),
    personId: null,
    amount: 0,
    note: ''
  };

  receipt.personal.push(newItem);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'personal-add', receiptId, itemId: newItem.id });
  return newItem;
}

export function updatePersonalPurchase(receiptId, itemId, updates) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (!receipt || !receipt.personal) return;

  const item = receipt.personal.find((i) => i.id === itemId);
  if (!item) return;

  Object.assign(item, updates);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'personal-update', receiptId, itemId });
}

export function removePersonalPurchase(receiptId, itemId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (!receipt || !receipt.personal) return;

  receipt.personal = receipt.personal.filter((i) => i.id !== itemId);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'personal-remove', receiptId, itemId });
}

export function toggleSharedWith(receiptId, participantId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (!receipt) return;

  if (!Array.isArray(receipt.sharedWith)) {
    receipt.sharedWith = [];
  }

  const index = receipt.sharedWith.indexOf(participantId);
  if (index === -1) {
    receipt.sharedWith.push(participantId);
  } else {
    receipt.sharedWith.splice(index, 1);
  }

  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'shared-toggle', receiptId });
}

export function setSharedWithAll(receiptId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (!receipt) return;

  receipt.sharedWith = (state.currentEvent.participants || []).map((p) => p.id);
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'shared-all', receiptId });
}

export function setSharedWithNone(receiptId) {
  if (!state.currentEvent || !state.currentEvent.receipts) return;
  const receipt = state.currentEvent.receipts.find((r) => r.id === receiptId);
  if (!receipt) return;

  receipt.sharedWith = [];
  state.currentEvent.updatedAt = Date.now();
  notify({ target: 'shared-none', receiptId });
}
