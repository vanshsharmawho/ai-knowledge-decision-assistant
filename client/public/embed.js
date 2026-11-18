/**
 * KB Assistant embed script.
 *
 *   <script src="https://YOUR-APP/embed.js" data-assistant-token="asst_..." data-title="Acme" defer></script>
 *
 * Adds a floating chat button to the host page; clicking it opens the
 * organization's assistant in an iframe. Only the public assistant token is
 * used; no credentials or document contents are ever on the host page.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var token = script.getAttribute('data-assistant-token');
  if (!token) return console.warn('[kb-assistant] missing data-assistant-token');
  var title = script.getAttribute('data-title') || 'Assistant';
  var origin = new URL(script.src).origin;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Open ' + title + ' assistant');
  btn.textContent = '💬';
  btn.style.cssText =
    'position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:none;' +
    'background:#2f5bea;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:2147483646';

  var frame = document.createElement('iframe');
  frame.src = origin + '/assistant/' + encodeURIComponent(token);
  frame.title = title + ' assistant';
  frame.style.cssText =
    'position:fixed;right:20px;bottom:88px;width:380px;max-width:calc(100vw - 40px);height:560px;' +
    'max-height:calc(100vh - 120px);border:1px solid #e4e7ec;border-radius:14px;background:#fff;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.18);display:none;z-index:2147483647';

  btn.addEventListener('click', function () {
    var open = frame.style.display === 'none';
    frame.style.display = open ? 'block' : 'none';
    btn.textContent = open ? '✕' : '💬';
  });

  document.body.appendChild(frame);
  document.body.appendChild(btn);
})();
