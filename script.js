  /* =========================================================
  OVERVIEW SITE (PART 1/4)
  1) Justified Layout: items収集 / render / resize
  2) Grouping + Caption: data-title 単位でグループ化して先頭にだけキャプション
  3) Group Highlight: PC=hover / Touch=1st tap highlight, 2nd tap -> lightboxへ
  ========================================================= */

  /* =========================
  1) Justified Layout 設定（レスポンシブ）
  - row height / box spacing を viewport 幅で可変にする
  ========================= */

(function () {
  const container = document.getElementById('grid');
  if (!container) return;


  function getRowHeight() {
    const w = window.innerWidth;
    if (w <= 480) return 180;   // iPhone
    if (w <= 768) return 160;   // tablet small
    if (w <= 1200) return 170;  // laptop
    return 180;                 // desktop
  }

  function getBoxSpacing() {
    const w = window.innerWidth;
    if (w <= 480) return 10;
    if (w <= 768) return 9;
    if (w <= 1200) return 8;
    return 7;
  }

  /* =========================
     2) Overview items 収集（.jl-item 想定）
     - data-w / data-h から aspect ratio を作る
     ========================= */

  const itemElements = Array.from(container.children);

  const items = itemElements.map((el) => {
    const w = Number(el.dataset.w) || 1;
    const h = Number(el.dataset.h) || 1;
    return { el, aspectRatio: w / h };
  });

  /* =========================
     3) Grouping + Caption 生成（data-title 単位）
     - key = title + line1 でグループ化
     - グループ先頭だけ figcaption(.ov-cap) を付与
     - 先頭アイテムは data-head="1" を付ける
     ========================= */

  const groups = new Map(); // key -> { title, line1, line2, members[] }

  itemElements.forEach((el) => {
    // 画像 or 動画のメタ情報を取得（.lb-data があれば優先、なければ img）
    const meta = el.querySelector('.lb-data, img');
    if (!meta) return;

    let title = meta.dataset.title || '';
    const line1 = meta.dataset.line1 || '';
    const line2 = meta.dataset.line2 || '';

    // title が空なら line1 を仮タイトル扱い
    if (!title && line1) title = line1;

    // 両方空ならスキップ
    if (!title) return;

    const key = `${title}|||${line1}`;

    if (!groups.has(key)) {
      groups.set(key, { title, line1, line2, members: [] });
    }
    groups.get(key).members.push(el);

    // このアイテムが属するグループキーをDOMにも保存
    el.dataset.groupKey = key;
  });

  // グループ先頭だけキャプションを付与
  groups.forEach((group) => {
    if (!group.members.length) return;

    const headEl = group.members[0];
    headEl.dataset.head = '1';

    const cap = document.createElement('figcaption');
    cap.className = 'ov-cap';

    // title と line1 の関係で表示を分ける
    if (group.title === group.line1) {
      // data-title="" だった → line1 がタイトル扱い
      const b = document.createElement('b');
      b.textContent = group.line1;
      cap.appendChild(b);
    } else {
      // 通常ケース：title がメイン、line1 がサブ
      const b = document.createElement('b');
      b.textContent = group.title;
      cap.appendChild(b);

      if (group.line1) {
        const em = document.createElement('em');
        em.textContent = group.line1;
        cap.appendChild(em);
      }
    }

    if (group.line2) {
      const i = document.createElement('i');
      i.textContent = group.line2;
      cap.appendChild(i);
    }

    headEl.appendChild(cap);
  });

  /* =========================
     4) Group Highlight 制御（Hover / Tap 共通）
     - clear: ハイライト解除
     - set: keyから同グループのメンバーにclass付与
     ========================= */

  function clearGroupHighlight() {
    container.classList.remove('is-group-hover', 'is-group-tap');
    itemElements.forEach((el) => {
      el.classList.remove('is-in-group', 'tap-armed');
    });
  }

  function setGroupHighlightByKey(key, mode) {
    const group = groups.get(key);
    if (!group) return;

    clearGroupHighlight();

    group.members.forEach((el) => el.classList.add('is-in-group'));

    if (mode === 'hover') container.classList.add('is-group-hover');
    if (mode === 'tap') container.classList.add('is-group-tap');
  }

  /* =========================
     5) PC: hoverでグループをハイライト
     ========================= */

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    itemElements.forEach((el) => {
      const key = el.dataset.groupKey;
      if (!key) return;

      el.addEventListener('mouseenter', () => {
        setGroupHighlightByKey(key, 'hover');
      });

      el.addEventListener('mouseleave', () => {
        clearGroupHighlight();
      });
    });
  }

  /* =========================
     6) Touch: 1回目タップでハイライト、2回目でLightboxへ
     - capture=true で Lightbox の click より先に処理
     ========================= */

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  if (isTouchDevice) {
    let armedItem = null;

    container.addEventListener('click', (e) => {
      const item = e.target.closest('.jl-item');
      if (!item) return;

      const key = item.dataset.groupKey;
      if (!key) return;

      // 1st tap: highlight only
      if (armedItem !== item) {
        e.preventDefault();
        e.stopPropagation();

        armedItem = item;
        item.classList.add('tap-armed');
        setGroupHighlightByKey(key, 'tap');
        return;
      }

      // 2nd tap: release highlight, then allow Lightbox handler to run
      clearGroupHighlight();
      armedItem = null;
    }, true);
  }

  /* =========================
     7) Justified Layout: render
     - items(aspectRatio) -> justifiedLayout -> boxes を absolute 配置
     ========================= */

  function render() {
    const jl = window.justifiedLayout;
    if (!jl) {
      console.error('justifiedLayout が見つかりません');
      return;
    }

    const containerWidth = container.clientWidth;
    if (!containerWidth) return;

    const layout = jl(
      items.map((i) => ({ aspectRatio: i.aspectRatio })),
      {
        containerWidth,
        targetRowHeight: getRowHeight(),
        boxSpacing: getBoxSpacing()
      }
    );

    container.style.height = layout.containerHeight + 'px';

    layout.boxes.forEach((box, index) => {
      const el = items[index].el;
      el.style.position = 'absolute';
      el.style.left = box.left + 'px';
      el.style.top = box.top + 'px';
      el.style.width = box.width + 'px';
      el.style.height = box.height + 'px';
    });

    document.body.classList.add('jl-ready');
  }

  // 初回描画
  render();

  /* =========================
     8) resize: debounceしてrender
     ========================= */

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      render();
    }, 150);
  });

})();













