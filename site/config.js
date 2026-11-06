/**
 * Where the site reads its content from (the INK Studio Pro backoffice) and where the cart pays.
 * The Firebase web API key is public by design; access is controlled by firestore.rules.
 */
(() => {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);

  window.INK_CONFIG = local
    ? {
        // npm run emulators + npm run pages:dev in the app folder
        projectId: 'demo-ink-studio',
        databaseId: '(default)',
        studioId: 'main',
        apiKey: '',
        firestoreHost: 'http://127.0.0.1:8080',
        apiBase: 'http://127.0.0.1:8788',
        siteUrl: location.origin,
      }
    : {
        projectId: 'gen-lang-client-0172609399',
        databaseId: '(default)',
        studioId: 'main',
        apiKey: 'AIzaSyDODIX407GV50xD9LH3cbpfoq0gkHWfnWs',
        firestoreHost: 'https://firestore.googleapis.com',
        // The INK Studio Pro app on Cloudflare Pages (checkout API). Add this site's origin
        // to ALLOWED_ORIGINS in the app's wrangler.toml.
        apiBase: 'https://ink-studio-pro.pages.dev',
        // Canonical address of the public site (canonical links, sitemap, structured data).
        siteUrl: 'https://inkcompativel.pt',
      };
})();
