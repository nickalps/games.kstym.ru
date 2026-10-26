// Точка входа приложения, инициализация и hash-роутер
import { i18n } from './i18n.js';
import { loadSettings, applyTheme } from './storage.js';
import { initDraft } from './state.js';
import { renderCalculator } from './ui/calculator.js';
import { renderEvents } from './ui/events.js';
import { renderSettings } from './ui/settings.js';

// Применяем тему оформления при инициализации
applyTheme(loadSettings().theme);

function initRouter() {
  const appContainer = document.getElementById('app');
  const navLinks = document.querySelectorAll('.nav-link');

  // Инициализируем черновик перед отрисовкой
  initDraft();

  function handleRoute() {
    let hash = window.location.hash || '#/';
    if (!['#/', '#/events', '#/settings'].includes(hash)) {
      window.location.hash = '#/';
      return;
    }

    // Обновляем состояние навигации
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      const isActive = href === hash;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // Отрисовываем нужный экран
    if (hash === '#/events') {
      renderEvents(appContainer);
    } else if (hash === '#/settings') {
      renderSettings(appContainer);
    } else {
      renderCalculator(appContainer);
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
});