/* =========================================================
   OVERVIEW SITE (PART 2/4)
   Lightbox (gm)
   - #grid の .jl-item を起点に、画像/動画を Lightbox 表示
   - 画像は decode() ベースでプリロード＋前後先読み
   - キーボード(ESC/←/→)とスワイプ対応
   - Lightbox中は body に .lb-open を付けてUI制御可能
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* =========================
     1) Lightbox DOM 参照
     ========================= */

  const gm = document.getElementById('gm');
  if (!gm) return;

  const gmFrame = gm.querySelector('.gm-frame');
  const gmImg   = gm.querySelector('#gmImage');
  const gmVWrap = gm.querySelector('.gm-video-wrap');
  const gmVideo = gm.querySelector('#gmVideo');

  const gmTitle = gm.querySelector('.gm-ttl');
  const gmSub   = gm.querySelector('.gm-sub');
  const gmCount = gm.querySelector('.gm-counter');

  const gmClose = gm.querySelector('.gm-close');
  const gmPrev  = gm.querySelector('.gm-prev');
  const gmNext  = gm.querySelector('.gm-next');
  const gmBg    = gm.querySelector('.gm-backdrop');

  /* =========================
     2) サムネ（Overview items）
     ========================= */

  const thumbItems = Array.from(document.querySelectorAll('#grid .jl-item'));
  if (!thumbItems.length) return;

  /* =========================
     3) 状態（index / cache）
     ========================= */

  let currentIndex = 0;

  // full src -> { image, promise }
  const imgCache = new Map();

  /* =========================
     4) 画像プリロード（decode優先）
     ========================= */

  function preloadFullImage(full) {
    if (!full) return null;

    const cached = imgCache.get(full);
    if (cached) return cached;

    const image = new Image();
    image.src = full;

    let promise;
    if (image.decode) {
      promise = image.decode().catch(() => {});
    } else {
      promise = new Promise((resolve) => {
        image.onload  = () => resolve();
        image.onerror = () => resolve();
      });
    }

    const record = { image, promise };
    imgCache.set(full, record);
    return record;
  }

  function preloadAround(index) {
    const targets = [index + 1, index - 1, index + 2, index - 2];

    targets.forEach((i) => {
      const safeIndex = (i + thumbItems.length) % thumbItems.length;
      const item = thumbItems[safeIndex];
      if (!item || item.classList.contains('is-video')) return;

      const img = item.querySelector('img');
      if (!img) return;

      const full = img.dataset.full || img.src;
      preloadFullImage(full);
    });
  }

  /* =========================
     5) キャプション / カウンター更新
     ========================= */

  function updateCaption(img, meta) {
    // 画像の data-* を優先、なければ .lb-data の data-* を使う
    const t  = (img && img.dataset.title) || (meta && meta.dataset.title) || '';
    const l1 = (img && img.dataset.line1) || (meta && meta.dataset.line1) || '';
    const l2 = (img && img.dataset.line2) || (meta && meta.dataset.line2) || '';

    gmTitle.textContent = t;
    gmSub.textContent   = [l1, l2].filter(Boolean).join(' / ');
  }

  function updateCounter() {
    gmCount.textContent = `${currentIndex + 1} / ${thumbItems.length}`;
  }

  /* =========================
     6) 表示（画像 / 動画）
     ========================= */

