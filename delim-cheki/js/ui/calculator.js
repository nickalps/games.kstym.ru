// Экран калькулятора
import { i18n } from '../i18n.js';
import { parseMoney, formatMoney } from '../money.js';
import { calculateEvent, validateReceipt } from '../calc.js';
import {
  getState,
  subscribe,
  setEventName,
  setEventDate,
  saveCurrentEvent,
  saveCurrentEventAsNew,
  addParticipant,
  renameParticipant,
  removeParticipant,
  isParticipantUsedInReceipts,
  addReceipt,
  updateReceipt,
  duplicateReceipt,
  removeReceipt,
  toggleReceiptCollapse,
  addPersonalPurchase,
  updatePersonalPurchase,
  removePersonalPurchase,
  toggleSharedWith,
  setSharedWithAll,
  setSharedWithNone,
  resetToNew
} from '../state.js';
import { showToast, showConfirmDialog } from './components.js';

export function renderCalculator(container) {
  container.replaceChildren();

  const state = getState();
  const currentEvent = state.currentEvent;
  if (!currentEvent) return;

  const screen = document.createElement('section');
  screen.className = 'screen screen-calculator';

  // ==========================================
  // 1. Блок «Событие»
  // ==========================================
  const eventCard = document.createElement('div');
  eventCard.className = 'card event-card';

  const eventRow = document.createElement('div');
  eventRow.className = 'event-row';

  // Поле названия
  const nameField = document.createElement('div');
  const nameLabel = document.createElement('label');
  nameLabel.className = 'form-label';
  nameLabel.htmlFor = 'event-name-input';
  nameLabel.textContent = i18n.calculator.eventNameLabel;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'event-name-input';
  nameInput.maxLength = 80;
  nameInput.placeholder = i18n.calculator.eventNamePlaceholder;
  nameInput.value = currentEvent.name || '';
  nameInput.addEventListener('input', (e) => {
    setEventName(e.target.value);
    updateEventControls();
  });

  nameField.appendChild(nameLabel);
  nameField.appendChild(nameInput);

  // Поле даты
  const dateField = document.createElement('div');
  const dateLabel = document.createElement('label');
  dateLabel.className = 'form-label';
  dateLabel.htmlFor = 'event-date-input';
  dateLabel.textContent = i18n.calculator.eventDateLabel;

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.id = 'event-date-input';
  dateInput.value = currentEvent.date || '';
  dateInput.addEventListener('input', (e) => {
    setEventDate(e.target.value);
    updateEventControls();
  });

  dateField.appendChild(dateLabel);
  dateField.appendChild(dateInput);

  eventRow.appendChild(nameField);
  eventRow.appendChild(dateField);
  eventCard.appendChild(eventRow);

  // Панель кнопок и статуса
  const eventActions = document.createElement('div');
  eventActions.className = 'event-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = i18n.calculator.btnSave;
  saveBtn.id = 'btn-save-event';
  saveBtn.addEventListener('click', () => {
    const ok = saveCurrentEvent();
    if (ok) {
      showToast(i18n.calculator.toastSaved);
      updateEventControls();
    }
  });

  const saveAsNewBtn = document.createElement('button');
  saveAsNewBtn.type = 'button';
  saveAsNewBtn.className = 'btn btn-secondary';
  saveAsNewBtn.textContent = i18n.calculator.btnSaveAsNew;
  saveAsNewBtn.id = 'btn-save-as-new';
  saveAsNewBtn.style.display = 'none';
  saveAsNewBtn.addEventListener('click', () => {
    const saved = saveCurrentEventAsNew();
    if (saved) {
      showToast(i18n.calculator.toastSaved);
      updateEventControls();
    }
  });

  const saveHint = document.createElement('span');
  saveHint.className = 'hint-text';
  saveHint.id = 'save-hint';
  saveHint.textContent = i18n.calculator.hintFillToSave;

  const statusBadge = document.createElement('span');
  statusBadge.className = 'status-badge';
  statusBadge.id = 'save-status';
  statusBadge.setAttribute('aria-live', 'polite');

  const newCalcBtn = document.createElement('button');
  newCalcBtn.type = 'button';
  newCalcBtn.className = 'btn btn-secondary';
  newCalcBtn.textContent = i18n.calculator.btnNewCalculation;
  newCalcBtn.addEventListener('click', () => {
    const currentState = getState();
    if (currentState.isDirty) {
      showConfirmDialog({
        title: i18n.calculator.btnNewCalculation,
        message: i18n.calculator.confirmNewCalcUnsaved,
        confirmText: i18n.dialog.btnConfirmStartNew,
        onConfirm: () => {
          resetToNew();
          renderCalculator(container);
        }
      });
    } else {
      resetToNew();
      renderCalculator(container);
    }
  });

  eventActions.appendChild(saveBtn);
  eventActions.appendChild(saveAsNewBtn);
  eventActions.appendChild(saveHint);
  eventActions.appendChild(statusBadge);
  eventActions.appendChild(newCalcBtn);
  eventCard.appendChild(eventActions);

  function updateEventControls() {
    const currentState = getState();
    const ev = currentState.currentEvent;
    const canSave = Boolean(ev.name?.trim() && ev.date);

    saveBtn.disabled = !canSave;
    saveHint.style.display = canSave ? 'none' : 'inline';

    if (currentState.openEventId) {
      saveAsNewBtn.style.display = 'inline-flex';
      if (currentState.isDirty) {
        statusBadge.textContent = i18n.calculator.statusUnsavedChanges;
        statusBadge.className = 'status-badge status-dirty';
      } else {
        statusBadge.textContent = i18n.calculator.statusSaved;
        statusBadge.className = 'status-badge status-saved';
      }
    } else {
      saveAsNewBtn.style.display = 'none';
      statusBadge.textContent = i18n.calculator.statusNotSaved;
      statusBadge.className = 'status-badge';
    }
  }

  updateEventControls();

  // ==========================================
  // 2. Блок «Участники»
  // ==========================================
  const participantsCard = document.createElement('div');
  participantsCard.className = 'card participants-card';

  const partHeader = document.createElement('h3');
  partHeader.textContent = i18n.calculator.participantsTitle;
  participantsCard.appendChild(partHeader);

  const participantsList = document.createElement('div');
  participantsList.className = 'participants-list';
  participantsCard.appendChild(participantsList);

  // Форма добавления участника
  const addPartForm = document.createElement('form');
  addPartForm.className = 'participant-form-container';
  addPartForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddParticipant();
  });

  const addPartRow = document.createElement('div');
  addPartRow.className = 'participant-form';

  const addPartInput = document.createElement('input');
  addPartInput.type = 'text';
  addPartInput.placeholder = i18n.calculator.participantAddPlaceholder;
  addPartInput.maxLength = 30;
  addPartInput.setAttribute('aria-label', i18n.calculator.participantAddPlaceholder);

  const addPartBtn = document.createElement('button');
  addPartBtn.type = 'submit';
  addPartBtn.className = 'btn btn-primary btn-sm';
  addPartBtn.textContent = i18n.calculator.btnAddParticipant;

  addPartRow.appendChild(addPartInput);
  addPartRow.appendChild(addPartBtn);
  addPartForm.appendChild(addPartRow);

  const addPartError = document.createElement('div');
  addPartError.className = 'field-error';
  addPartError.setAttribute('role', 'alert');
  addPartError.style.display = 'none';
  addPartForm.appendChild(addPartError);

  participantsCard.appendChild(addPartForm);

  function handleAddParticipant() {
    const val = addPartInput.value;
    const res = addParticipant(val);
    if (res.success) {
      addPartInput.value = '';
      addPartError.style.display = 'none';
      addPartInput.removeAttribute('aria-invalid');
      renderParticipants();
      renderReceiptsList();
      renderSummary();
    } else {
      addPartError.textContent = i18n.calculator[res.error] || res.error;
      addPartError.style.display = 'block';
      addPartInput.setAttribute('aria-invalid', 'true');
    }
  }

  addPartInput.addEventListener('input', () => {
    if (addPartError.style.display !== 'none') {
      addPartError.style.display = 'none';
      addPartInput.removeAttribute('aria-invalid');
    }
  });

  function renderParticipants() {
    participantsList.replaceChildren();
    const ev = getState().currentEvent;
    const participants = ev.participants || [];
    const minParticipants = participants.length <= 2;

    participants.forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'chip';

      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'chip-name';
      nameBtn.textContent = p.name;
      nameBtn.title = 'Нажмите, чтобы переименовать';

      // Инлайн редактирование имени
      nameBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chip-input-inline';
        input.maxLength = 30;
        input.value = p.name;

        function commitRename() {
          const newName = input.value.trim();
          if (newName && newName !== p.name) {
            const renameRes = renameParticipant(p.id, newName);
            if (!renameRes.success) {
              showToast(i18n.calculator[renameRes.error] || renameRes.error);
            }
          }
          renderParticipants();
          renderReceiptsList();
          renderSummary();
        }

        input.addEventListener('blur', commitRename);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            input.blur();
          } else if (ke.key === 'Escape') {
            renderParticipants();
          }
        });

        chip.replaceChild(input, nameBtn);
        input.focus();
        input.select();
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-remove';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `${i18n.calculator.btnRemoveParticipantAria} ${p.name}`);
      removeBtn.disabled = minParticipants;

      removeBtn.addEventListener('click', () => {
        if (isParticipantUsedInReceipts(p.id)) {
          showConfirmDialog({
            title: 'Удаление участника',
            message: i18n.calculator.confirmRemoveParticipantWithReceipts(p.name),
            confirmText: i18n.dialog.btnConfirmDelete,
            isDanger: true,
            onConfirm: () => {
              removeParticipant(p.id);
              renderParticipants();
              renderReceiptsList();
              renderSummary();
            }
          });
        } else {
          removeParticipant(p.id);
          renderParticipants();
          renderReceiptsList();
          renderSummary();
        }
      });

      chip.appendChild(nameBtn);
      chip.appendChild(removeBtn);
      participantsList.appendChild(chip);
    });
  }

  renderParticipants();

  // ==========================================
  // 3. Блок «Чеки»
  // ==========================================
  const receiptsSection = document.createElement('section');
  receiptsSection.className = 'receipts-section';

  const receiptsSectionHeader = document.createElement('div');
  receiptsSectionHeader.className = 'section-header';
  receiptsSectionHeader.style.marginBottom = '12px';

  const receiptsTitle = document.createElement('h3');
  receiptsTitle.textContent = i18n.calculator.receiptsTitle;

  const addReceiptBtn = document.createElement('button');
  addReceiptBtn.type = 'button';
  addReceiptBtn.className = 'btn btn-primary';
  addReceiptBtn.textContent = i18n.calculator.btnAddReceipt;
  addReceiptBtn.id = 'btn-add-receipt';
  addReceiptBtn.addEventListener('click', () => {
    const newReceipt = addReceipt();
    renderReceiptsList();
    renderSummary();

    // Прокручиваем к новой карточке и ставим фокус в поле суммы
    requestAnimationFrame(() => {
      const card = document.getElementById(`receipt-card-${newReceipt.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const amountInput = card.querySelector('.receipt-amount-input');
        if (amountInput) amountInput.focus();
      }
    });
  });

  receiptsSectionHeader.appendChild(receiptsTitle);
  receiptsSectionHeader.appendChild(addReceiptBtn);
  receiptsSection.appendChild(receiptsSectionHeader);

  const receiptsListContainer = document.createElement('div');
  receiptsListContainer.className = 'receipts-list';
  receiptsSection.appendChild(receiptsListContainer);

  function renderReceiptsList() {
    receiptsListContainer.replaceChildren();
    const ev = getState().currentEvent;
    const receipts = ev.receipts || [];
    const participants = ev.participants || [];

    receipts.forEach((receipt, index) => {
      const card = createReceiptCard(receipt, index + 1, participants);
      receiptsListContainer.appendChild(card);
    });
  }

  function createReceiptCard(receipt, receiptIndex, participants) {
    const card = document.createElement('div');
    card.className = 'card receipt-card';
    card.id = `receipt-card-${receipt.id}`;

    const val = validateReceipt(receipt, participants);
    if (!val.isValid && !val.isFresh) {
      card.classList.add('receipt-card-error');
    }

    // Свёрнутое состояние
    if (receipt.collapsed) {
      const row = document.createElement('div');
      row.className = 'receipt-collapsed-row';
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.addEventListener('click', () => {
        toggleReceiptCollapse(receipt.id);
        renderReceiptsList();
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleReceiptCollapse(receipt.id);
          renderReceiptsList();
        }
      });

      const info = document.createElement('div');
      info.className = 'receipt-collapsed-info';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'receipt-collapsed-title';
      titleSpan.textContent = receipt.title || `Чек ${receiptIndex}`;

      const payerName = participants.find((p) => p.id === receipt.payerId)?.name || 'Плательщик не выбран';
      const payerSpan = document.createElement('span');
      payerSpan.className = 'receipt-collapsed-payer';
      payerSpan.textContent = `(${payerName})`;

      info.appendChild(titleSpan);
      info.appendChild(payerSpan);

      if (!val.isValid) {
        const errIcon = document.createElement('span');
        errIcon.className = 'receipt-collapsed-error';
        errIcon.textContent = '⚠️';
        errIcon.title = 'В чеке есть ошибки';
        info.appendChild(errIcon);
      }

      const amountSpan = document.createElement('span');
      amountSpan.className = 'receipt-collapsed-amount';
      amountSpan.textContent = formatMoney(receipt.amount);

      row.appendChild(info);
      row.appendChild(amountSpan);
      card.appendChild(row);
      return card;
    }

    // Развёрнутое состояние: Шапка карточки чека
    const header = document.createElement('div');
    header.className = 'receipt-header';

    const cardTitle = document.createElement('h4');
    cardTitle.textContent = receipt.title ? `${receiptIndex}. ${receipt.title}` : `Чек ${receiptIndex}`;

    const actions = document.createElement('div');
    actions.className = 'receipt-actions';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'btn btn-secondary btn-sm';
    collapseBtn.textContent = 'Свернуть';
    collapseBtn.setAttribute('aria-label', `${i18n.calculator.btnToggleReceiptAria} ${receiptIndex}`);
    collapseBtn.addEventListener('click', () => {
      toggleReceiptCollapse(receipt.id);
      renderReceiptsList();
    });

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button';
    duplicateBtn.className = 'btn btn-secondary btn-sm';
    duplicateBtn.textContent = i18n.calculator.btnDuplicateReceipt;
    duplicateBtn.addEventListener('click', () => {
      duplicateReceipt(receipt.id);
      renderReceiptsList();
      renderSummary();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-secondary btn-sm';
    deleteBtn.textContent = i18n.calculator.btnDeleteReceipt;
    deleteBtn.addEventListener('click', () => {
      showConfirmDialog({
        title: 'Удаление чека',
        message: i18n.calculator.confirmDeleteReceipt,
        confirmText: i18n.dialog.btnConfirmDelete,
        isDanger: true,
        onConfirm: () => {
          removeReceipt(receipt.id);
          renderReceiptsList();
          renderSummary();
        }
      });
    });

    actions.appendChild(collapseBtn);
    actions.appendChild(duplicateBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(cardTitle);
    header.appendChild(actions);
    card.appendChild(header);

    // Основная сетка полей чека
    const grid = document.createElement('div');
    grid.className = 'receipt-grid';

    // 1. Название
    const titleField = document.createElement('div');
    const titleLabel = document.createElement('label');
    titleLabel.className = 'form-label';
    titleLabel.textContent = 'Название';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.maxLength = 60;
    titleInput.placeholder = i18n.calculator.receiptTitlePlaceholder;
    titleInput.value = receipt.title || '';
    titleInput.addEventListener('input', (e) => {
      updateReceipt(receipt.id, { title: e.target.value });
      cardTitle.textContent = e.target.value ? `${receiptIndex}. ${e.target.value}` : `Чек ${receiptIndex}`;
    });
    titleField.appendChild(titleLabel);
    titleField.appendChild(titleInput);
    grid.appendChild(titleField);

    // 2. Кто платил
    const payerField = document.createElement('div');
    const payerLabel = document.createElement('label');
    payerLabel.className = 'form-label';
    payerLabel.textContent = i18n.calculator.receiptPayerLabel;
    const payerSelect = document.createElement('select');
    payerSelect.id = `payer-select-${receipt.id}`;

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = i18n.calculator.receiptPayerSelectDefault;
    payerSelect.appendChild(defaultOpt);

    participants.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (receipt.payerId === p.id) {
        opt.selected = true;
      }
      payerSelect.appendChild(opt);
    });

    const payerError = document.createElement('div');
    payerError.className = 'field-error';
    if (val.errors.payer && !val.isFresh) {
      payerError.textContent = i18n.calculator[val.errors.payer] || val.errors.payer;
      payerSelect.setAttribute('aria-invalid', 'true');
    }

    payerSelect.addEventListener('change', (e) => {
      updateReceipt(receipt.id, { payerId: e.target.value || null });
      revalidateCard();
      renderSummary();
    });

    payerField.appendChild(payerLabel);
    payerField.appendChild(payerSelect);
    payerField.appendChild(payerError);
    grid.appendChild(payerField);

    // 3. Сумма чека
    const amountField = document.createElement('div');
    const amountLabel = document.createElement('label');
    amountLabel.className = 'form-label';
    amountLabel.textContent = i18n.calculator.receiptAmountLabel;

    const amountInput = document.createElement('input');
    amountInput.type = 'text';
    amountInput.inputMode = 'decimal';
    amountInput.className = 'receipt-amount-input';
    amountInput.placeholder = i18n.calculator.receiptAmountPlaceholder;
    if (receipt.amount > 0) {
      amountInput.value = (receipt.amount / 100).toFixed(2).replace('.', ',');
    }

    const amountError = document.createElement('div');
    amountError.className = 'field-error';
    if (val.errors.amount && !val.isFresh) {
      amountError.textContent = i18n.calculator[val.errors.amount] || val.errors.amount;
      amountInput.setAttribute('aria-invalid', 'true');
    }

    amountInput.addEventListener('input', (e) => {
      const parsed = parseMoney(e.target.value);
      if (parsed !== null) {
        receipt.amount = parsed;
        updateReceipt(receipt.id, { amount: parsed });
        revalidateCard();
        renderSummary();
      }
    });

    amountInput.addEventListener('blur', () => {
      const parsed = parseMoney(amountInput.value);
      if (parsed !== null && parsed > 0) {
        amountInput.value = (parsed / 100).toFixed(2).replace('.', ',');
      }
      revalidateCard();
      renderSummary();
    });

    amountField.appendChild(amountLabel);
    amountField.appendChild(amountInput);
    amountField.appendChild(amountError);
    grid.appendChild(amountField);

    card.appendChild(grid);

    // 4. Участвуют в общей части
    const sharedContainer = document.createElement('div');
    sharedContainer.className = 'shared-section';

    const sharedHeader = document.createElement('div');
    sharedHeader.className = 'shared-controls';

    const sharedLabel = document.createElement('span');
    sharedLabel.className = 'form-label';
    sharedLabel.style.margin = '0';
    sharedLabel.textContent = i18n.calculator.receiptSharedWithLabel;

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn btn-secondary btn-sm';
    allBtn.textContent = i18n.calculator.btnSelectAll;
    allBtn.addEventListener('click', () => {
      setSharedWithAll(receipt.id);
      renderSharedChips();
      revalidateCard();
      renderSummary();
    });

    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'btn btn-secondary btn-sm';
    noneBtn.textContent = i18n.calculator.btnSelectNone;
    noneBtn.addEventListener('click', () => {
      setSharedWithNone(receipt.id);
      renderSharedChips();
      revalidateCard();
      renderSummary();
    });

    sharedHeader.appendChild(sharedLabel);
    sharedHeader.appendChild(allBtn);
    sharedHeader.appendChild(noneBtn);
    sharedContainer.appendChild(sharedHeader);

    const sharedChipsList = document.createElement('div');
    sharedChipsList.className = 'participants-list';
    sharedContainer.appendChild(sharedChipsList);

    const sharedError = document.createElement('div');
    sharedError.className = 'field-error';
    if (val.errors.shared && !val.isFresh) {
      sharedError.textContent = i18n.calculator[val.errors.shared] || val.errors.shared;
    }
    sharedContainer.appendChild(sharedError);

    function renderSharedChips() {
      sharedChipsList.replaceChildren();
      participants.forEach((p) => {
        const isIncluded = Array.isArray(receipt.sharedWith) && receipt.sharedWith.includes(p.id);
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'chip-toggle';
        toggleBtn.setAttribute('aria-pressed', isIncluded ? 'true' : 'false');
        toggleBtn.textContent = p.name;
        toggleBtn.addEventListener('click', () => {
          toggleSharedWith(receipt.id, p.id);
          renderSharedChips();
          revalidateCard();
          renderSummary();
        });
        sharedChipsList.appendChild(toggleBtn);
      });
    }

    renderSharedChips();
    card.appendChild(sharedContainer);

    // 5. Личные покупки
    const personalContainer = document.createElement('div');
    personalContainer.className = 'personal-section';

    const personalHeader = document.createElement('div');
    personalHeader.className = 'section-header';

    const personalTitle = document.createElement('h5');
    personalTitle.style.fontSize = '15px';
    personalTitle.textContent = i18n.calculator.personalPurchasesTitle;

    const addPersonalBtn = document.createElement('button');
    addPersonalBtn.type = 'button';
    addPersonalBtn.className = 'btn btn-secondary btn-sm';
    addPersonalBtn.textContent = i18n.calculator.btnAddPersonal;
    addPersonalBtn.addEventListener('click', () => {
      const item = addPersonalPurchase(receipt.id);
      renderPersonalRows();
      revalidateCard();
      renderSummary();
      requestAnimationFrame(() => {
        const row = personalRowsContainer.querySelector(`[data-personal-id="${item.id}"]`);
        if (row) {
          const pAmountInput = row.querySelector('.personal-amount-input');
          if (pAmountInput) pAmountInput.focus();
        }
      });
    });

    personalHeader.appendChild(personalTitle);
    personalHeader.appendChild(addPersonalBtn);
    personalContainer.appendChild(personalHeader);

    const personalRowsContainer = document.createElement('div');
    personalRowsContainer.className = 'personal-rows';
    personalContainer.appendChild(personalRowsContainer);

    const personalExceedsError = document.createElement('div');
    personalExceedsError.className = 'field-error';
    if (val.errors.personalExceeds) {
      personalExceedsError.textContent = i18n.calculator[val.errors.personalExceeds];
    }
    personalContainer.appendChild(personalExceedsError);

    function renderPersonalRows() {
      personalRowsContainer.replaceChildren();
      (receipt.personal || []).forEach((item) => {
        const row = document.createElement('div');
        row.className = 'personal-row';
        row.setAttribute('data-personal-id', item.id);

        // Селект владельца
        const select = document.createElement('select');
        const defaultPOpt = document.createElement('option');
        defaultPOpt.value = '';
        defaultPOpt.textContent = i18n.calculator.personalPersonSelectDefault;
        select.appendChild(defaultPOpt);

        participants.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          if (item.personId === p.id) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
          updatePersonalPurchase(receipt.id, item.id, { personId: e.target.value || null });
          revalidateCard();
          renderSummary();
        });

        // Инпут суммы
        const pAmountInput = document.createElement('input');
        pAmountInput.type = 'text';
        pAmountInput.inputMode = 'decimal';
        pAmountInput.className = 'personal-amount-input';
        pAmountInput.placeholder = i18n.calculator.personalAmountPlaceholder;
        if (item.amount > 0) {
          pAmountInput.value = (item.amount / 100).toFixed(2).replace('.', ',');
        }

        pAmountInput.addEventListener('input', (e) => {
          const parsed = parseMoney(e.target.value);
          if (parsed !== null) {
            item.amount = parsed;
            updatePersonalPurchase(receipt.id, item.id, { amount: parsed });
            revalidateCard();
            renderSummary();
          }
        });

        pAmountInput.addEventListener('blur', () => {
          const parsed = parseMoney(pAmountInput.value);
          if (parsed !== null && parsed > 0) {
            pAmountInput.value = (parsed / 100).toFixed(2).replace('.', ',');
          }
          revalidateCard();
          renderSummary();
        });

        // Инпут пометки
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.className = 'personal-note-field';
        noteInput.maxLength = 60;
        noteInput.placeholder = i18n.calculator.personalNotePlaceholder;
        noteInput.value = item.note || '';
        noteInput.addEventListener('input', (e) => {
          updatePersonalPurchase(receipt.id, item.id, { note: e.target.value });
        });

        // Кнопка удаления
        const removePBtn = document.createElement('button');
        removePBtn.type = 'button';
        removePBtn.className = 'btn btn-secondary btn-icon';
        removePBtn.textContent = '×';
        removePBtn.setAttribute('aria-label', i18n.calculator.btnRemovePersonalAria);
        removePBtn.addEventListener('click', () => {
          removePersonalPurchase(receipt.id, item.id);
          renderPersonalRows();
          revalidateCard();
          renderSummary();
        });

        row.appendChild(select);
        row.appendChild(pAmountInput);
        row.appendChild(noteInput);
        row.appendChild(removePBtn);
        personalRowsContainer.appendChild(row);
      });
    }

    renderPersonalRows();
    card.appendChild(personalContainer);

    // 6. Сводка под чеком
    const summaryBox = document.createElement('div');
    summaryBox.className = 'summary-box';
    summaryBox.id = `receipt-summary-${receipt.id}`;
    card.appendChild(summaryBox);

    function updateSummaryBox() {
      const v = validateReceipt(receipt, participants);
      const personalItems = (receipt.personal || [])
        .filter((item) => item.amount > 0 && item.personId)
        .map((item) => {
          const pName = participants.find((p) => p.id === item.personId)?.name || '';
          return `${pName} ${formatMoney(item.amount)}`;
        });

      const sharedCount = (receipt.sharedWith || []).filter((id) =>
        participants.some((p) => p.id === id)
      ).length;

      let perPersonStr = '0,00 ₽';
      if (v.sharedPart > 0 && sharedCount > 0) {
        const baseShare = Math.floor(v.sharedPart / sharedCount);
        const remainder = v.sharedPart % sharedCount;
        if (remainder === 0) {
          perPersonStr = formatMoney(baseShare);
        } else {
          perPersonStr = `${formatMoney(baseShare + 1)} / ${formatMoney(baseShare)}`;
        }
      }

      summaryBox.textContent = i18n.calculator.summaryTemplate({
        sharedPartStr: formatMoney(v.sharedPart),
        count: sharedCount,
        perPersonStr,
        personalItems
      });
    }

    function revalidateCard() {
      const freshVal = validateReceipt(receipt, participants);
      if (!freshVal.isValid && !freshVal.isFresh) {
        card.classList.add('receipt-card-error');
      } else {
        card.classList.remove('receipt-card-error');
      }

      // Ошибки плательщика
      if (freshVal.errors.payer && !freshVal.isFresh) {
        payerError.textContent = i18n.calculator[freshVal.errors.payer] || freshVal.errors.payer;
        payerSelect.setAttribute('aria-invalid', 'true');
      } else {
        payerError.textContent = '';
        payerSelect.removeAttribute('aria-invalid');
      }

      // Ошибки суммы
      if (freshVal.errors.amount && !freshVal.isFresh) {
        amountError.textContent = i18n.calculator[freshVal.errors.amount] || freshVal.errors.amount;
        amountInput.setAttribute('aria-invalid', 'true');
      } else {
        amountError.textContent = '';
        amountInput.removeAttribute('aria-invalid');
      }

      // Ошибки общей части
      if (freshVal.errors.shared && !freshVal.isFresh) {
        sharedError.textContent = i18n.calculator[freshVal.errors.shared] || freshVal.errors.shared;
      } else {
        sharedError.textContent = '';
      }

      // Ошибки личных покупок
      if (freshVal.errors.personalExceeds) {
        personalExceedsError.textContent = i18n.calculator[freshVal.errors.personalExceeds];
      } else {
        personalExceedsError.textContent = '';
      }

      updateSummaryBox();
    }

    updateSummaryBox();
    return card;
  }

  renderReceiptsList();

  // ==========================================
  // 4. Блок «Итог» (Чековая лента)
  // ==========================================
  const summaryPaperWrapper = document.createElement('div');
  summaryPaperWrapper.className = 'receipt-paper-wrapper';

  const summaryCard = document.createElement('div');
  summaryCard.className = 'card summary-block receipt-paper';
  summaryCard.setAttribute('aria-live', 'polite');

  // Шапка чека
  const summaryReceiptHead = document.createElement('div');
  summaryReceiptHead.className = 'receipt-paper-head';

  const receiptEmblem = document.createElement('div');
  receiptEmblem.className = 'receipt-paper-emblem';
  receiptEmblem.textContent = '🧾 ДЕЛИМ ЧЕКИ 🧾';

  const receiptSub = document.createElement('div');
  receiptSub.className = 'receipt-paper-sub';
  receiptSub.textContent = 'КАССОВЫЙ РАСЧЁТ РАСХОДОВ';

  summaryReceiptHead.appendChild(receiptEmblem);
  summaryReceiptHead.appendChild(receiptSub);
  summaryCard.appendChild(summaryReceiptHead);

  const divider1 = document.createElement('div');
  divider1.className = 'receipt-dashed-divider';
  summaryCard.appendChild(divider1);

  const copySummaryBtn = document.createElement('button');
  copySummaryBtn.type = 'button';
  copySummaryBtn.className = 'btn btn-primary btn-copy-receipt';
  copySummaryBtn.textContent = i18n.calculator.btnCopySummary;
  copySummaryBtn.id = 'btn-copy-summary';

  const receiptsCountInfo = document.createElement('div');
  receiptsCountInfo.className = 'receipts-count-info';
  receiptsCountInfo.id = 'receipts-count-info';
  summaryCard.appendChild(receiptsCountInfo);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.className = 'settlement-table';

  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  ['tableColParticipant', 'tableColSpent', 'tableColPaid', 'tableColBalance'].forEach((colKey) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = i18n.calculator[colKey];
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  tbody.id = 'settlement-tbody';
  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  summaryCard.appendChild(tableWrapper);

  const transfersContainer = document.createElement('div');
  transfersContainer.className = 'transfers-container';
  transfersContainer.id = 'transfers-container';
  summaryCard.appendChild(transfersContainer);

  const copyFallbackContainer = document.createElement('div');
  copyFallbackContainer.className = 'copy-fallback';
  copyFallbackContainer.style.display = 'none';
  summaryCard.appendChild(copyFallbackContainer);

  function renderSummary() {
    const ev = getState().currentEvent;
    const calcResult = calculateEvent(ev);

    // 1. Строка учтённых чеков
    if (calcResult.errorReceiptsCount > 0) {
      receiptsCountInfo.style.display = 'block';
      receiptsCountInfo.textContent = i18n.calculator.receiptsCountInfo(
        calcResult.validReceiptsCount,
        calcResult.totalReceiptsCount,
        calcResult.errorReceiptsCount
      );
    } else {
      receiptsCountInfo.style.display = 'none';
      receiptsCountInfo.textContent = '';
    }

    // 2. Таблица участников
    tbody.replaceChildren();
    calcResult.participantStats.forEach((p) => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = p.name;

      const tdSpent = document.createElement('td');
      tdSpent.textContent = formatMoney(p.spent);

      const tdPaid = document.createElement('td');
      tdPaid.textContent = formatMoney(p.paid);

      const tdBalance = document.createElement('td');
      if (p.balance > 0) {
        tdBalance.textContent = `+${formatMoney(p.balance)} ${i18n.calculator.badgeOwedToHim}`;
        tdBalance.className = 'balance-positive';
      } else if (p.balance < 0) {
        tdBalance.textContent = `${formatMoney(p.balance)} ${i18n.calculator.badgeOwes}`;
        tdBalance.className = 'balance-negative';
      } else {
        tdBalance.textContent = formatMoney(0);
        tdBalance.className = 'balance-zero';
      }

      tr.appendChild(tdName);
      tr.appendChild(tdSpent);
      tr.appendChild(tdPaid);
      tr.appendChild(tdBalance);
      tbody.appendChild(tr);
    });

    // 3. Переводы
    transfersContainer.replaceChildren();

    const tHeader = document.createElement('h4');
    tHeader.style.margin = '16px 0 8px 0';
    tHeader.textContent = i18n.calculator.transfersTitle;
    transfersContainer.appendChild(tHeader);

    if (calcResult.validReceiptsCount === 0) {
      const msg = document.createElement('p');
      msg.className = 'hint-text';
      msg.textContent = i18n.calculator.noReceiptsMessage;
      transfersContainer.appendChild(msg);
      copySummaryBtn.disabled = true;
    } else if (calcResult.transfers.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'hint-text';
      msg.textContent = i18n.calculator.allSettledMessage;
      transfersContainer.appendChild(msg);
      copySummaryBtn.disabled = false;
    } else {
      copySummaryBtn.disabled = false;
      const ul = document.createElement('ul');
      ul.className = 'transfers-list';

      calcResult.transfers.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'transfer-item';

        const fromSpan = document.createElement('span');
        fromSpan.textContent = t.fromName;

        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'transfer-arrow';
        arrowSpan.textContent = ' → ';

        const toSpan = document.createElement('span');
        toSpan.textContent = t.toName;

        const colonSpan = document.createElement('span');
        colonSpan.textContent = ': ';

        const amountSpan = document.createElement('span');
        amountSpan.className = 'transfer-amount';
        amountSpan.textContent = formatMoney(t.amount);

        li.appendChild(fromSpan);
        li.appendChild(arrowSpan);
        li.appendChild(toSpan);
        li.appendChild(colonSpan);
        li.appendChild(amountSpan);
        ul.appendChild(li);
      });

      transfersContainer.appendChild(ul);
    }
  }

  // Копирование итога
  copySummaryBtn.addEventListener('click', () => {
    const ev = getState().currentEvent;
    const calcResult = calculateEvent(ev);

    let headerLine = 'Расчёт';
    const namePart = ev.name?.trim();
    let datePart = '';
    if (ev.date) {
      const [year, month, day] = ev.date.split('-');
      if (year && month && day) {
        datePart = `${day}.${month}.${year}`;
      }
    }

    if (namePart && datePart) {
      headerLine = `Событие: ${namePart}, ${datePart}`;
    } else if (namePart) {
      headerLine = `Событие: ${namePart}`;
    } else if (datePart) {
      headerLine = `Расчёт, ${datePart}`;
    }

    const lines = [headerLine];

    if (calcResult.transfers.length === 0) {
      lines.push(i18n.calculator.allSettledMessage);
    } else {
      calcResult.transfers.forEach((t) => {
        lines.push(`${t.fromName} → ${t.toName}: ${formatMoney(t.amount)}`);
      });
    }

    const textToCopy = lines.join('\n');

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          showToast(i18n.calculator.toastCopied);
          copyFallbackContainer.style.display = 'none';
        })
        .catch(() => {
          showFallbackCopy(textToCopy);
        });
    } else {
      showFallbackCopy(textToCopy);
    }
  });

  function showFallbackCopy(text) {
    copyFallbackContainer.replaceChildren();
    copyFallbackContainer.style.display = 'flex';

    const p = document.createElement('p');
    p.className = 'hint-text';
    p.textContent = i18n.calculator.copyFallbackPrompt;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;

    copyFallbackContainer.appendChild(p);
    copyFallbackContainer.appendChild(textarea);

    textarea.focus();
    textarea.select();
  }

  // Разделитель и декоративный штрихкод
  const divider2 = document.createElement('div');
  divider2.className = 'receipt-dashed-divider';
  summaryCard.appendChild(divider2);

  const barcodeBox = document.createElement('div');
  barcodeBox.className = 'receipt-barcode-box';
  barcodeBox.setAttribute('aria-hidden', 'true');

  const barcodeBars = document.createElement('div');
  barcodeBars.className = 'receipt-barcode-bars';
  const barcodeText = document.createElement('div');
  barcodeText.className = 'receipt-barcode-text';
  barcodeText.textContent = '* DELIM-CHEKOV // 2026 *';

  barcodeBox.appendChild(barcodeBars);
  barcodeBox.appendChild(barcodeText);
  summaryCard.appendChild(barcodeBox);

  // Обертка для кнопки копирования чека
  const copyBtnWrapper = document.createElement('div');
  copyBtnWrapper.className = 'receipt-copy-wrapper';
  copyBtnWrapper.appendChild(copySummaryBtn);
  summaryCard.appendChild(copyBtnWrapper);

  summaryPaperWrapper.appendChild(summaryCard);

  // Зубчатый край отрыва ленты
  const paperCut = document.createElement('div');
  paperCut.className = 'receipt-paper-cut';
  paperCut.setAttribute('aria-hidden', 'true');
  summaryPaperWrapper.appendChild(paperCut);

  renderSummary();

  // Двухколоночный макет для ПК
  const layout = document.createElement('div');
  layout.className = 'calculator-layout';

  const mainCol = document.createElement('div');
  mainCol.className = 'calc-main-col';
  mainCol.appendChild(eventCard);
  mainCol.appendChild(participantsCard);
  mainCol.appendChild(receiptsSection);

  const sidebarCol = document.createElement('aside');
  sidebarCol.className = 'calc-sidebar-col';
  sidebarCol.setAttribute('aria-label', 'Итоговый расчёт');
  sidebarCol.appendChild(summaryPaperWrapper);

  layout.appendChild(mainCol);
  layout.appendChild(sidebarCol);
  screen.appendChild(layout);

  container.appendChild(screen);
}
