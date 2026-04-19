(function initLayoutHelpers(global) {
  const SIDEBAR_STORAGE_KEY = 'odp.sidebar.collapsed';
  const THEME_STORAGE_KEY = 'odp.theme.mode';
  const NOTIFICATION_STORAGE_KEY = 'odp.notifications';

  function shouldUseDesktopSidebar() {
    return window.matchMedia('(min-width: 901px)').matches;
  }

  function ensureMainLandmark() {
    const main = document.querySelector('main') || document.querySelector('.content-panel') || document.querySelector('.page-shell');
    if (main && !main.id) {
      main.id = 'main-content';
    }
    return main;
  }

  function setupSkipLink() {
    if (document.querySelector('.skip-link')) return;
    const main = ensureMainLandmark();
    if (!main) return;
    const link = document.createElement('a');
    link.className = 'skip-link';
    link.href = `#${main.id}`;
    link.textContent = 'Skip to content';
    document.body.insertAdjacentElement('afterbegin', link);
  }

  function applySidebarState(collapsed) {
    if (!shouldUseDesktopSidebar()) {
      document.body.classList.remove('sidebar-collapsed');
      return;
    }
    document.body.classList.toggle('sidebar-collapsed', Boolean(collapsed));
  }

  function setupSidebarCollapse() {
    if (document.body.classList.contains('admin-shell')) {
      document.body.classList.remove('sidebar-collapsed');
      return;
    }

    const sideNav = document.querySelector('.side-nav');
    const brand = sideNav ? sideNav.querySelector('.brand') : null;
    if (!sideNav || !brand) return;

    if (!brand.querySelector('.sidebar-toggle')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'sidebar-toggle';
      toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
      toggleBtn.textContent = '<';
      brand.appendChild(toggleBtn);

      toggleBtn.addEventListener('click', () => {
        const currentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
        const next = !currentlyCollapsed;
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
        applySidebarState(next);
        toggleBtn.textContent = next ? '>' : '<';
      });
    }

    const savedCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
    applySidebarState(savedCollapsed);

    const toggleBtn = brand.querySelector('.sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = document.body.classList.contains('sidebar-collapsed') ? '>' : '<';
    }

    window.addEventListener('resize', () => {
      const collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
      applySidebarState(collapsed);
      if (toggleBtn) {
        toggleBtn.textContent = document.body.classList.contains('sidebar-collapsed') ? '>' : '<';
      }
    });
  }

  function applyTheme(mode) {
    document.body.classList.remove('theme-compact', 'theme-high-contrast');
    if (mode === 'compact') {
      document.body.classList.add('theme-compact');
    }
    if (mode === 'high-contrast') {
      document.body.classList.add('theme-high-contrast');
    }
  }

  function setupThemeControls() {
    const sideNav = document.querySelector('.side-nav');
    const fallbackContainer = document.querySelector('.nav-actions');
    const container = sideNav || fallbackContainer;
    if (!container || container.querySelector('.theme-switcher')) return;

    let target = container;
    if (sideNav) {
      target = sideNav.querySelector('.side-nav-tools');
      if (!target) {
        target = document.createElement('div');
        target.className = 'side-nav-tools';
        const logoutButton = sideNav.querySelector('#logoutBtn');
        if (logoutButton) {
          sideNav.insertBefore(target, logoutButton);
        } else {
          sideNav.appendChild(target);
        }
      }
    }

    const switcher = document.createElement('label');
    switcher.className = 'theme-switcher';
    switcher.innerHTML = `
      <span>Theme</span>
      <select id="themeMode" aria-label="Theme mode">
        <option value="normal">Normal</option>
        <option value="compact">Compact</option>
        <option value="high-contrast">High Contrast</option>
      </select>
    `;

    target.appendChild(switcher);
    const select = switcher.querySelector('#themeMode');
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || 'normal';
    select.value = saved;
    applyTheme(saved);

    select.addEventListener('change', () => {
      const mode = select.value;
      localStorage.setItem(THEME_STORAGE_KEY, mode);
      applyTheme(mode);
    });
  }

  function getNotificationData() {
    try {
      const data = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || '[]');
      if (Array.isArray(data) && data.length) {
        return data;
      }
    } catch (error) {
      console.warn('Notification parse error', error);
    }

    const defaults = [
      { id: 'n1', text: '2 campaigns crossed 70% funding today.', read: false },
      { id: 'n2', text: 'Profile completion can improve donor trust.', read: false },
      { id: 'n3', text: 'Review failed donations from last 24 hours.', read: true }
    ];
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  function saveNotificationData(items) {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));
  }

  function setupNotificationCenter() {
    const sideNav = document.querySelector('.side-nav');
    const fallbackTarget = document.querySelector('.nav-actions');
    const target = sideNav || fallbackTarget;
    if (!target || target.querySelector('.notif-wrap')) return;

    let container = target;
    if (sideNav) {
      container = sideNav.querySelector('.side-nav-tools');
      if (!container) {
        container = document.createElement('div');
        container.className = 'side-nav-tools';
        const logoutButton = sideNav.querySelector('#logoutBtn');
        if (logoutButton) {
          sideNav.insertBefore(container, logoutButton);
        } else {
          sideNav.appendChild(container);
        }
      }
    }

    const wrap = document.createElement('div');
    wrap.className = 'notif-wrap';
    wrap.innerHTML = `
      <button class="notif-bell" type="button" aria-label="Open notifications">
        Bell <span class="notif-count">0</span>
      </button>
      <section class="notif-panel" aria-live="polite"></section>
    `;
    container.appendChild(wrap);

    const bell = wrap.querySelector('.notif-bell');
    const panel = wrap.querySelector('.notif-panel');
    const count = wrap.querySelector('.notif-count');

    function renderNotifications() {
      const items = getNotificationData();
      const unread = items.filter((item) => !item.read).length;
      count.textContent = String(unread);
      panel.innerHTML = `
        <div class="notif-head">
          <strong>Notifications</strong>
          <button type="button" class="btn btn-outline btn-sm" id="markAllReadBtn">Mark all read</button>
        </div>
        <div class="notif-list">
          ${items.map((item) => `<article class="notif-item ${item.read ? '' : 'unread'}">${item.text}</article>`).join('')}
        </div>
      `;
      const markAllBtn = panel.querySelector('#markAllReadBtn');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', () => {
          const next = items.map((item) => ({ ...item, read: true }));
          saveNotificationData(next);
          renderNotifications();
        });
      }
    }

    bell.addEventListener('click', () => {
      wrap.classList.toggle('open');
      renderNotifications();
    });

    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) {
        wrap.classList.remove('open');
      }
    });

    renderNotifications();
  }

  function renderUnifiedPageHeader(options) {
    const container = document.querySelector(options.containerSelector || '.content-panel') || document.querySelector('.page-shell');
    if (!container) return;

    const existing = container.querySelector('.unified-page-header');
    if (existing) existing.remove();

    const savedStamp = localStorage.getItem(`odp.lastUpdated.${options.pageKey || 'default'}`) || new Date().toLocaleString('en-IN');
    const header = document.createElement('section');
    header.className = 'unified-page-header animate-fade-in';
    const primaryAction = options.primaryAction || null;
    header.innerHTML = `
      <div>
        <h1>${options.title || 'Dashboard'}</h1>
        <p>${options.subtitle || 'Manage data with clearer workflows.'}</p>
      </div>
      <div class="header-actions">
        <span class="last-updated">Last updated: <strong>${savedStamp}</strong></span>
        ${primaryAction ? `<a class="btn btn-primary" href="${primaryAction.href}">${primaryAction.label}</a>` : ''}
      </div>
    `;

    container.insertBefore(header, container.firstElementChild);
  }

  function markUpdated(pageKey) {
    localStorage.setItem(`odp.lastUpdated.${pageKey}`, new Date().toLocaleString('en-IN'));
  }

  function setupAccessibility() {
    setupSkipLink();
  }

  function initGlobalUX(options) {
    setupAccessibility();
    setupSidebarCollapse();
    setupThemeControls();
    setupNotificationCenter();
    if (options && options.pageHeader) {
      renderUnifiedPageHeader(options.pageHeader);
    }
  }

  function renderUserProgressStrip(options) {
    const panel = document.querySelector('.content-panel');
    if (!panel) return;

    const existing = panel.querySelector('.progress-strip');
    if (existing) existing.remove();

    const progressComplete = Math.max(0, Math.min(100, Number(options.profileComplete || 0)));
    const pendingActions = Number(options.pendingActions || 0);
    const supportedCampaigns = Number(options.supportedCampaigns || 0);
    const paidDonations = Number(options.paidDonations || 0);

    const strip = document.createElement('section');
    strip.className = 'progress-strip animate-fade-in';
    strip.setAttribute('aria-label', 'Account progress');
    strip.innerHTML = `
      <article class="progress-item progress-main">
        <strong>${options.title || 'Your Progress Snapshot'}</strong>
        <div class="notice">${options.subtitle || 'Track profile completion, pending actions, and donation activity in one place.'}</div>
      </article>
      <article class="progress-item">
        <strong>${progressComplete}%</strong>
        <span>Profile Complete</span>
      </article>
      <article class="progress-item">
        <strong>${pendingActions}</strong>
        <span>Pending Actions</span>
      </article>
      <article class="progress-item">
        <strong>${supportedCampaigns + paidDonations}</strong>
        <span>Total Impact</span>
      </article>
    `;

    panel.insertBefore(strip, panel.firstElementChild);
  }

  global.ODPLayout = {
    initGlobalUX,
    setupAccessibility,
    setupSidebarCollapse,
    setupThemeControls,
    setupNotificationCenter,
    renderUnifiedPageHeader,
    renderUserProgressStrip,
    markUpdated
  };
})(window);
