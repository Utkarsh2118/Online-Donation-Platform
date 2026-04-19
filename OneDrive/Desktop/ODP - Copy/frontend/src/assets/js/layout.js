(function initLayoutHelpers(global) {
  const STORAGE_KEY = 'odp.sidebar.collapsed';

  function shouldUseDesktopSidebar() {
    return window.matchMedia('(min-width: 901px)').matches;
  }

  function applySidebarState(collapsed) {
    if (!shouldUseDesktopSidebar()) {
      document.body.classList.remove('sidebar-collapsed');
      return;
    }
    document.body.classList.toggle('sidebar-collapsed', Boolean(collapsed));
  }

  function setupSidebarCollapse() {
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
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
        applySidebarState(next);
        toggleBtn.textContent = next ? '>' : '<';
      });
    }

    const savedCollapsed = localStorage.getItem(STORAGE_KEY) === '1';
    applySidebarState(savedCollapsed);

    const toggleBtn = brand.querySelector('.sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = document.body.classList.contains('sidebar-collapsed') ? '>' : '<';
    }

    window.addEventListener('resize', () => {
      const collapsed = localStorage.getItem(STORAGE_KEY) === '1';
      applySidebarState(collapsed);
      if (toggleBtn) {
        toggleBtn.textContent = document.body.classList.contains('sidebar-collapsed') ? '>' : '<';
      }
    });
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
    setupSidebarCollapse,
    renderUserProgressStrip
  };
})(window);
