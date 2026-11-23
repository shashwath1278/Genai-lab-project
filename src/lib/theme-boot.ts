// Shared by the root layout (server) and the toggle (client).
export const THEME_KEY = "ng-theme";

/**
 * Inlined into <head> so a saved theme applies before first paint: without it
 * a dark-mode choice would flash light on every page load.
 */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
