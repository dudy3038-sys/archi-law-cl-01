// functions/api/[[path]].js (FULL REPLACE)
import { json } from "../../src/lib/response.js";
import { searchLawMeta } from "../../src/server/lawMeta.js";
import {
  searchLawArticle,
  getLawArticle,
  getRuleTopicTree,
  getEffectiveMst,
} from "../../src/server/lawArticle.js";
import { buildChecklist } from "../../src/server/checklist.js";

/**
 * law.go.kr DRF: 법령 본문(조문 포함) 조회
 * - 예: http://www.law.go.kr/DRF/lawService.do?OC=xxx&target=eflaw&MST=276925&type=JSON
 */
const LAW_SERVICE_URL = "http://www.law.go.kr/DRF/lawService.do";

/* =========================
   law ingest helpers
========================= */
function pickArticlesFromLawServiceJson(data) {
  const root = data?.법령 || data?.Law || data?.law || data;
  const jo =
    root?.조문 ||
    root?.Jo ||
    root?.articles ||
    root?.article ||
    root?.조문목록;
  const units =
    jo?.조문단위 ||
    jo?.joList ||
    jo?.list ||
    jo?.items ||
    root?.조문단위 ||
    root?.articles ||
    [];
  return Array.isArray(units) ? units : [];
}

function normalizeArticleUnit(u) {
  const articleNo = (
    u?.조문번호 ||
    u?.조문번호명 ||
    u?.조문명 ||
    u?.articleNo ||
    u?.article_no ||
    ""
  )
    .toString()
    .trim();
  const title = (u?.조문제목 || u?.제목 || u?.title || u?.조문제목명 || "")
    .toString()
    .trim();
  const body = (u?.조문내용 || u?.내용 || u?.body || u?.text || u?.조문 || "")
    .toString()
    .trim();

  if (!articleNo || !body) return null;

  return {
    article_no: articleNo,
    title: title || null,
    body,
  };
}