function showImage(img) {
  const full = img.dataset.full || img.src;
  const record = preloadFullImage(full);

  const apply = () => {
    gmImg.style.pointerEvents = ''; // 追加：画像はクリック可能に戻す
    gmImg.src = full;
    gmImg.hidden = false;
    gmImg.classList.add('ready');
  };

  if (record && record.promise) record.promise.then(apply);
  else apply();
}

function showVideo(meta) {
  const src = meta.dataset.full;
  if (!src) return;

  gmImg.hidden = true;
  gmImg.classList.remove('ready');
  gmImg.style.pointerEvents = 'none';

  gmVWrap.hidden = false;
  gmVideo.hidden = false;
  gmVWrap.classList.remove('is-ready');

  gmVideo.loop = true;

  if (gmVideo.src !== src) {
    gmVideo.src = src;
  }

  gmVideo.currentTime = 0;

  gmVideo.addEventListener('loadedmetadata', () => {
    const isPortrait = (gmVideo.videoHeight / gmVideo.videoWidth) > 1.15;
    gm.classList.toggle('is-portrait-video', isPortrait);
  }, { once: true });

  gmVideo.addEventListener('loadeddata', () => {
    gmVWrap.classList.add('is-ready');
  }, { once: true });

  const p = gmVideo.play();
  if (p && p.then) p.catch(() => {});
}


  /* =========================
     7) Open / Close
     ========================= */

function resetMedia() {
  // image reset
  gmImg.src = '';
  gmImg.classList.remove('ready');
  gmImg.hidden = false;

  // 追加：動画で殺した pointerEvents を必ず戻す
  gmImg.style.pointerEvents = '';

  // video reset
  gmVideo.pause();
  gmVideo.removeAttribute('src');
  gmVideo.currentTime = 0;

  gmVideo.hidden = true;
  gmVWrap.hidden = true;
  gmVWrap.classList.remove('is-ready');

  gm.classList.remove('is-portrait-video');
}

function closeModal() {
  gm.setAttribute('aria-hidden', 'true');
  resetMedia();
  document.body.classList.remove('lb-open');

  const controls = gm.querySelector('.sv-controls');
  if (controls) {
    controls.classList.remove('is-visible');
    controls.style.opacity = '';
    controls.style.pointerEvents = '';
  }
}

