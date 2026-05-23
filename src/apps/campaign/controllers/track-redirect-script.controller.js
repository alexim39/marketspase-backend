// Public helper script for the campaign tracking landing page.
// The API server uses Helmet's default CSP (`script-src 'self'`), which blocks inline scripts.
// We keep the redirect logic in an external same-origin file so the landing page can redirect
// to the billable stage (`?go=1`) without requiring `unsafe-inline`.

const isSafeRedirectTarget = (value) => {
  const target = String(value || "").trim();
  if (!target) return false;

  // Allow same-origin absolute-path URLs like "/api/v1/..." but reject protocol-relative ("//evil.com").
  if (target.startsWith("/")) return !target.startsWith("//");

  // Allow fully-qualified http(s) URLs only.
  return /^https?:\/\//i.test(target);
};

export const serveTrackingRedirectScript = (_req, res) => {
  // Cacheable: the script is static; the per-request next URL is passed via data-next on the script tag.
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");

  // Keep this tiny and dependency-free (works in all in-app browsers).
  res.end(`(function(){try{
  var s=document.currentScript;
  var next=(s&&s.dataset&&s.dataset.next)||"";
  if(!next){return;}
  if(!(next[0]==="/" ? next.indexOf("//")!==0 : /^https?:\\/\\//i.test(next))){return;}
  try{window.location.replace(next);}catch(e){window.location.href=next;}
}catch(_e){}})();`);
};