async function fetchLawServiceJson({ oc, mst }) {
  const u = new URL(LAW_SERVICE_URL);
  u.searchParams.set("OC", oc);
  u.searchParams.set("target", "eflaw");
  u.searchParams.set("type", "JSON");
  u.searchParams.set("MST", String(mst));

  const res = await fetch(u.toString(), {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-ingest/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LAW_SERVICE_HTTP_${res.status}: ${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`LAW_SERVICE_NOT_JSON: ${text.slice(0, 120)}`);
  }
  return { data, finalUrl: res.url };
}

async function getLawKeyByMst(DB, mst) {
  const row = await DB.prepare(
    `SELECT law_key FROM law_version WHERE mst = ? LIMIT 1`
  )
    .bind(String(mst))
    .first();
  return row?.law_key ? String(row.law_key) : "";
}

async function upsertLawArticles(DB, { lawKey, mst, sourceUrl, articles }) {
  const CHUNK = 50;
  let insertedOrIgnored = 0;

  for (let i = 0; i < articles.length; i += CHUNK) {
    const part = articles.slice(i, i + CHUNK);

    const stmts = part.map((a) =>
      DB.prepare(
        `
        INSERT OR REPLACE INTO law_article
          (law_key, mst, article_no, title, body, source_url, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, datetime('now'))
      `
      ).bind(lawKey, mst, a.article_no, a.title, a.body, sourceUrl || null)
    );

    await DB.batch(stmts);
    insertedOrIgnored += part.length;
  }

  return insertedOrIgnored;
}

/* =========================
   parking helpers (DB-first)
========================= */
function jurKeyOf(sido, sigungu) {
  return `${String(sido || "").trim()}__${String(sigungu || "").trim()}`;
}

function normalizeParkingPayload(body) {
  const jurisdiction = body?.jurisdiction || {};
  const sido = String(jurisdiction?.sido || "").trim();
  const sigungu = String(jurisdiction?.sigungu || "").trim();

  const usageAreasIn = Array.isArray(body?.usageAreas) ? body.usageAreas : [];
  const usageAreas = usageAreasIn
    .map((x) => {
      const use = String(x?.use || "").trim();
      const area = Number(x?.area_m2);
      const area_m2 = Number.isFinite(area) ? Math.round(area * 100) / 100 : 0;
      return { use, area_m2 };
    })
    .filter((x) => x.use && x.area_m2 > 0);

  const primaryUse = String(body?.primaryUse || "").trim();

  return { jurisdiction: { sido, sigungu }, usageAreas, primaryUse };
}

async function ensureParkingJurisdiction(DB, { sido, sigungu }) {
  const jur_key = jurKeyOf(sido, sigungu);
  await DB.prepare(
    `
    INSERT OR IGNORE INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `
  )
    .bind(jur_key, sido, sigungu)
    .run();

  // touch updated_at
  await DB.prepare(
    `UPDATE parking_jurisdiction SET updated_at=datetime('now') WHERE jur_key=?`
  )
    .bind(jur_key)
    .run();

  return jur_key;
}

async function upsertParkingIndex(DB, { jur_key, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { wrote: 0 };
  }

  const CHUNK = 50;
  let wrote = 0;

  for (let i = 0; i < items.length; i += CHUNK) {
    const part = items.slice(i, i + CHUNK);

    const stmts = part.map((it) =>
      DB.prepare(
        `
        INSERT OR REPLACE INTO parking_ordinance_index
          (jur_key, ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link, collected_at, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `
      ).bind(
        jur_key,
        String(it.ordinId || it.ordin_id || "").trim(),
        String(it.name || "").trim(),
        it.orgName ? String(it.orgName) : null,
        it.kind ? String(it.kind) : null,
        it.field ? String(it.field) : null,
        it.effDate ? String(it.effDate) : null,
        it.annDate ? String(it.annDate) : null,
        it.annNo ? String(it.annNo) : null,
        it.link ? String(it.link) : null
      )
    );

    await DB.batch(stmts);
    wrote += part.length;
  }

  return { wrote };
}

// jur 우선순위: 시군구 → 시도(전체/본청) → (없음)
function buildJurFallbackKeys({ sido, sigungu }) {
  const s = String(sido || "").trim();
  const g = String(sigungu || "").trim();
  const keys = [];
  if (s && g) keys.push(jurKeyOf(s, g));

  // ✅ 광역(상위) fallback 후보들
  // - 서울특별시__전체 (권장)
  // - 서울특별시__서울특별시 (예비)
  if (s) {
    keys.push(jurKeyOf(s, "전체"));
    keys.push(jurKeyOf(s, s));
  }
  return Array.from(new Set(keys));
}

async function fetchParkingRules(DB, { jur_key }) {
  const res = await DB.prepare(
    `
    SELECT
      id, jur_key, ordin_id, use_label, unit, value_num, note, source, updated_at
    FROM parking_rules
    WHERE jur_key = ?
    ORDER BY use_label ASC, id ASC
  `
  )
    .bind(jur_key)
    .all();

  const rows = Array.isArray(res?.results) ? res.results : [];
  return rows.map((r) => ({
    id: r.id,
    jur_key: r.jur_key,
    ordin_id: r.ordin_id || null,
    use_label: r.use_label,
    unit: r.unit,
    value_num: Number(r.value_num),
    note: r.note || null,
    source: r.source || null,
    updated_at: r.updated_at || null,
  }));
}

function calcByRule({ area_m2, rule }) {
  const unit = String(rule.unit || "").trim();

  // 현재 1단계: m2_per_space만 우선 지원
  // - value_num = "몇 ㎡당 1대"
  if (unit === "m2_per_space") {
    const denom = Number(rule.value_num);
    if (!Number.isFinite(denom) || denom <= 0) return null;
    const raw = area_m2 / denom;
    const rounded = Math.ceil(raw);
    return { raw, rounded, formula: `ceil(${area_m2} / ${denom})` };
  }

  // 확장 여지: per_household, fixed_min, etc...
  return null;
}

async function computeParkingLegalFromDB(DB, payload) {
  const { sido, sigungu } = payload.jurisdiction;
  const fallbacks = buildJurFallbackKeys({ sido, sigungu });

  let usedJurKey = "";
  let rules = [];

  for (const k of fallbacks) {
    const got = await fetchParkingRules(DB, { jur_key: k });
    if (got.length) {
      usedJurKey = k;
      rules = got;
      break;
    }
  }

  const totalArea = Math.round(
    payload.usageAreas.reduce((acc, x) => acc + (Number(x.area_m2) || 0), 0) * 100
  ) / 100;

  // 규칙이 아직 없으면 “명확하게” NO_RULES_YET로
  if (!rules.length) {
    const tmp = Math.max(1, Math.ceil(totalArea / 1000));
    return {
      ok: true,
      mode: "NO_RULES_YET",
      usedJurKey: null,
      totalArea_m2: totalArea,
      legalCount: tmp,
      breakdown: [],
      formula:
        `NO_RULES_YET: parking_rules가 비어있어 임시값을 반환합니다. ` +
        `ceil(totalArea_m2 / 1000), 최소 1대 (총면적=${totalArea}㎡)`,
      refs: [],
      hint:
        `다음 단계: (1) ${fallbacks[0]}에 해당하는 조례 본문/별표를 parking_ordinance_text에 적재 ` +
        `→ (2) parking_rules 파싱/적재 → (3) 이 엔드포인트가 즉시 DB 기반 산정으로 전환`,
      debug: { triedJurKeys: fallbacks },
    };
  }

  // rules가 있어도 “use_label 매칭”이 1단계라 100% 일치 보장 못 함
  // - 현재는 payload.use(예: "업무시설")가 rules.use_label을 포함/동일 비교로 매칭
  const breakdown = [];
  let sumRaw = 0;

  for (const ua of payload.usageAreas) {
    const use = String(ua.use || "").trim();
    const area_m2 = Number(ua.area_m2) || 0;

    // 가장 단순한 매칭(확장 예정)
    const candidates = rules.filter((r) => r.use_label === use || r.use_label.includes(use) || use.includes(r.use_label));
    const rule = candidates[0] || null;

    if (!rule) {
      breakdown.push({
        use,
        area_m2,
        rule: null,
        count_raw: null,
        count_rounded: null,
        note: "NO_MATCHING_RULE",
      });
      continue;
    }

    const out = calcByRule({ area_m2, rule });
    if (!out) {
      breakdown.push({
        use,
        area_m2,
        rule,
        count_raw: null,
        count_rounded: null,
        note: "UNSUPPORTED_RULE_UNIT",
      });
      continue;
    }

    sumRaw += out.raw;
    breakdown.push({
      use,
      area_m2,
      rule,
      count_raw: out.raw,
      count_rounded: out.rounded,
      formula: out.formula,
    });
  }

  // ✅ 합산 소수 처리(1차 정책)
  // - 각 용도별 ‘올림’이 있는 경우도 있으나,
  // - 지자체별 별표 규정이 다를 수 있어, 지금은 “총합 올림”을 기본으로 둠.
  // - (다음 단계) rules에 rounding_policy를 넣어 조례 문구대로 맞출 것.
  const legalCount = Math.max(1, Math.ceil(sumRaw));

  // refs: 규칙이 연결된 ordin_id를 모아 근거로 반환
  const ordinIds = Array.from(
    new Set(rules.map((r) => (r.ordin_id ? String(r.ordin_id) : "")).filter(Boolean))
  );

  return {
    ok: true,
    mode: "DB_RULES",
    usedJurKey,
    totalArea_m2: totalArea,
    legalCount,
    breakdown,
    formula: `DB_RULES: total=ceil(sum(count_raw)) => ceil(${sumRaw})`,
    refs: ordinIds.map((id) => ({ type: "ordin", ordin_id: id })),
    debug: {
      triedJurKeys: fallbacks,
      rulesCount: rules.length,
      ordinIds,
    },
  };
}

/* =========================
   crawler runner (dynamic import)
========================= */
async function runParkingCrawler({ env, input }) {
  const mod = await import("../../src/crawler/parkingCrawler.js");

  const candidates = [
    "runParkingCrawler",
    "crawlParkingOrdinanceIndex",
    "run",
    "main",
    "default",
  ];

  let fn = null;
  for (const name of candidates) {
    if (name === "default" && typeof mod?.default === "function") {
      fn = mod.default;
      break;
    }
    if (typeof mod?.[name] === "function") {
      fn = mod[name];
      break;
    }
  }

  if (!fn) {
    const keys = Object.keys(mod || {});
    throw new Error(
      `PARKING_CRAWLER_EXPORT_NOT_FOUND: expected one of [${candidates.join(
        ", "
      )}], got exports=[${keys.join(", ")}]`
    );
  }

  const oc = String(env.LAW_OC || "").trim();
  if (!oc) {
    throw new Error(
      "MISSING_ENV_LAW_OC: 조례 DRF 수집도 LAW_OC가 필요할 수 있습니다. Cloudflare Pages env var LAW_OC를 설정하세요."
    );
  }

  if (!env.DB) {
    throw new Error(
      "MISSING_ENV_DB: D1 바인딩(env.DB)이 없습니다. Pages Functions에 D1 binding을 연결하세요."
    );
  }

  return await fn({
    db: env.DB,
    oc,
    ...input,
  });
}

/* =========================
   handler
========================= */
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const seg = params.path || [];
  const path = Array.isArray(seg) ? seg.join("/") : seg;

  try {
    // GET /api/health
    if (request.method === "GET" && path === "health") {
      return json({ ok: true });
    }

    // =========================================================
    // ✅ 주차 조례 수집 실행 + (즉시) DB에 인덱스 upsert
    // GET  /api/crawler/parking/run?sido=서울특별시&sigungu=성동구&limit=20&debug=1
    // POST /api/crawler/parking/run { "sido":"서울특별시","sigungu":"성동구","limit":20,"debug":true }
    // =========================================================
    if (
      (request.method === "GET" || request.method === "POST") &&
      path === "crawler/parking/run"
    ) {
      let body = {};
      if (request.method === "POST") {
        body = await request.json().catch(() => ({}));
      }

      const sido = String(url.searchParams.get("sido") || body?.sido || "").trim();
      const sigungu = String(url.searchParams.get("sigungu") || body?.sigungu || "").trim();

      const limitQ = Number(url.searchParams.get("limit"));
      const debugQ = url.searchParams.get("debug");

      const limit = Number.isFinite(limitQ)
        ? Math.max(1, Math.min(200, limitQ))
        : Number.isFinite(Number(body?.limit))
        ? Math.max(1, Math.min(200, Number(body.limit)))
        : 50;

      const debug =
        (debugQ && debugQ !== "0") ||
        body?.debug === true ||
        body?.debug === "true";

      if (!sido || !sigungu) {
        return json(
          { ok: false, error: "MISSING_PARAMS", need: ["sido", "sigungu"] },
          400
        );
      }

      if (!env.DB) {
        return json(
          { ok: false, error: "MISSING_ENV_DB", hint: "D1 binding(env.DB) 연결 필요" },
          500
        );
      }

      const startedAt = Date.now();
      const result = await runParkingCrawler({
        env,
        input: { sido, sigungu, limit, debug },
      });

      // ✅ 여기서 즉시 DB에 누적(허수 방지)
      const items = Array.isArray(result?.items) ? result.items : [];
      const jur_key = await ensureParkingJurisdiction(env.DB, { sido, sigungu });
      const savedIndex = await upsertParkingIndex(env.DB, { jur_key, items });

      const ms = Date.now() - startedAt;

      return json({
        ok: true,
        ran: "crawler/parking/run",
        input: { sido, sigungu, limit, debug },
        took_ms: ms,
        result,
        saved: {
          jur_key,
          index_rows: savedIndex.wrote,
        },
        note:
          savedIndex.wrote > 0
            ? "✅ 크롤링 결과를 parking_ordinance_index에 즉시 저장했습니다."
            : "⚠️ 크롤링 결과(items)가 비어있어 저장된 인덱스가 없습니다. query/필터/응답 구조를 점검하세요.",
      });
    }

    // GET /api/rules/tree?topic=coverage
    if (request.method === "GET" && path === "rules/tree") {
      const topic = url.searchParams.get("topic") || "";
      const onDate = url.searchParams.get("onDate") || ""; // optional: YYYY-MM-DD
      if (!topic) {
        return json({ ok: false, error: "MISSING_PARAMS", need: ["topic"] }, 400);
      }
      const tree = await getRuleTopicTree(env.DB, topic, { onDate });
      if (!tree) {
        return json({ ok: false, error: "NOT_FOUND", topic }, 404);
      }
      return json({ ok: true, topic, tree });
    }

    // GET /api/law/meta/search?q=건축&onDate=2026-02-27
    if (request.method === "GET" && path === "law/meta/search") {
      const q = url.searchParams.get("q") || "";
      const onDate = url.searchParams.get("onDate") || "";
      const rows = await searchLawMeta(env.DB, q, { onDate });
      return json({ ok: true, q, onDate: onDate || null, rows });
    }

    // GET /api/law/article/search?q=피난&lawId=276925&limit=20
    if (request.method === "GET" && path === "law/article/search") {
      const q = url.searchParams.get("q") || "";
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const limitRaw = Number(url.searchParams.get("limit") || 20);
      const limit = Number.isFinite(limitRaw)
        ? Math.max(1, Math.min(100, limitRaw))
        : 20;

      const rows = await searchLawArticle(env.DB, q, { mst: lawId, limit });
      return json({ ok: true, q, lawId, limit, rows });
    }

    // GET /api/law/article/get?lawId=276925&articleNo=제34조
    if (request.method === "GET" && path === "law/article/get") {
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const articleNo = url.searchParams.get("articleNo") || "";
      if (!lawId || !articleNo) {
        return json(
          { ok: false, error: "MISSING_PARAMS", need: ["lawId", "articleNo"] },
          400
        );
      }
      const row = await getLawArticle(env.DB, lawId, articleNo);
      return json({ ok: true, row });
    }

    // 기존 호환 유지
    if (request.method === "GET" && path === "law/article") {
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const articleNo = url.searchParams.get("articleNo") || "";
      if (!lawId || !articleNo) {
        return json(
          { ok: false, error: "MISSING_PARAMS", need: ["lawId", "articleNo"] },
          400
        );
      }
      const row = await getLawArticle(env.DB, lawId, articleNo);
      return json({ ok: true, row });
    }

    // POST /api/law/ingest
    if (request.method === "POST" && path === "law/ingest") {
      const body = await request.json().catch(() => ({}));

      const oc = (env.LAW_OC || "").toString().trim();
      if (!oc) {
        return json(
          {
            ok: false,
            error: "MISSING_ENV",
            need: ["LAW_OC"],
            hint: "Cloudflare Pages env var LAW_OC를 설정하세요.",
          },
          500
        );
      }

      let lawKey = (body.lawKey || "").toString().trim();
      let mst = (body.mst || "").toString().trim();
      const onDate = (body.onDate || "").toString().trim() || ""; // optional

      if (!lawKey && mst) {
        lawKey = await getLawKeyByMst(env.DB, mst);
      }

      if (!mst) {
        if (!lawKey) {
          return json(
            { ok: false, error: "MISSING_PARAMS", need: ["lawKey or mst"] },
            400
          );
        }
        mst = (await getEffectiveMst(env.DB, lawKey, onDate)) || "";
      }

      if (!lawKey || !mst) {
        return json(
          {
            ok: false,
            error: "CANNOT_RESOLVE",
            lawKey: lawKey || null,
            mst: mst || null,
          },
          400
        );
      }

      const { data, finalUrl } = await fetchLawServiceJson({ oc, mst });
      const rawUnits = pickArticlesFromLawServiceJson(data);
      const articles = rawUnits.map(normalizeArticleUnit).filter(Boolean);

      if (articles.length === 0) {
        return json(
          {
            ok: false,
            error: "NO_ARTICLES_PARSED",
            lawKey,
            mst,
            hint: "law.go.kr 응답 구조가 예상과 다를 수 있습니다.",
          },
          500
        );
      }

      const saved = await upsertLawArticles(env.DB, {
        lawKey,
        mst,
        sourceUrl: finalUrl,
        articles,
      });

      return json({
        ok: true,
        lawKey,
        mst,
        saved,
        parsed: articles.length,
        source_url: finalUrl,
      });
    }

    // =========================================================
    // ✅ 주차(법정) - DB 기반 산정(규칙 있으면 바로 적용)
    // POST /api/parking/legal
    // =========================================================
    if (request.method === "POST" && path === "parking/legal") {
      const body = await request.json().catch(() => ({}));
      const payload = normalizeParkingPayload(body);

      const { sido, sigungu } = payload.jurisdiction;
      if (!sido || !sigungu) {
        return json(
          {
            ok: false,
            error: "MISSING_PARAMS",
            need: ["jurisdiction.sido", "jurisdiction.sigungu"],
          },
          400
        );
      }

      if (!payload.usageAreas.length) {
        return json(
          {
            ok: false,
            error: "MISSING_PARAMS",
            need: ["usageAreas (use, area_m2 > 0)"],
          },
          400
        );
      }

      if (!env.DB) {
        return json(
          {
            ok: false,
            error: "MISSING_ENV_DB",
            hint: "D1 binding(env.DB) 연결 필요",
          },
          500
        );
      }

      const out = await computeParkingLegalFromDB(env.DB, payload);

      return json({
        ok: true,
        mode: out.mode,
        jurisdiction: payload.jurisdiction,
        primaryUse: payload.primaryUse || null,
        usageAreas: payload.usageAreas,
        totalArea_m2: out.totalArea_m2,
        legalCount: out.legalCount,
        formula: out.formula,

        // (기존/향후 호환용)
        legalParking: out.legalCount,

        breakdown: out.breakdown || [],
        usedJurKey: out.usedJurKey || null,
        refs: out.refs || [],
        message:
          out.mode === "DB_RULES"
            ? "✅ parking_rules(DB) 기반으로 주차대수를 산정했습니다."
            : "⚠️ 아직 parking_rules(설치기준)가 비어있어 임시값을 반환합니다. 다음 단계에서 조례 별표 파싱 → parking_rules 적재 후 자동으로 DB 산정으로 전환됩니다.",
        hint: out.hint || null,
        debug: out.debug || null,
      });
    }

    // POST /api/checklist/build
    if (request.method === "POST" && path === "checklist/build") {
      const body = await request.json().catch(() => ({}));
      const out = await buildChecklist(env.DB, body);
      return json({ ok: true, ...out });
    }

    return json({ ok: false, error: "NOT_FOUND", path }, 404);
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}