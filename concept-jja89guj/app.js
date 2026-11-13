/**
 * NW-QUIZ CONCEPT TEST
 * Быстрый опрос для выбора визуальной концепции (16 вариантов, 15 пар на выбывание)
 */

(function () {
  'use strict';

  const CONCEPTS = window.QUIZ_CONCEPTS || [];

  // Состояние турнира хранится только в памяти вкладки
  let matches = [];
  let currentMatchIdx = 0;
  let isTransitioning = false;

  // DOM элементы
  const screenLoading = document.getElementById('screen-loading');
  const loadingText = document.getElementById('loading-text');
  const loadingProgress = document.getElementById('loading-progress');
  const loadingFill = document.getElementById('loading-fill');
  const loadingError = document.getElementById('loading-error');
  const btnRetryLoading = document.getElementById('btn-retry-loading');
  const screenQuiz = document.getElementById('screen-quiz');
  const screenResults = document.getElementById('screen-results');

  const progressText = document.getElementById('progress-text');
  const remainText = document.getElementById('remain-text');
  const progressFill = document.getElementById('progress-fill');
  const btnBack = document.getElementById('btn-back');

  const cardLeft = document.getElementById('card-left');
  const cardRight = document.getElementById('card-right');
  const titleLeft = document.getElementById('title-left');
  const titleRight = document.getElementById('title-right');
  const imgLeft = document.getElementById('img-left');
  const imgRight = document.getElementById('img-right');
  const mediaLeft = document.getElementById('media-left');
  const mediaRight = document.getElementById('media-right');
  const btnPickLeft = document.getElementById('btn-pick-left');
  const btnPickRight = document.getElementById('btn-pick-right');

  // Результаты
  const winnerBlock = document.getElementById('winner-block');
  const placementsList = document.getElementById('placements-list');
  const btnCopy = document.getElementById('btn-copy');
  const btnRestart = document.getElementById('btn-restart');
  const copyToast = document.getElementById('copy-toast');
  const fallbackBox = document.getElementById('fallback-box');
  const fallbackText = document.getElementById('fallback-text');

  // Lightbox
  const lightbox = document.getElementById('lightbox');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxStage = document.getElementById('lightbox-stage');
  const lightboxViewport = document.getElementById('lightbox-viewport');
  const zoomValue = document.getElementById('zoom-value');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');

  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  // Сохраняем объекты изображений в памяти до конца прохождения теста.
  let preloadedImages = [];

  function preloadImages() {
    const urls = [...new Set(CONCEPTS.map(concept => concept.image))];
    let loaded = 0;
    let finished = false;
    let timer;
    preloadedImages = [];
    loadingError.hidden = true;
    btnRetryLoading.hidden = true;
    loadingText.textContent = 'Загрузка 0%';
    loadingFill.style.width = '0%';
    loadingProgress.setAttribute('aria-valuenow', '0');

    function fail(message) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      preloadedImages.forEach(image => { image.onload = null; image.onerror = null; });
      loadingError.textContent = message;
      loadingError.hidden = false;
      btnRetryLoading.hidden = false;
    }

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => fail('Изображения загружаются слишком долго. Возможно, есть проблемы с сетью.'), 45000);
    }

    if (urls.length === 0 || urls.some(url => !url)) {
      fail('Не удалось подготовить изображения для теста. Попробуйте ещё раз.');
      return;
    }

    resetTimer();
    urls.forEach(url => {
      const image = new Image();
      preloadedImages.push(image);
      image.onload = () => {
        if (finished) return;
        loaded++;
        const percent = Math.round(loaded / urls.length * 100);
        loadingText.textContent = `Загрузка ${percent}%`;
        loadingFill.style.width = `${percent}%`;
        loadingProgress.setAttribute('aria-valuenow', String(percent));
        if (loaded === urls.length) {
          finished = true;
          clearTimeout(timer);
          screenLoading.hidden = true;
          initTournament();
        } else {
          resetTimer();
        }
      };
      image.onerror = () => fail('Не удалось загрузить изображения. Проверьте подключение к сети и попробуйте снова.');
      image.src = url;
    });
  }

  function getConcept(id) {
    return CONCEPTS.find(c => c.id === id) || { id, title: id, image: '' };
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // --- ИНИЦИАЛИЗАЦИЯ СЕТКИ ---
  function initTournament() {
    const seeds = shuffle(CONCEPTS.map(c => c.id));
    matches = [];

    // 15 матчей: 8 (раунд 1) + 4 (раунд 2) + 2 (полуфинал) + 1 (финал)
    for (let i = 0; i < 15; i++) {
      matches.push({
        index: i,
        leftId: i < 8 ? seeds[i * 2] : null,
        rightId: i < 8 ? seeds[i * 2 + 1] : null,
        winnerId: null,
        loserId: null
      });
    }

    currentMatchIdx = 0;
    showQuizScreen();
    renderMatch(0);
  }

  function updateDownstream() {
    // Четвертьфиналы (8..11)
    for (let i = 8; i <= 11; i++) {
      const leftP = (i - 8) * 2;
      const rightP = leftP + 1;
      const newL = matches[leftP].winnerId;
      const newR = matches[rightP].winnerId;

      if (matches[i].leftId !== newL || matches[i].rightId !== newR) {
        matches[i].leftId = newL;
        matches[i].rightId = newR;
        if (matches[i].winnerId && matches[i].winnerId !== newL && matches[i].winnerId !== newR) {
          matches[i].winnerId = null;
          matches[i].loserId = null;
        }
      }
    }

    // Полуфиналы (12..13)
    for (let i = 12; i <= 13; i++) {
      const leftP = 8 + (i - 12) * 2;
      const rightP = leftP + 1;
      const newL = matches[leftP].winnerId;
      const newR = matches[rightP].winnerId;

      if (matches[i].leftId !== newL || matches[i].rightId !== newR) {
        matches[i].leftId = newL;
        matches[i].rightId = newR;
        if (matches[i].winnerId && matches[i].winnerId !== newL && matches[i].winnerId !== newR) {
          matches[i].winnerId = null;
          matches[i].loserId = null;
        }
      }
    }

    // Финал (14)
    const finL = matches[12].winnerId;
    const finR = matches[13].winnerId;
    if (matches[14].leftId !== finL || matches[14].rightId !== finR) {
      matches[14].leftId = finL;
      matches[14].rightId = finR;
      if (matches[14].winnerId && matches[14].winnerId !== finL && matches[14].winnerId !== finR) {
        matches[14].winnerId = null;
        matches[14].loserId = null;
      }
    }
  }

  function showQuizScreen() {
    screenQuiz.hidden = false;
    screenResults.hidden = true;
    window.scrollTo(0, 0);
  }

  function showResultsScreen() {
    screenQuiz.hidden = true;
    screenResults.hidden = false;
    window.scrollTo(0, 0);
    renderResults();
  }

  // --- ОТРИСОВКА ПАРЫ ---
  function renderMatch(idx) {
    if (idx < 0 || idx >= 15) return;
    updateDownstream();

    currentMatchIdx = idx;
    const m = matches[idx];

    // Прогресс
    const answeredCount = matches.filter(x => x.winnerId !== null).length;
    const remainingCount = 15 - answeredCount;

    progressText.textContent = `Вопрос ${idx + 1} из 15`;
    remainText.textContent = remainingCount > 0 ? `Осталось: ${remainingCount}` : 'Финал!';
    progressFill.style.width = `${(answeredCount / 15) * 100}%`;

    btnBack.disabled = (idx === 0);

    cardLeft.classList.remove('is-selected', 'is-dimmed');
    cardRight.classList.remove('is-selected', 'is-dimmed');

    const cLeft = getConcept(m.leftId);
    const cRight = getConcept(m.rightId);

    titleLeft.textContent = cLeft.title;
    imgLeft.src = cLeft.image;
    imgLeft.alt = cLeft.title;

    titleRight.textContent = cRight.title;
    imgRight.src = cRight.image;
    imgRight.alt = cRight.title;

    if (m.winnerId === cLeft.id) cardLeft.classList.add('is-selected');
    if (m.winnerId === cRight.id) cardRight.classList.add('is-selected');

    // Клик на картинку открывает Lightbox
    mediaLeft.onclick = () => openLightbox(cLeft);
    mediaRight.onclick = () => openLightbox(cRight);

  }

  // --- ВЫБОР ВАРИАНТА ---
  function chooseWinner(side) {
    if (isTransitioning) return;
    const m = matches[currentMatchIdx];
    const winnerId = side === 'left' ? m.leftId : m.rightId;
    const loserId = side === 'left' ? m.rightId : m.leftId;

    if (!winnerId || !loserId) return;

    isTransitioning = true;
    btnPickLeft.disabled = true;
    btnPickRight.disabled = true;

    const chosenCard = side === 'left' ? cardLeft : cardRight;
    const otherCard = side === 'left' ? cardRight : cardLeft;

    chosenCard.classList.add('is-selected');
    otherCard.classList.add('is-dimmed');

    m.winnerId = winnerId;
    m.loserId = loserId;

    updateDownstream();

    setTimeout(() => {
      isTransitioning = false;
      btnPickLeft.disabled = false;
      btnPickRight.disabled = false;

      if (currentMatchIdx === 14) {
        showResultsScreen();
      } else {
        renderMatch(currentMatchIdx + 1);
      }
    }, 250);
  }

  // --- РЕЗУЛЬТАТЫ ---
  function renderResults() {
    const winner = getConcept(matches[14].winnerId);
    const runnerUp = getConcept(matches[14].loserId);

    const semiLosers = [matches[12].loserId, matches[13].loserId].map(getConcept);
    const quarterLosers = [matches[8].loserId, matches[9].loserId, matches[10].loserId, matches[11].loserId].map(getConcept);
    const round1Losers = [];
    for (let i = 0; i < 8; i++) {
      round1Losers.push(getConcept(matches[i].loserId));
    }

    // Карточка победителя
    winnerBlock.innerHTML = `
      <div class="winner-badge">🏆 1 МЕСТО · ТВОЙ ФАВОРИТ</div>
      <div class="winner-name">${winner.title}</div>
      <div class="winner-img-wrap" id="winner-img-wrap">
        <img src="${winner.image}" alt="${winner.title}">
      </div>
    `;
    document.getElementById('winner-img-wrap').onclick = () => openLightbox(winner);

    // Списки остальных мест
    const groups = [
      { title: '🥈 2 место (Финалист)', items: [runnerUp] },
      { title: '🥉 3–4 места (Полуфинал)', items: semiLosers },
      { title: '5–8 места (Четвертьфинал)', items: quarterLosers },
      { title: '9–16 места (Первый раунд)', items: round1Losers }
    ];

    placementsList.innerHTML = groups.map(g => `
      <div class="place-group">
        <div class="place-group-title">${g.title}</div>
        <div class="place-group-items">
          ${g.items.map(item => `
            <div class="mini-card" data-id="${item.id}">
              <div class="mini-card-title">${item.title}</div>
              <div class="mini-card-thumb">
                <img src="${item.image}" alt="${item.title}">
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    placementsList.querySelectorAll('.mini-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.onclick = () => openLightbox(getConcept(id));
    });

    copyToast.hidden = true;
    fallbackBox.hidden = true;
  }

  // --- КОПИРОВАНИЕ РЕЗУЛЬТАТА ---
  function getShareText() {
    const winner = getConcept(matches[14].winnerId);
    const runnerUp = getConcept(matches[14].loserId);
    const semi = [matches[12].loserId, matches[13].loserId].map(id => getConcept(id).title).join(', ');
    const quarter = [matches[8].loserId, matches[9].loserId, matches[10].loserId, matches[11].loserId].map(id => getConcept(id).title).join(', ');
    const r1 = [];
    for (let i = 0; i < 8; i++) r1.push(getConcept(matches[i].loserId).title);

    return [
      'Мой выбор визуальной концепции викторины:',
      '',
      `🏆 1 место: ${winner.title} (${winner.id})`,
      `🥈 2 место: ${runnerUp.title} (${runnerUp.id})`,
      `🥉 3–4 места: ${semi}`,
      `5–8 места: ${quarter}`,
      `9–16 места: ${r1.join(', ')}`,
      '',
      'Все 15 сравнений пройдены!'
    ].join('\n');
  }

  async function copyResult() {
    const text = getShareText();
    copyToast.hidden = true;
    fallbackBox.hidden = true;

    let ok = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (e) {
        ok = false;
      }
    }

    if (ok) {
      copyToast.hidden = false;
      btnCopy.textContent = '✓ Скопировано!';
      setTimeout(() => {
        btnCopy.textContent = 'Скопировать результат';
      }, 2500);
    } else {
      fallbackBox.hidden = false;
      fallbackText.value = text;
      fallbackText.focus();
      fallbackText.select();
    }
  }

  // --- LIGHTBOX (ПРОСМОТР КАРТИНОК) ---
  function updateTransform() {
    lightboxStage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    zoomValue.textContent = `${Math.round(zoomScale * 100)}%`;
  }

  function resetZoom() {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    updateTransform();
  }

  function setScale(s) {
    zoomScale = Math.max(1, Math.min(4, s));
    if (zoomScale === 1) {
      panX = 0;
      panY = 0;
    }
    updateTransform();
  }

  function openLightbox(concept) {
    lightboxTitle.textContent = concept.title;
    lightboxImg.src = concept.image;
    resetZoom();
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
  }

  function setupLightbox() {
    btnZoomIn.onclick = () => setScale(zoomScale + 0.35);
    btnZoomOut.onclick = () => setScale(zoomScale - 0.35);
    btnZoomReset.onclick = resetZoom;
    btnCloseLightbox.onclick = closeLightbox;

    window.addEventListener('keydown', (e) => {
      if (!lightbox.hidden && e.key === 'Escape') {
        closeLightbox();
      }
    });

    // Зум колёсиком
    lightboxViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      setScale(zoomScale + (e.deltaY < 0 ? 0.25 : -0.25));
    }, { passive: false });

    // Перетаскивание мышью
    lightboxViewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      lightboxViewport.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        lightboxViewport.classList.remove('is-dragging');
      }
    });

    // Touch pinch and pan
    let touchDist = 0;
    let touchScale = 1;

    lightboxViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchScale = zoomScale;
      }
    }, { passive: false });

    lightboxViewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        updateTransform();
      } else if (e.touches.length === 2 && touchDist > 0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        setScale(touchScale * (dist / touchDist));
      }
    }, { passive: false });

    lightboxViewport.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isDragging = false;
        touchDist = 0;
      }
    });
  }

  // --- ОБРАБОТЧИКИ ---
  function setupEvents() {
    btnPickLeft.onclick = () => chooseWinner('left');
    btnPickRight.onclick = () => chooseWinner('right');

    btnBack.onclick = () => {
      if (isTransitioning || currentMatchIdx <= 0) return;
      renderMatch(currentMatchIdx - 1);
    };

    btnCopy.onclick = copyResult;
    btnRestart.onclick = initTournament;
  }

  // СТАРТ ПРИ ЗАГРУЗКЕ
  setupLightbox();
  setupEvents();
  btnRetryLoading.onclick = preloadImages;
  preloadImages();
})();
