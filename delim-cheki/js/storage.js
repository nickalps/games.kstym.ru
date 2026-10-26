// localStorage, миграции, экспорт и импорт
import { MAX_MONEY_KOPECKS } from './money.js';

export const STORAGE_KEYS = {
  EVENTS: 'delim-chekov:v1:events',
  DRAFT: 'delim-chekov:v1:draft',
  SETTINGS: 'delim-chekov:v1:settings'
};

export const SCHEMA_VERSION = 1;

/**
 * Генерация уникального ID (crypto.randomUUID с запасным вариантом)
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function showStorageBanner() {
  if (typeof document !== 'undefined') {
    const banner = document.getElementById('storage-banner');
    if (banner) {
      banner.classList.remove('hidden');
    }
  }
}

export function loadSettings() {
  const defaults = {
    defaultParticipants: ['Михаил', 'Дмитрий', 'Анна', 'Елена'],
    eventsSort: 'desc',
    theme: 'system'
  };

  if (typeof localStorage === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      defaultParticipants: Array.isArray(parsed?.defaultParticipants) && parsed.defaultParticipants.length >= 2
        ? parsed.defaultParticipants
        : defaults.defaultParticipants,
      eventsSort: parsed?.eventsSort === 'asc' ? 'asc' : 'desc',
      theme: ['system', 'light', 'dark'].includes(parsed?.theme) ? parsed.theme : 'system'
    };
  } catch (e) {
    return defaults;
  }
}

export function saveSettings(settings) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    showStorageBanner();
  }
}

export function loadDraft() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.event) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function saveDraft(draft) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(draft));
  } catch (e) {
    showStorageBanner();
  }
}

export function loadEvents() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveEvents(events) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  } catch (e) {
    showStorageBanner();
  }
}

export function getEventById(id) {
  if (!id) return null;
  const events = loadEvents();
  return events.find((e) => e.id === id) || null;
}

export function saveOrUpdateEvent(event) {
  const events = loadEvents();
  const now = Date.now();

  let targetEvent = null;
  if (event.id) {
    const existingIndex = events.findIndex((e) => e.id === event.id);
    if (existingIndex !== -1) {
      targetEvent = {
        ...event,
        updatedAt: now
      };
      events[existingIndex] = targetEvent;
      saveEvents(events);
      return targetEvent;
    }
  }

  // Создание нового события
  const newId = event.id || generateId();
  targetEvent = {
    ...event,
    id: newId,
    createdAt: event.createdAt || now,
    updatedAt: now
  };
  events.push(targetEvent);
  saveEvents(events);
  return targetEvent;
}

export function deleteEvent(id) {
  const events = loadEvents();
  const filtered = events.filter((e) => e.id !== id);
  saveEvents(filtered);
}

/**
 * Дублирует событие с перепривязкой всех идентификаторов участников и чеков
 * @param {object} originalEvent
 * @returns {object} Новое событие
 */
export function duplicateEvent(originalEvent) {
  const oldToNewParticipantId = new Map();
  const now = Date.now();

  const newParticipants = (originalEvent.participants || []).map((p) => {
    const newId = generateId();
    oldToNewParticipantId.set(p.id, newId);
    return {
      id: newId,
      name: p.name
    };
  });

  const newReceipts = (originalEvent.receipts || []).map((r) => {
    const newReceiptId = generateId();
    const newPayerId = r.payerId ? (oldToNewParticipantId.get(r.payerId) || null) : null;
    const newSharedWith = Array.isArray(r.sharedWith)
      ? r.sharedWith.map((id) => oldToNewParticipantId.get(id)).filter(Boolean)
      : [];

    const newPersonal = (r.personal || []).map((item) => ({
      id: generateId(),
      personId: item.personId ? (oldToNewParticipantId.get(item.personId) || null) : null,
      amount: item.amount,
      note: item.note || ''
    }));

    return {
      id: newReceiptId,
      title: r.title || '',
      payerId: newPayerId,
      amount: r.amount,
      sharedWith: newSharedWith,
      personal: newPersonal,
      collapsed: Boolean(r.collapsed)
    };
  });

  return {
    id: generateId(),
    name: `${originalEvent.name || ''} (копия)`.trim(),
    date: originalEvent.date || '',
    createdAt: now,
    updatedAt: now,
    participants: newParticipants,
    receipts: newReceipts
  };
}

/**
 * Строгая валидация и очистка структуры данных для импорта
 * @param {string | object} rawData
 * @returns {{
 *   isValid: boolean,
 *   errors: string[],
 *   sanitizedEvents: Array<object>,
 *   versionError?: boolean
 * }}
 */
