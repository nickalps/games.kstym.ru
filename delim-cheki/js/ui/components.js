// Вспомогательные UI-компоненты: тосты, модальные диалоги на <dialog>
import { i18n } from '../i18n.js';

let toastContainer = null;

export function showToast(message, duration = 3500) {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    }, { once: true });
  }, duration);
}

export function showConfirmDialog({ title, message, confirmText, isDanger = false, onConfirm }) {
  const previouslyFocused = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';

  const form = document.createElement('form');
  form.method = 'dialog';

  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    form.appendChild(h3);
  }

  const p = document.createElement('p');
  p.textContent = message;
  p.style.whiteSpace = 'pre-line';
  form.appendChild(p);

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = i18n.dialog.btnCancel;
  cancelBtn.addEventListener('click', () => {
    dialog.close();
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
  confirmBtn.textContent = confirmText || i18n.dialog.btnConfirmContinue;
  confirmBtn.addEventListener('click', () => {
    dialog.close();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  form.appendChild(actions);
  dialog.appendChild(form);

  document.body.appendChild(dialog);

  dialog.addEventListener('close', () => {
    dialog.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }, { once: true });

  dialog.showModal();
}

export function showAlertDialog({ title, message, items = [] }) {
  const previouslyFocused = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'alert-dialog';

  const form = document.createElement('form');
  form.method = 'dialog';

  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    form.appendChild(h3);
  }

  if (message) {
    const p = document.createElement('p');
    p.textContent = message;
    form.appendChild(p);
  }

  if (items && items.length > 0) {
    const ul = document.createElement('ul');
    ul.style.margin = '12px 0 0 20px';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    form.appendChild(ul);
  }

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-primary';
  closeBtn.textContent = i18n.dialog.btnClose;
  closeBtn.addEventListener('click', () => {
    dialog.close();
  });

  actions.appendChild(closeBtn);
  form.appendChild(actions);
  dialog.appendChild(form);

  document.body.appendChild(dialog);

  dialog.addEventListener('close', () => {
    dialog.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }, { once: true });

  dialog.showModal();
}

export function showImportModeDialog({ count, onConfirm }) {
  const previouslyFocused = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'import-dialog';

  const form = document.createElement('form');
  form.method = 'dialog';

  const h3 = document.createElement('h3');
  h3.textContent = i18n.settings.importDialogTitle(count);
  form.appendChild(h3);

  const group = document.createElement('div');
  group.className = 'dialog-radio-group';
  group.style.display = 'flex';
  group.style.flexDirection = 'column';
  group.style.gap = '12px';
  group.style.margin = '16px 0';

  const labelMerge = document.createElement('label');
  labelMerge.style.display = 'flex';
  labelMerge.style.alignItems = 'center';
  labelMerge.style.gap = '8px';
  labelMerge.style.cursor = 'pointer';

  const radioMerge = document.createElement('input');
  radioMerge.type = 'radio';
  radioMerge.name = 'import-mode';
  radioMerge.value = 'merge';
  radioMerge.checked = true;

  const spanMerge = document.createElement('span');
  spanMerge.textContent = i18n.settings.importModeMerge;

  labelMerge.appendChild(radioMerge);
  labelMerge.appendChild(spanMerge);

  const labelReplace = document.createElement('label');
  labelReplace.style.display = 'flex';
  labelReplace.style.alignItems = 'center';
  labelReplace.style.gap = '8px';
  labelReplace.style.cursor = 'pointer';

  const radioReplace = document.createElement('input');
  radioReplace.type = 'radio';
  radioReplace.name = 'import-mode';
  radioReplace.value = 'replace';

  const spanReplace = document.createElement('span');
  spanReplace.textContent = i18n.settings.importModeReplace;

  labelReplace.appendChild(radioReplace);
  labelReplace.appendChild(spanReplace);

  group.appendChild(labelMerge);
  group.appendChild(labelReplace);
  form.appendChild(group);

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = i18n.dialog.btnCancel;
  cancelBtn.addEventListener('click', () => {
    dialog.close();
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = i18n.settings.btnPerformImport;
  confirmBtn.addEventListener('click', () => {
    const selectedMode = radioReplace.checked ? 'replace' : 'merge';
    dialog.close();
    if (typeof onConfirm === 'function') {
      onConfirm(selectedMode);
    }
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  form.appendChild(actions);
  dialog.appendChild(form);

  document.body.appendChild(dialog);

  dialog.addEventListener('close', () => {
    dialog.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }, { once: true });

  dialog.showModal();
}
