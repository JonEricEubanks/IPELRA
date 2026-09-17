import '@testing-library/jest-dom/vitest';

// jsdom has no matchMedia; react-hot-toast's <Toaster> queries it for
// prefers-reduced-motion. Provide a minimal stub so admin pages can render.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