export function validateImportData(rawData) {
  const errors = [];

  let data = rawData;
  if (typeof rawData === 'string') {
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      return {
        isValid: false,
        errors: ['Не удалось прочитать файл'],
        sanitizedEvents: []
      };
    }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      errors: ['Некорректная структура файла'],
      sanitizedEvents: []
    };
  }

  // 1. app === 'delim-chekov'
  if (data.app !== 'delim-chekov') {
    errors.push('Неверный идентификатор приложения (app)');
  }

  // 2. schemaVersion
  if (typeof data.schemaVersion !== 'number' || !Number.isInteger(data.schemaVersion)) {
    errors.push('Некорректная версия схемы (schemaVersion)');
  } else if (data.schemaVersion > SCHEMA_VERSION) {
    return {
      isValid: false,
      errors: ['Файл создан в более новой версии приложения'],
      sanitizedEvents: [],
      versionError: true
    };
  }

  // 3. events — массив
  if (!Array.isArray(data.events)) {
    errors.push('Поле events должно быть массивом');
    return {
      isValid: false,
      errors: errors.slice(0, 5),
      sanitizedEvents: []
    };
  }

  const sanitizedEvents = [];

  for (let eIdx = 0; eIdx < data.events.length; eIdx++) {
    const ev = data.events[eIdx];
    const prefix = `Событие #${eIdx + 1}:`;

    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
      errors.push(`${prefix} некорректный объект`);
      continue;
    }

    if (typeof ev.id !== 'string' || !ev.id.trim()) {
      errors.push(`${prefix} отсутствует id`);
    }

    if (typeof ev.name !== 'string' || !ev.name.trim() || ev.name.length > 80) {
      errors.push(`${prefix} название должно быть от 1 до 80 символов`);
    }

    // date в формате YYYY-MM-DD
    if (typeof ev.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date) || isNaN(Date.parse(ev.date))) {
      errors.push(`${prefix} дата должна быть в формате YYYY-MM-DD`);
    }

    if (typeof ev.createdAt !== 'number' || isNaN(ev.createdAt)) {
      errors.push(`${prefix} некорректный createdAt`);
    }

    if (typeof ev.updatedAt !== 'number' || isNaN(ev.updatedAt)) {
      errors.push(`${prefix} некорректный updatedAt`);
    }

    // Участники
    if (!Array.isArray(ev.participants) || ev.participants.length < 2 || ev.participants.length > 30) {
      errors.push(`${prefix} должно быть от 2 до 30 участников`);
      continue;
    }

    const participantIds = new Set();
    const participantNames = new Set();
    const sanitizedParticipants = [];

    let participantsValid = true;
    for (const p of ev.participants) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        errors.push(`${prefix} некорректный участник`);
        participantsValid = false;
        break;
      }

      if (typeof p.id !== 'string' || !p.id.trim()) {
        errors.push(`${prefix} пустой id участника`);
        participantsValid = false;
        break;
      }

      if (participantIds.has(p.id)) {
        errors.push(`${prefix} повторяющийся идентификатор участника: ${p.id}`);
        participantsValid = false;
        break;
      }
      participantIds.add(p.id);

      if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 30) {
        errors.push(`${prefix} имя участника должно быть от 1 до 30 символов`);
        participantsValid = false;
        break;
      }

      const lowerName = p.name.trim().toLowerCase();
      if (participantNames.has(lowerName)) {
        errors.push(`${prefix} повторяющееся имя участника: ${p.name}`);
        participantsValid = false;
        break;
      }
      participantNames.add(lowerName);

      sanitizedParticipants.push({
        id: p.id,
        name: p.name.trim()
      });
    }

    if (!participantsValid) continue;

    // Чеки
    if (!Array.isArray(ev.receipts)) {
      errors.push(`${prefix} receipts должно быть массивом`);
      continue;
    }

    const sanitizedReceipts = [];
    for (let rIdx = 0; rIdx < ev.receipts.length; rIdx++) {
      const r = ev.receipts[rIdx];
      const rPrefix = `${prefix} чек #${rIdx + 1}:`;

      if (!r || typeof r !== 'object' || Array.isArray(r)) {
        errors.push(`${rPrefix} некорректный объект`);
        continue;
      }

      if (typeof r.id !== 'string' || !r.id.trim()) {
        errors.push(`${rPrefix} отсутствует id`);
      }

      const title = typeof r.title === 'string' ? r.title.slice(0, 60) : '';

      // payerId: null или существующий участник
      let payerId = null;
      if (r.payerId !== null && r.payerId !== undefined) {
        if (typeof r.payerId !== 'string' || !participantIds.has(r.payerId)) {
          errors.push(`${rPrefix} плательщик ссылается на несуществующего участника`);
        } else {
          payerId = r.payerId;
        }
      }

      // amount: целое неотрицательное число <= MAX_MONEY_KOPECKS
      if (
        typeof r.amount !== 'number' ||
        !Number.isInteger(r.amount) ||
        r.amount < 0 ||
        r.amount > MAX_MONEY_KOPECKS
      ) {
        errors.push(`${rPrefix} сумма должна быть целым неотрицательным числом копеек`);
      }

      // sharedWith: массив id существующих участников
      if (!Array.isArray(r.sharedWith)) {
        errors.push(`${rPrefix} sharedWith должен быть массивом`);
      } else {
        for (const sid of r.sharedWith) {
          if (typeof sid !== 'string' || !participantIds.has(sid)) {
            errors.push(`${rPrefix} sharedWith содержит несуществующего участника`);
            break;
          }
        }
      }

      // personal
      const sanitizedPersonal = [];
      if (!Array.isArray(r.personal)) {
        errors.push(`${rPrefix} personal должен быть массивом`);
      } else {
        for (const item of r.personal) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            errors.push(`${rPrefix} некорректная личная покупка`);
            continue;
          }

          let personId = null;
          if (item.personId !== null && item.personId !== undefined) {
            if (typeof item.personId !== 'string' || !participantIds.has(item.personId)) {
              errors.push(`${rPrefix} владелец личной покупки ссылается на несуществующего участника`);
            } else {
              personId = item.personId;
            }
          }

          if (
            typeof item.amount !== 'number' ||
            !Number.isInteger(item.amount) ||
            item.amount < 0 ||
            item.amount > MAX_MONEY_KOPECKS
          ) {
            errors.push(`${rPrefix} сумма личной покупки должна быть целым неотрицательным числом`);
          }

          sanitizedPersonal.push({
            id: typeof item.id === 'string' && item.id.trim() ? item.id : generateId(),
            personId,
            amount: typeof item.amount === 'number' && Number.isInteger(item.amount) && item.amount >= 0 ? item.amount : 0,
            note: typeof item.note === 'string' ? item.note.slice(0, 60) : ''
          });
        }
      }

      sanitizedReceipts.push({
        id: typeof r.id === 'string' && r.id.trim() ? r.id : generateId(),
        title,
        payerId,
        amount: typeof r.amount === 'number' && Number.isInteger(r.amount) && r.amount >= 0 ? r.amount : 0,
        sharedWith: Array.isArray(r.sharedWith) ? r.sharedWith.filter((id) => participantIds.has(id)) : [],
        personal: sanitizedPersonal,
        collapsed: Boolean(r.collapsed)
      });
    }

    sanitizedEvents.push({
      id: ev.id,
      name: ev.name.trim(),
      date: ev.date,
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
      participants: sanitizedParticipants,
      receipts: sanitizedReceipts
    });
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors: errors.slice(0, 5), // Показываем не больше пяти первых проблем
    sanitizedEvents: isValid ? sanitizedEvents : []
  };
}

/**
 * Выполняет импорт проверенных событий в одном из двух режимов
 * @param {Array<object>} newEvents
 * @param {'merge' | 'replace'} mode
 * @returns {{ added: number, updated: number, skipped: number }}
 */
export function importEvents(newEvents, mode = 'merge') {
  if (mode === 'replace') {
    saveEvents(newEvents);
    return {
      added: newEvents.length,
      updated: 0,
      skipped: 0
    };
  }

  // Режим 'merge' (по умолчанию)
  const existing = loadEvents();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const ev of newEvents) {
    const existingIndex = existing.findIndex((e) => e.id === ev.id);
    if (existingIndex !== -1) {
      existing.push(ev);
      added++;
    } else {
      if (ev.updatedAt > existing[existingIndex].updatedAt) {
        existing[existingIndex] = ev;
        updated++;
      } else {
        skipped++;
      }
    }
  }

  saveEvents(existing);
  return { added, updated, skipped };
}

/**
 * Очищает все данные приложения (события, черновик, настройки)
 */
export function clearAllData() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.DRAFT);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  } catch (e) {
    showStorageBanner();
  }
}
