/**
 * 站点 Node 服务（阿里云「中国副本」用）
 *
 * 为什么需要: 主站在 Vercel，但 *.vercel.app / Vercel 线路在国内访问很慢，
 *             而主站的用户是中文工具类用户 → 在国内机器上跑同一份代码。
 *
 * 复刻 vercel.json 的 rewrites 规则（Vercel 路由 → 本地分发）:
 *   /api/pay|notify|order|entitle|paid|config|health|verify|aliq|arcade
 *   /api/subwall[/...]        /api/commission[/...]   /api/morning-youth[/...]
 *   /api/stripe/checkout|webhook   /api/wxpay/create|notify
 *   → api/alipay.js?r=<route>
 *   /api/track                 → api/track.js
 *   /api/rank|reflect|feedback|alert|pending → api/arcade-extra.js
 *   /api/autoops.js            → api/autoops.js
 *   其余 /api/*                 → api/alipay.js?r=<path>
 *
 * 静态: /            → index.html
 *        /<slug>/    → <slug>/index.html
 *        其它文件     → 原样
 *
 * 存储: 无 KV 时自动走 FILE_STORE_DIR 文件存储（alipay.js 已支持）
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(process.env.SITE_ROOT || fileURLToPath(new URL("../", import.meta.url)));
const PORT = Number(process.env.PORT || 8794);
const HOST = process.env.HOST || "127.0.0.1";

// ---- 路由表（与 vercel.json 保持一致）----
const ALIPAY_ROUTES = new Set([
  "pay", "notify", "order", "entitle", "paid", "config", "health", "verify",
  "aliq", "arcade", "subwall", "morning-youth", "commission",
  "stripe/checkout", "stripe/webhook", "wxpay/create", "wxpay/notify",
]);
const ARCADE_ROUTES = new Set(["rank", "reflect", "feedback", "alert", "pending"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".map": "application/json",
};

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on("end", () => {
      let body = {};
      const ct = String(req.headers["content-type"] || "");
      if (raw) {
        if (ct.includes("application/json")) { try { body = JSON.parse(raw); } catch { body = { _raw: raw }; } }
        else if (ct.includes("application/x-www-form-urlencoded")) {
          body = Object.fromEntries(new URLSearchParams(raw));
        } else { try { body = JSON.parse(raw); } catch { body = { _raw: raw }; } }
      }
      resolve(body);
    });
  });
}

/** 把 Vercel 风格 handler 适配到原生 http */
async function callHandler(mod, req, res, query, body) {
  const shim = {
    method: req.method, query, body, headers: req.headers,
    setHeader: (k, v) => res.setHeader(k, v),
    getHeader: (k) => res.getHeader(k),
    removeHeader: (k) => res.removeHeader(k),
    writeHead: (...a) => res.writeHead(...a),      // Vercel 风格 res 有这个方法
    flushHeaders: () => res.flushHeaders?.(),
    status: (c) => { res.statusCode = c; return shim; },
    json: (o) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return shim; },
    send: (b) => {
      if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(typeof b === "string" ? b : String(b)); return shim;
    },
    redirect: (code, url) => { res.writeHead(code, { Location: url }); res.end(); return shim; },
    // ⚠️ 必须透传数据：res.end(JSON.stringify(obj)) 的内容靠这个参数，
    //    忽略它 → 响应体为空（header 正常、body 空，最难查）
    end: (data) => { res.end(data); return shim; },
  };
  const fn = typeof mod === "function" ? mod
    : (mod && typeof mod.default === "function" ? mod.default
      : (mod && typeof mod.onRequest === "function" ? mod.onRequest : null));
  if (!fn) { send(res, 500, "handler not found"); return; }
  await fn(req, shim);
}

const modCache = new Map();
async function loadHandler(rel) {
  if (modCache.has(rel)) return modCache.get(rel);
  const mod = await import(pathToFileURL(path.join(ROOT, rel)).href);
  modCache.set(rel, mod);
  return mod;
}

const BLOCKED = new Set(["node_modules", ".vercel", ".git", ".env", ".env.local", "api", "scripts"]);

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith("/")) rel += "index.html";
  // 目录黑名单：绝不能把 node_modules / .env / 源码目录暴露出去
  const parts = rel.split("/").filter(Boolean);
  if (parts.some((p) => BLOCKED.has(p))) { send(res, 404, "not found"); return; }
  const full = path.join(ROOT, rel);
  // 防目录穿越
  if (!full.startsWith(path.resolve(ROOT))) { send(res, 403, "forbidden"); return; }
  try {
    const st = await fsp.stat(full);
    if (st.isDirectory()) return serveStatic(req, res, pathname.replace(/\/?$/, "/"));
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": ext === ".html" ? "public, max-age=300" : "public, max-age=86400",
    });
    fs.createReadStream(full).pipe(res);
  } catch {
    send(res, 404, "not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  try {
    if (pathname.startsWith("/api/")) {
      const sub = pathname.replace(/^\/api\/?/, "");
      // alipay.js 自己读请求流（readBody(req)），这里**不能**预读，
      // 否则流被消费掉 → 它的 promise 永不 resolve → 响应永远写不出去。
      const isAlipay = !(sub === "track" || ARCADE_ROUTES.has(sub) || sub === "autoops.js");
      const body = (req.method === "POST" && !isAlipay) ? await readBody(req) : {};
      const query = Object.fromEntries(url.searchParams.entries());

      if (sub === "track") {
        const mod = await loadHandler("api/track.js");
        return await callHandler(mod, req, res, query, body);
      }
      if (ARCADE_ROUTES.has(sub)) {
        const mod = await loadHandler("api/arcade-extra.js");
        return await callHandler(mod, req, res, query, body);
      }
      if (sub === "autoops.js") {
        const mod = await loadHandler("api/autoops.js");
        return await callHandler(mod, req, res, query, body);
      }
      // 其余全部走 alipay.js（用 r 参数指定子路由，与 vercel.json 一致）
      const mod = await loadHandler("api/alipay.js");
      const q = { ...query };
      if (!q.r) {
        const key = ALIPAY_ROUTES.has(sub) ? sub : sub;
        q.r = key;
        if (sub.startsWith("subwall/") || sub.startsWith("commission/") || sub.startsWith("morning-youth/")) {
          const [head, ...rest] = sub.split("/");
          q.r = head;
          if (head === "morning-youth") q.__path = sub; else q.action = rest.join("/");
        }
      }
      // ⚠️ alipay.js 是从 **URL 的 query** 读 r（new URL(req.url).searchParams.get('r')），
      //    所以必须把 r 写回 URL，不能只放在 req.query 里。
      const u2 = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      u2.searchParams.set("r", q.r);
      for (const [k, v] of Object.entries(q)) {
        if (k !== "r" && !u2.searchParams.has(k)) u2.searchParams.set(k, String(v));
      }
      // ⚠️ 不能用 {...req} 展开：IncomingMessage 的方法（on/pipe…）在原型上，
      //    展开会丢掉 → handler 里 req.on(...) 直接炸。用原型继承 + 覆盖字段。
      const shimReq = Object.create(req);
      shimReq.method = req.method;
      shimReq.query = q;
      shimReq.body = body;
      shimReq.headers = req.headers;
      shimReq.url = u2.pathname + u2.search;
      return await callHandler(mod, shimReq, res, q, body);
    }
    return await serveStatic(req, res, pathname);
  } catch (e) {
    console.error("[site-cn] error", e?.message);
    if (!res.headersSent) send(res, 500, "internal error");
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.error(`[site-cn] serving ${ROOT} on http://${HOST}:${PORT}`);
});
