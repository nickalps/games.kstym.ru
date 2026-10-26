// Экран настроек, экспорта и импорта
import { i18n } from '../i18n.js';
import {
  loadSettings,
  saveSettings,
  applyTheme,
  loadEvents,
  validateImportData,
  importEvents,
  clearAllData
} from '../storage.js';
import { resetToNew } from '../state.js';
import {
  showToast,
  showConfirmDialog,
  showAlertDialog,
  showImportModeDialog
} from './components.js';

export function renderSettings(container) {
  container.replaceChildren();

  const currentSettings = loadSettings();

  const screen = document.createElement('section');
  screen.className = 'screen screen-settings';

  const h2 = document.createElement('h2');
  h2.textContent = i18n.settings.title;
  screen.appendChild(h2);

  // ==========================================
  // 1. Тема оформления
  // ==========================================
  const themeCard = document.createElement('div');
  themeCard.className = 'card theme-card';

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'theme-fieldset';

  const legend = document.createElement('legend');
  legend.className = 'theme-legend';
  legend.textContent = i18n.settings.themeTitle;
  fieldset.appendChild(legend);

  const themeGroup = document.createElement('div');
  themeGroup.className = 'theme-selector-group';

  const options = [
    { value: 'system', label: i18n.settings.themeSystem },
    { value: 'light', label: i18n.settings.themeLight },
    { value: 'dark', label: i18n.settings.themeDark }
  ];

  options.forEach((opt) => {
    const label = document.createElement('label');
    label.className = 'theme-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = opt.value;
    radio.checked = currentSettings.theme === opt.value;

    radio.addEventListener('change', () => {
      if (radio.checked) {
        currentSettings.theme = opt.value;
        saveSettings(currentSettings);
        applyTheme(opt.value);
      }
    });

    const span = document.createElement('span');
    span.textContent = opt.label;

    label.appendChild(radio);
    label.appendChild(span);
    themeGroup.appendChild(label);
  });

  fieldset.appendChild(themeGroup);
  themeCard.appendChild(fieldset);
  screen.appendChild(themeCard);

  // ==========================================
  // 2. Состав по умолчанию
  // ==========================================
  const defParticipantsCard = document.createElement('div');
  defParticipantsCard.className = 'card default-participants-card';

  const defPartTitle = document.createElement('h3');
  defPartTitle.textContent = i18n.settings.defaultParticipantsTitle;
  defParticipantsCard.appendChild(defPartTitle);

  const defPartHint = document.createElement('p');
  defPartHint.className = 'hint-text';
  defPartHint.textContent = i18n.settings.defaultParticipantsHint;
  defParticipantsCard.appendChild(defPartHint);

  const defParticipantsList = document.createElement('div');
  defParticipantsList.className = 'participants-list';
  defParticipantsCard.appendChild(defParticipantsList);

  // Форма добавления участника
  const addDefPartForm = document.createElement('form');
  addDefPartForm.className = 'participant-form-container';
  addDefPartForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddDefaultParticipant();
  });

  const addDefPartRow = document.createElement('div');
  addDefPartRow.className = 'participant-form';

  const addDefPartInput = document.createElement('input');
  addDefPartInput.type = 'text';
  addDefPartInput.placeholder = i18n.calculator.participantAddPlaceholder;
  addDefPartInput.maxLength = 30;
  addDefPartInput.setAttribute('aria-label', i18n.calculator.participantAddPlaceholder);

  const addDefPartBtn = document.createElement('button');
  addDefPartBtn.type = 'submit';
  addDefPartBtn.className = 'btn btn-primary btn-sm';
  addDefPartBtn.textContent = i18n.calculator.btnAddParticipant;

  addDefPartRow.appendChild(addDefPartInput);
  addDefPartRow.appendChild(addDefPartBtn);
  addDefPartForm.appendChild(addDefPartRow);

  const addDefPartError = document.createElement('div');
  addDefPartError.className = 'field-error';
  addDefPartError.setAttribute('role', 'alert');
  addDefPartError.style.display = 'none';
  addDefPartForm.appendChild(addDefPartError);

  defParticipantsCard.appendChild(addDefPartForm);

  function handleAddDefaultParticipant() {
    const rawName = addDefPartInput.value.trim();
    if (!rawName) {
      showDefPartError(i18n.calculator.errorParticipantEmpty);
      return;
    }
    if (rawName.length > 30) {
      showDefPartError(i18n.calculator.errorParticipantNameLength);
      return;
    }

    const list = currentSettings.defaultParticipants || [];
    if (list.length >= 30) {
      showDefPartError(i18n.calculator.errorParticipantLimit);
      return;
    }

    const isDuplicate = list.some((name) => name.toLowerCase() === rawName.toLowerCase());
    if (isDuplicate) {
      showDefPartError(i18n.calculator.errorParticipantDuplicate);
      return;
    }

    list.push(rawName);
    currentSettings.defaultParticipants = list;
    saveSettings(currentSettings);

    addDefPartInput.value = '';
    clearDefPartError();
    renderDefParticipants();
  }

  function showDefPartError(msg) {
    addDefPartError.textContent = msg;
    addDefPartError.style.display = 'block';
    addDefPartInput.setAttribute('aria-invalid', 'true');
  }

  function clearDefPartError() {
    addDefPartError.style.display = 'none';
    addDefPartInput.removeAttribute('aria-invalid');
  }

  addDefPartInput.addEventListener('input', () => {
    if (addDefPartError.style.display !== 'none') {
      clearDefPartError();
    }
  });

  function renderDefParticipants() {
    defParticipantsList.replaceChildren();
    const list = currentSettings.defaultParticipants || [];
    const minDisabled = list.length <= 2;

    list.forEach((name, index) => {
      const chip = document.createElement('div');
      chip.className = 'chip';

      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'chip-name';
      nameBtn.textContent = name;
      nameBtn.title = 'Нажмите, чтобы переименовать';

      nameBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chip-input-inline';
        input.maxLength = 30;
        input.value = name;

        function commitRename() {
          const newName = input.value.trim();
          if (newName && newName !== name) {
            const isDuplicate = list.some((n, idx) => idx !== index && n.toLowerCase() === newName.toLowerCase());
            if (isDuplicate) {
              showToast(i18n.calculator.errorParticipantDuplicate);
              renderDefParticipants();
              return;
            }
            list[index] = newName;
            currentSettings.defaultParticipants = list;
            saveSettings(currentSettings);
          }
          renderDefParticipants();
        }

        input.addEventListener('blur', commitRename);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            input.blur();
          } else if (ke.key === 'Escape') {
            renderDefParticipants();
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
      removeBtn.setAttribute('aria-label', `${i18n.calculator.btnRemoveParticipantAria} ${name}`);
      removeBtn.disabled = minDisabled;

      removeBtn.addEventListener('click', () => {
        if (list.length <= 2) return;
        list.splice(index, 1);
        currentSettings.defaultParticipants = list;
        saveSettings(currentSettings);
        renderDefParticipants();
      });

      chip.appendChild(nameBtn);
      chip.appendChild(removeBtn);
      defParticipantsList.appendChild(chip);
    });
  }

  renderDefParticipants();
  screen.appendChild(defParticipantsCard);

  // ==========================================
  // 3. Резервная копия (Экспорт и Импорт)
  // ==========================================
  const backupCard = document.createElement('div');
  backupCard.className = 'card backup-card';

  const backupTitle = document.createElement('h3');
  backupTitle.textContent = i18n.settings.backupTitle;
  backupCard.appendChild(backupTitle);

  const backupActions = document.createElement('div');
  backupActions.className = 'section-header';
  backupActions.style.justifyContent = 'flex-start';
  backupActions.style.gap = '12px';

  // Экспорт
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn btn-primary';
  exportBtn.textContent = i18n.settings.btnExportBackup;

  const exportHint = document.createElement('span');
  exportHint.className = 'hint-text';
  exportHint.textContent = i18n.settings.hintNoEventsToExport;

  function updateExportBtnState() {
    const events = loadEvents();
    const hasEvents = events.length > 0;
    exportBtn.disabled = !hasEvents;
    exportHint.style.display = hasEvents ? 'none' : 'inline';
  }

  exportBtn.addEventListener('click', () => {
    const events = loadEvents();
    if (events.length === 0) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const filename = `delim-chekov-backup-${year}-${month}-${day}.json`;

    const exportData = {
      app: 'delim-chekov',
      schemaVersion: 1,
      exportedAt: nowIso,
      events
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Импорт
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.style.display = 'none';

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'btn btn-secondary';
  importBtn.textContent = i18n.settings.btnImportBackup;

  importBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    // Лимит 5 МБ
    if (file.size > 5 * 1024 * 1024) {
      showAlertDialog({
        title: 'Ошибка импорта',
        message: 'Файл слишком большой. Максимальный размер файла — 5 МБ.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawText = reader.result;
      const valResult = validateImportData(rawText);

      if (!valResult.isValid) {
        showAlertDialog({
          title: 'Ошибка импорта',
          message: 'Файл содержит ошибки и не может быть импортирован:',
          items: valResult.errors
        });
        return;
      }

      showImportModeDialog({
        count: valResult.sanitizedEvents.length,
        onConfirm: (mode) => {
          if (mode === 'replace') {
            showConfirmDialog({
              title: 'Замена событий',
              message: i18n.settings.confirmReplaceAllEvents,
              confirmText: i18n.dialog.btnConfirmReplace,
              isDanger: true,
              onConfirm: () => {
                const stats = importEvents(valResult.sanitizedEvents, 'replace');
                showToast(i18n.settings.importResultToast(stats.added, stats.updated, stats.skipped));
                updateExportBtnState();
              }
            });
          } else {
            const stats = importEvents(valResult.sanitizedEvents, 'merge');
            showToast(i18n.settings.importResultToast(stats.added, stats.updated, stats.skipped));
            updateExportBtnState();
          }
        }
      });
    };

    reader.onerror = () => {
      showAlertDialog({
        title: 'Ошибка импорта',
        message: i18n.settings.errorImportFileRead
      });
    };

    reader.readAsText(file);
  });

  backupActions.appendChild(exportBtn);
  backupActions.appendChild(exportHint);
  backupActions.appendChild(importBtn);
  backupActions.appendChild(fileInput);
  backupCard.appendChild(backupActions);

  updateExportBtnState();
  screen.appendChild(backupCard);

  // ==========================================
  // 4. Опасная зона
  // ==========================================
  const dangerCard = document.createElement('div');
  dangerCard.className = 'card danger-card';

  const dangerTitle = document.createElement('h3');
  dangerTitle.style.color = 'var(--color-danger)';
  dangerTitle.textContent = i18n.settings.dangerZoneTitle;
  dangerCard.appendChild(dangerTitle);

  const dangerDesc = document.createElement('p');
  dangerDesc.className = 'hint-text';
  dangerDesc.textContent = 'Удаление всех сохранённых событий, черновика и настроек приложения.';
  dangerCard.appendChild(dangerDesc);

  const deleteAllBtn = document.createElement('button');
  deleteAllBtn.type = 'button';
  deleteAllBtn.className = 'btn btn-danger';
  deleteAllBtn.style.alignSelf = 'flex-start';
  deleteAllBtn.textContent = i18n.settings.btnDeleteAllData;

  deleteAllBtn.addEventListener('click', () => {
    // Двойное подтверждение
    showConfirmDialog({
      title: i18n.settings.dangerZoneTitle,
      message: i18n.settings.confirmDeleteAllData1,
      confirmText: i18n.dialog.btnConfirmDelete,
      isDanger: true,
      onConfirm: () => {
        showConfirmDialog({
          title: i18n.settings.dangerZoneTitle,
          message: i18n.settings.confirmDeleteAllData2,
          confirmText: i18n.dialog.btnConfirmDelete,
          isDanger: true,
          onConfirm: () => {
            clearAllData();
            resetToNew();
            renderSettings(container);
            showToast('Все данные удалены');
          }
        });
      }
    });
  });

  dangerCard.appendChild(deleteAllBtn);
  screen.appendChild(dangerCard);

  // ==========================================
  // 5. Пометка о локальном хранении
  // ==========================================
  const noticeCard = document.createElement('div');
  noticeCard.className = 'card placeholder-card';
  noticeCard.style.padding = '20px';

  const noticeP = document.createElement('p');
  noticeP.className = 'hint-text';
  noticeP.textContent = i18n.settings.storageNotice;
  noticeCard.appendChild(noticeP);

  screen.appendChild(noticeCard);

  container.appendChild(screen);
}