function openAt(index) {
  currentIndex = (index + thumbItems.length) % thumbItems.length;

  const item = thumbItems[currentIndex];
  const img  = item.querySelector('img');
  const meta = item.querySelector('.lb-data');

  // ① 先に表示（レイアウトツリーに乗せる）
  gm.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lb-open');

  // ② 次のフレームで中身を差し替える（Safari安定策）
  requestAnimationFrame(() => {
    resetMedia();

    if (meta && meta.dataset.type === 'video') {
      showVideo(meta);
    } else if (img) {
      showImage(img);
    }

    updateCaption(img, meta);
    updateCounter();
    preloadAround(currentIndex);
  });
}

  /* =========================
     8) Events: サムネクリック → open
     ========================= */

  thumbItems.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      openAt(index);
    });
  });

  /* =========================
     9) Events: ナビゲーション / 閉じる
     ========================= */

  gmPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    openAt(currentIndex - 1);
  });

  gmNext.addEventListener('click', (e) => {
    e.stopPropagation();
    openAt(currentIndex + 1);
  });

  gmClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });

  gmBg.addEventListener('click', () => {
    closeModal();
  });

  /* =========================
     10) Events: キーボード（開いている時のみ）
     ========================= */

  window.addEventListener('keydown', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      openAt(currentIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      openAt(currentIndex - 1);
    }
  });

  /* =========================
     11) Events: スワイプ（左右で前後）
     - 動画領域/コントロール上のタッチは除外
     ========================= */

  let touchStartX = 0;
  let touchStartY = 0;
  let touchOnControls = false;

  gm.addEventListener('touchstart', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    const t = e.touches[0];
    if (!t) return;

    const target = e.target;

    // 動画エリア・コントロール上はスワイプ無効
    if (
      target.closest('.gm-video-wrap') ||
      target.closest('.sv-controls')
    ) {
      touchOnControls = true;
      return;
    }

    touchOnControls = false;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  gm.addEventListener('touchend', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    if (touchOnControls) {
      touchOnControls = false;
      return;
    }

    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    const minDist = 50;
    const maxVert = 40;

    if (Math.abs(dx) > minDist && Math.abs(dy) < maxVert) {
      e.preventDefault();

      if (dx < 0) openAt(currentIndex + 1);
      else openAt(currentIndex - 1);
    }
  }, { passive: false });

});








/* =========================================================
   OVERVIEW SITE (PART 3/4)
   Lightbox (gm)
   ========================================================= */

/* =========================================================
   OVERVIEW SITE (PART 4/4)
   Lightbox (gm) - Video Controls
   ========================================================= */

