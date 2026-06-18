// PWA Registration — dołącz ten skrypt do index.html przed </body>
(function() {
  'use strict';

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[PWA] Service Worker registered:', reg.scope);
          // Check for updates every 60s
          setInterval(() => reg.update(), 60000);
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
  }

  // "Add to Home Screen" prompt handling
  let deferredPrompt = null;
  const installBanner = document.getElementById('pwa-install-banner');
  const installBtn    = document.getElementById('pwa-install-btn');
  const installDismiss = document.getElementById('pwa-install-dismiss');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBanner) installBanner.style.display = 'flex';
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Install outcome:', outcome);
      deferredPrompt = null;
      if (installBanner) installBanner.style.display = 'none';
    });
  }

  if (installDismiss) {
    installDismiss.addEventListener('click', () => {
      if (installBanner) installBanner.style.display = 'none';
    });
  }

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed!');
    deferredPrompt = null;
    if (installBanner) installBanner.style.display = 'none';
  });
})();
