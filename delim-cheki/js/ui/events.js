// Экран списка событий
import { i18n } from '../i18n.js';
import { formatMoney } from '../money.js';
import { validateReceipt } from '../calc.js';
import {
  loadEvents,
  loadSettings,
  saveSettings,
  saveOrUpdateEvent,
  duplicateEvent
} from '../storage.js';
import {
  getState,
  openSavedEvent,
  deleteSavedEvent
} from '../state.js';
import { showToast, showConfirmDialog } from './components.js';

let storageListenerBound = false;

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (y && m && d) return `${d}.${m}.${y}`;
  return isoDate;
}

export function renderEvents(container) {
  container.replaceChildren();

  const settings = loadSettings();
  let currentSort = settings.eventsSort || 'desc';

  const section = document.createElement('section');
  section.className = 'screen screen-events';

  // Тулбар: заголовок со счётчиком и селектор сортировки
  const toolbar = document.createElement('div');
  toolbar.className = 'events-toolbar';

  const titleEl = document.createElement('h2');
  titleEl.id = 'events-header-title';
  toolbar.appendChild(titleEl);

  const sortControl = document.createElement('div');
  sortControl.className = 'sort-control';

  const sortLabel = document.createElement('label');
  sortLabel.htmlFor = 'events-sort-select';
  sortLabel.className = 'hint-text';
  sortLabel.textContent = i18n.events.sortLabel;

  const sortSelect = document.createElement('select');
  sortSelect.id = 'events-sort-select';
  sortSelect.setAttribute('aria-label', i18n.events.sortLabel);

  const optDesc = document.createElement('option');
  optDesc.value = 'desc';
  optDesc.textContent = i18n.events.sortDesc;
  if (currentSort === 'desc') optDesc.selected = true;

  const optAsc = document.createElement('option');
  optAsc.value = 'asc';
  optAsc.textContent = i18n.events.sortAsc;
  if (currentSort === 'asc') optAsc.selected = true;

  sortSelect.appendChild(optDesc);
  sortSelect.appendChild(optAsc);

  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    const currentSettings = loadSettings();
    currentSettings.eventsSort = currentSort;
    saveSettings(currentSettings);
    renderList();
  });

  sortControl.appendChild(sortLabel);
  sortControl.appendChild(sortSelect);
  toolbar.appendChild(sortControl);
  section.appendChild(toolbar);

  const listContainer = document.createElement('div');
  listContainer.className = 'events-list';
  section.appendChild(listContainer);

  function renderList() {
    listContainer.replaceChildren();
    const events = loadEvents();

    titleEl.textContent = `${i18n.events.title} (${events.length})`;

    if (events.length === 0) {
      sortControl.style.display = 'none';

      const placeholder = document.createElement('div');
      placeholder.className = 'card placeholder-card';

      const p = document.createElement('p');
      p.textContent = i18n.events.emptyTitle;
      placeholder.appendChild(p);

      const link = document.createElement('a');
      link.href = '#/';
      link.className = 'btn btn-primary';
      link.textContent = i18n.events.emptyLink;
      placeholder.appendChild(link);

      listContainer.appendChild(placeholder);
      return;
    }

    sortControl.style.display = 'flex';

    // Сортировка по дате, при равенстве по createdAt
    events.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      const dateComp = dateA.localeCompare(dateB);
      if (dateComp !== 0) {
        return currentSort === 'desc' ? -dateComp : dateComp;
      }
      const createdA = a.createdAt || 0;
      const createdB = b.createdAt || 0;
      return currentSort === 'desc' ? createdB - createdA : createdA - createdB;
    });

    events.forEach((ev) => {
      const card = document.createElement('div');
      card.className = 'card event-item-card';

      // Шапка карточки
      const cardHeader = document.createElement('div');
      cardHeader.className = 'event-item-header';

      const title = document.createElement('h3');
      title.className = 'event-item-title';
      title.textContent = ev.name;

      cardHeader.appendChild(title);
      card.appendChild(cardHeader);

      // Метаданные карточки
      const meta = document.createElement('div');
      meta.className = 'event-item-meta';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'event-item-meta-item';
      dateSpan.textContent = `📅 ${formatDate(ev.date)}`;
      meta.appendChild(dateSpan);

      const partCount = (ev.participants || []).length;
      const partSpan = document.createElement('span');
      partSpan.className = 'event-item-meta-item';
      partSpan.textContent = `👥 ${i18n.events.participantsCount(partCount)}`;
      meta.appendChild(partSpan);

      const receipts = ev.receipts || [];
      const receiptsSpan = document.createElement('span');
      receiptsSpan.className = 'event-item-meta-item';
      receiptsSpan.textContent = `🧾 ${i18n.events.receiptsCount(receipts.length)}`;
      meta.appendChild(receiptsSpan);

      // Сумма валидных чеков
      let totalValidAmount = 0;
      receipts.forEach((r) => {
        const val = validateReceipt(r, ev.participants || []);
        if (val.isValid) {
          totalValidAmount += r.amount;
        }
      });

      const totalSpan = document.createElement('span');
      totalSpan.className = 'event-item-meta-item event-item-total';
      totalSpan.textContent = `Сумма: ${formatMoney(totalValidAmount)}`;
      meta.appendChild(totalSpan);

      card.appendChild(meta);

      // Кнопки действий
      const actions = document.createElement('div');
      actions.className = 'event-item-actions';

      // Кнопка «Открыть»
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn btn-primary btn-sm';
      openBtn.textContent = i18n.events.btnOpen;
      openBtn.addEventListener('click', () => {
        const state = getState();
        if (state.isDirty) {
          showConfirmDialog({
            title: 'Открытие события',
            message: i18n.events.confirmOpenWithUnsaved,
            confirmText: i18n.dialog.btnConfirmReplace,
            onConfirm: () => {
              openSavedEvent(ev);
              window.location.hash = '#/';
            }
          });
        } else {
          openSavedEvent(ev);
          window.location.hash = '#/';
        }
      });

      // Кнопка «Дублировать»
      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'btn btn-secondary btn-sm';
      dupBtn.textContent = i18n.events.btnDuplicate;
      dupBtn.addEventListener('click', () => {
        const copy = duplicateEvent(ev);
        saveOrUpdateEvent(copy);
        showToast(i18n.events.toastDuplicated);
        renderList();
      });

      // Кнопка «Удалить»
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-secondary btn-sm';
      delBtn.textContent = i18n.events.btnDelete;
      delBtn.addEventListener('click', () => {
        showConfirmDialog({
          title: 'Удаление события',
          message: i18n.events.confirmDeleteEvent(ev.name),
          confirmText: i18n.dialog.btnConfirmDelete,
          isDanger: true,
          onConfirm: () => {
            deleteSavedEvent(ev.id);
            renderList();
          }
        });
      });

      actions.appendChild(openBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(delBtn);
      card.appendChild(actions);

      listContainer.appendChild(card);
    });
  }

  // Слушаем изменения из других вкладок (storage event)
  if (!storageListenerBound && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'delim-chekov:v1:events') {
        const activeHash = window.location.hash;
        if (activeHash === '#/events') {
          renderList();
        }
      }
    });
    storageListenerBound = true;
  }

  renderList();
  container.appendChild(section);
}