function initGmVideoControls() {
  const gm = document.getElementById('gm');
  if (!gm) return;

  const videoWrap = gm.querySelector('.gm-video-wrap');
  const video     = gm.querySelector('#gmVideo');
  const controls  = gm.querySelector('.sv-controls');

  if (!videoWrap || !video || !controls) return;

  // 二重バインド防止
  if (controls.dataset.bound === '1') return;
  controls.dataset.bound = '1';

  const progTrack = controls.querySelector('.sv-progress');
  const progBar   = controls.querySelector('.sv-progress__bar');
  const btnPlay   = controls.querySelector('.sv-btn--play');
  const btnFs     = controls.querySelector('.sv-btn--fs');

  // ---- Progress seek (pointer) ----
  if (progTrack && progBar) {
    let isSeeking = false;

    const seekFromClientX = (clientX) => {
      const rect = progTrack.getBoundingClientRect();
      if (!rect.width || !video.duration) return;

      let ratio = (clientX - rect.left) / rect.width;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      video.currentTime = ratio * video.duration;
    };

    const onPointerMove = (e) => {
      if (!isSeeking) return;
      e.preventDefault();
      seekFromClientX(e.clientX);
    };

    const onPointerUp = () => {
      if (!isSeeking) return;
      isSeeking = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    progTrack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      isSeeking = true;
      seekFromClientX(e.clientX);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // ---- Progress update ----
  if (progBar) {
    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      progBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
    });

    video.addEventListener('loadedmetadata', () => {
      progBar.style.width = '0%';
    });
  }

  // ---- Play / Pause ----
  if (btnPlay) {
    const syncPlayLabel = () => {
      btnPlay.textContent = video.paused ? 'PLAY' : 'PAUSE';
    };

    btnPlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
      syncPlayLabel();
    });

    video.addEventListener('play',  syncPlayLabel);
    video.addEventListener('pause', syncPlayLabel);
    syncPlayLabel();
  }

  // ---- Fullscreen ----
  if (btnFs) {
    btnFs.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    });
  }

  // ---- Touch: tap to show controls + auto-hide ----
  const isTouch =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

  if (isTouch) {
    const AUTO_HIDE_MS = 2000;
    let hideControlsTimer = null;

    const clearHideTimer = () => {
      if (hideControlsTimer) {
        clearTimeout(hideControlsTimer);
        hideControlsTimer = null;
      }
    };

    const forceHideControls = () => {
      controls.classList.remove('is-visible');
      controls.style.opacity = '0';
      controls.style.pointerEvents = 'none';
    };

    const showControlsOnce = () => {
      controls.style.opacity = '';
      controls.style.pointerEvents = '';
      controls.classList.add('is-visible');

      clearHideTimer();
      hideControlsTimer = setTimeout(() => {
        forceHideControls();
        hideControlsTimer = null;
      }, AUTO_HIDE_MS);
    };

    const handleVideoTap = (e) => {
      if (e.target.closest('.sv-controls') || e.target.closest('.sv-btn')) return;
      e.stopPropagation();

      if (controls.classList.contains('is-visible')) {
        clearHideTimer();
        forceHideControls();
      } else {
        showControlsOnce();
      }
    };

    let lastTouchTime = 0;

    video.addEventListener('touchend', (e) => {
      lastTouchTime = Date.now();
      handleVideoTap(e);
    }, { passive: true });

    video.addEventListener('click', (e) => {
      if (Date.now() - lastTouchTime < 700) return;
      handleVideoTap(e);
    });

    const suspendAutoHide = (e) => {
      e.stopPropagation();
      clearHideTimer();
      controls.style.opacity = '';
      controls.style.pointerEvents = '';
      controls.classList.add('is-visible');
    };

    const resumeAutoHide = (e) => {
      e.stopPropagation();
      showControlsOnce();
    };

    controls.addEventListener('pointerdown', suspendAutoHide);
    controls.addEventListener('pointerup', resumeAutoHide);
    controls.addEventListener('touchstart', suspendAutoHide, { passive: true });
    controls.addEventListener('touchend', resumeAutoHide);
  } else {
    controls.classList.remove('is-visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {

  const gm = document.getElementById('gm');
  if (!gm) return;

  const gmImg   = gm.querySelector('#gmImage');
  const gmVWrap = gm.querySelector('.gm-video-wrap');
  const gmVideo = gm.querySelector('#gmVideo');

  const gmTitle = gm.querySelector('.gm-ttl');
  const gmSub   = gm.querySelector('.gm-sub');
  const gmCount = gm.querySelector('.gm-counter');

  const gmClose = gm.querySelector('.gm-close');
  const gmPrev  = gm.querySelector('.gm-prev');
  const gmNext  = gm.querySelector('.gm-next');
  const gmBg    = gm.querySelector('.gm-backdrop');

  const thumbItems = Array.from(document.querySelectorAll('#grid .jl-item'));
  if (!thumbItems.length) return;

  let currentIndex = 0;
  const imgCache = new Map();

  function preloadFullImage(full) {
    if (!full) return null;

    const cached = imgCache.get(full);
    if (cached) return cached;

    const image = new Image();
    image.src = full;

    let promise;
    if (image.decode) {
      promise = image.decode().catch(() => {});
    } else {
      promise = new Promise((resolve) => {
        image.onload  = () => resolve();
        image.onerror = () => resolve();
      });
    }

    const record = { image, promise };
    imgCache.set(full, record);
    return record;
  }

  function preloadAround(index) {
    const targets = [index + 1, index - 1, index + 2, index - 2];

    targets.forEach((i) => {
      const safeIndex = (i + thumbItems.length) % thumbItems.length;
      const item = thumbItems[safeIndex];
      if (!item || item.classList.contains('is-video')) return;

      const img = item.querySelector('img');
      if (!img) return;

      const full = img.dataset.full || img.src;
      preloadFullImage(full);
    });
  }

  function updateCaption(img, meta) {
    const t  = (img && img.dataset.title) || (meta && meta.dataset.title) || '';
    const l1 = (img && img.dataset.line1) || (meta && meta.dataset.line1) || '';
    const l2 = (img && img.dataset.line2) || (meta && meta.dataset.line2) || '';

    gmTitle.textContent = t;
    gmSub.textContent   = [l1, l2].filter(Boolean).join(' / ');
  }

  function updateCounter() {
    gmCount.textContent = `${currentIndex + 1} / ${thumbItems.length}`;
  }

  function showImage(img) {
    const full = img.dataset.full || img.src;
    const record = preloadFullImage(full);

    const apply = () => {
      gmImg.src = full;
      gmImg.hidden = false;
      gmImg.classList.add('ready');
    };

    if (record && record.promise) record.promise.then(apply);
    else apply();
  }

  function showVideo(meta) {
    const src = meta.dataset.full;
    if (!src) return;

    gmImg.hidden = true;
    gmImg.classList.remove('ready');
    gmImg.style.pointerEvents = 'none';

    gmVWrap.hidden = false;
    gmVideo.hidden = false;
    gmVWrap.classList.remove('is-ready');

    gmVideo.loop = true;

    if (gmVideo.src !== src) gmVideo.src = src;

    gmVideo.currentTime = 0;

    const onFirstFrame = () => {
      gmVWrap.classList.add('is-ready');
      gmVideo.removeEventListener('loadeddata', onFirstFrame);
    };
    gmVideo.addEventListener('loadeddata', onFirstFrame);

    const p = gmVideo.play();
    if (p && p.then) p.catch(() => {});
  }

  function resetMedia() {
    gmImg.src = '';
    gmImg.classList.remove('ready');
    gmImg.hidden = false;

    gmVideo.pause();
    gmVideo.removeAttribute('src');
    gmVideo.currentTime = 0;
    gmVideo.hidden = true;
    gmVWrap.hidden = true;
  }

  function closeModal() {
  gm.setAttribute('aria-hidden', 'true');
  resetMedia();
  document.body.classList.remove('lb-open');

  const controls = gm.querySelector('.sv-controls');
  if (controls) {
    controls.classList.remove('is-visible');
    controls.style.opacity = '';
    controls.style.pointerEvents = '';
  }
}

function openAt(index) {
  currentIndex = (index + thumbItems.length) % thumbItems.length;

  const item = thumbItems[currentIndex];
  const img  = item.querySelector('img');
  const meta = item.querySelector('.lb-data');

  // ① 先に表示（レイアウトツリーに乗せる）
  gm.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lb-open');

  // ② 次のフレームで中身を差し替える（Safari安定策）
  requestAnimationFrame(() => {
    resetMedia();

    if (meta && meta.dataset.type === 'video') {
      showVideo(meta);
    } else if (img) {
      showImage(img);
    }

    updateCaption(img, meta);
    updateCounter();
    preloadAround(currentIndex);
  });
}


  thumbItems.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      openAt(index);
    });
  });

  gmPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    openAt(currentIndex - 1);
  });

  gmNext.addEventListener('click', (e) => {
    e.stopPropagation();
    openAt(currentIndex + 1);
  });

  gmClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });

  gmBg.addEventListener('click', () => {
    closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      openAt(currentIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      openAt(currentIndex - 1);
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;
  let touchOnControls = false;

  gm.addEventListener('touchstart', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    const t = e.touches[0];
    if (!t) return;

    const target = e.target;

    if (target.closest('.gm-video-wrap') || target.closest('.sv-controls')) {
      touchOnControls = true;
      return;
    }

    touchOnControls = false;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  gm.addEventListener('touchend', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    if (touchOnControls) {
      touchOnControls = false;
      return;
    }

    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) {
      e.preventDefault();
      if (dx < 0) openAt(currentIndex + 1);
      else openAt(currentIndex - 1);
    }
  }, { passive: false });

  // ここで「1回だけ」初期化
  initGmVideoControls();
});










/* =========================
   Shared Top Nav (inject)
   - Put this near the bottom of script.js
   ========================= */

(function injectTopNav(){
  const navs = document.querySelectorAll('.js-site-nav');
  if(!navs.length) return;

  // ここを増やせば全ページ一発で反映されます
  const links = [
    { href: 'index.html',    label: 'Overview'  },
    { href: 'editorial.html',label: 'Editorial' },
    //{ href: 'beauty.html',   label: 'BEAUTY'    },//
    { href: 'video.html',   label: 'Advertising & Film'  },
    { href: 'info.html',     label: 'Info'      },
    { href: 'mailto:kazuko81617@gmail.com', label: 'Contact', external: true }
  ];

  const path = location.pathname.split('/').pop();
  const current = (path === '' ? 'index.html' : path);

  const html = links.map(l => {
    const isCurrent = (!l.external && l.href === current);
    const aria = isCurrent ? ' aria-current="page"' : '';
    return `<a href="${l.href}"${aria}>${l.label}</a>`;
  }).join('');

  navs.forEach(nav => { nav.innerHTML = html; });
})();