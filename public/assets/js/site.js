/* The little the site does in the browser.
 *
 * 1. The time-of-day header, as on the Aiir theme: morning, daytime and
 *    evening images, chosen by the visitor's clock in London time. The build
 *    puts all three on the header; this picks one. Daytime is the default in
 *    the stylesheet, so with no JavaScript the page still has a header.
 * 2. The menu button on a phone.
 *
 * Nothing here fetches anything yet. The live parts of the site (on air now,
 * recently played, news) will be read from the hub when they are built. */

(function () {
  var header = document.querySelector('[data-header-images]');
  if (header) {
    try {
      var images = JSON.parse(header.getAttribute('data-header-images'));
      var hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
      var pick = null;
      for (var name in images) {
        var band = images[name];
        if (!band || !band.image) continue;
        var inBand = band.from < band.to ? (hour >= band.from && hour < band.to) : (hour >= band.from || hour < band.to);
        if (inBand) { pick = band; break; }
      }
      if (pick) header.style.backgroundImage = 'url("' + pick.image + '")';
    } catch (e) { /* the stylesheet's default header stays */ }
  }

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
  }
  document.querySelectorAll('.primary-nav__folder > button').forEach(function (button) {
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.primary-nav__folder > button').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      button.setAttribute('aria-expanded', String(!open));
    });
  });
})();
