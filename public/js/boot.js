/* Runs before first paint: enables scroll-reveal styles only when JS is available, so content never stays hidden without it. */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) d.classList.add('rm'); } catch (e) {}
})();
