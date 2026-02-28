export function json(data, status = 200, opts = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",

    // 🔵 CORS (외부 호출 대비: Firebase preview + Cloudflare + 로컬)
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",

    // 🔵 캐시 금지 (법령 데이터 최신 유지)
    "cache-control": "no-store",

    // 🔵 디버그용 (개발 중만)
    "x-powered-by": "archi-law-engine"
  });

  // 추가 header 옵션 허용
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      headers.set(k, v);
    }
  }

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers
  });
}

// OPTIONS preflight 대응 (CORS)
export function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}