// Private template gallery: serves templates/gallery.html and templates/processed/* from R2 (prefix "gallery/").
//
// Deny by default. Every request must carry a valid Cloudflare Access token (Cf-Access-Jwt-Assertion header or
// CF_Authorization cookie), verified here against the Access team's signing keys and this app's AUD tag. Until
// TEAM_DOMAIN and POLICY_AUD are set (after Cloudflare Access is turned on for this Worker), every request gets 403,
// so the licensed templates are never public, even for a moment.

const PREFIX = "gallery/";
let keyCache = { at: 0, keys: [] };

const b64urlBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function signingKeys(teamDomain) {
  if (Date.now() - keyCache.at < 3600_000 && keyCache.keys.length) return keyCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const { keys } = await res.json();
  keyCache = { at: Date.now(), keys };
  return keys;
}

async function verifyAccess(request, env) {
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) return { ok: false, why: "Cloudflare Access is not configured for this site yet." };
  const cookie = request.headers.get("Cookie")?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || cookie;
  if (!token) return { ok: false, why: "Sign-in required." };
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return { ok: false, why: "Malformed token." };
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  const jwk = (await signingKeys(env.TEAM_DOMAIN)).find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256") return { ok: false, why: "Unknown signing key." };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = Math.floor(Date.now() / 1000);
  if (!valid) return { ok: false, why: "Bad signature." };
  if (!aud.includes(env.POLICY_AUD)) return { ok: false, why: "Wrong audience." };
  if (payload.exp && payload.exp < now) return { ok: false, why: "Session expired." };
  if (payload.iss !== `https://${env.TEAM_DOMAIN}`) return { ok: false, why: "Wrong issuer." };
  return { ok: true, email: payload.email };
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    let auth;
    try { auth = await verifyAccess(request, env); } catch (err) { auth = { ok: false, why: `Sign-in check failed: ${err.message}` }; }
    if (!auth.ok) return new Response(`Forbidden. ${auth.why}\n`, { status: 403, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (path === "" || path === "index.html" || path === "gallery.html") path = "index.html";
    else if (path.endsWith("/")) path += "index.html";
    if (path.includes("..")) return new Response("Bad path", { status: 400 });

    let obj = await env.BUCKET.get(PREFIX + path);
    if (!obj && !/\.[a-z0-9]+$/i.test(path)) obj = await env.BUCKET.get(`${PREFIX}${path}/index.html`); // /about -> /about/index.html
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers({ "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex, nofollow" });
    obj.writeHttpMetadata(headers);
    headers.set("ETag", obj.httpEtag);
    return new Response(request.method === "HEAD" ? null : obj.body, { headers });
  },
};
