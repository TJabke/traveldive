const ROOM_TYPE_TOKENS = new Set(["hotelroom", "room", "accommodation"]);

const AMENITY_NORMALIZATION_MAP = [
  [/\b(wlan|wifi|wi-fi|internet)\b/i, "wifi"],
  [/(klimaanlage|air\s*conditioning|a\/c|\bklima\b)/i, "air_conditioning"],
  [/\b(balkon|balcony|terrace|terrasse)\b/i, "balcony"],
  [/\b(meerblick|ocean\s*view|sea\s*view)\b/i, "sea_view"],
  [/\b(frühstück|breakfast)\b/i, "breakfast_included"],
  [/\b(minibar)\b/i, "minibar"],
  [/\b(safe|tresor)\b/i, "safe"],
  [/\b(tv|fernseher|smart\s*tv)\b/i, "tv"],
  [/\b(kaffee|coffee\s*machine|nespresso)\b/i, "coffee_machine"],
  [/\b(badewanne|bathtub|tub)\b/i, "bathtub"],
  [/\b(dusche|shower|regendusche)\b/i, "shower"],
  [/\b(kitchen|küche|kitchenette)\b/i, "kitchen"],
  [/\b(sofa\s*bed|schlafsofa)\b/i, "sofa_bed"]
];

function normalizeAmenity(value = "") {
  const normalized = [];
  for (const [pattern, key] of AMENITY_NORMALIZATION_MAP) {
    if (pattern.test(value)) normalized.push(key);
  }
  return normalized;
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function stripHtml(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function flattenGraph(input, acc = []) {
  if (!input) return acc;
  if (Array.isArray(input)) {
    input.forEach(item => flattenGraph(item, acc));
    return acc;
  }
  if (typeof input === "object") {
    acc.push(input);
    if (Array.isArray(input["@graph"])) {
      input["@graph"].forEach(item => flattenGraph(item, acc));
    }
  }
  return acc;
}

function hasRoomType(type) {
  const types = toArray(type).map(t => String(t || "").toLowerCase().replace("https://schema.org/", ""));
  return types.some(t => ROOM_TYPE_TOKENS.has(t));
}


function collectRoomEntities(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach(item => collectRoomEntities(item, acc));
    return acc;
  }
  if (typeof node !== "object") return acc;

  if (hasRoomType(node["@type"])) acc.push(node);
  Object.values(node).forEach(value => {
    if (typeof value === "object") collectRoomEntities(value, acc);
  });
  return acc;
}

function extractAmenityValues(entity = {}) {
  const features = toArray(entity.amenityFeature);
  const fromFeatures = features.flatMap(f => {
    if (typeof f === "string") return [f];
    if (!f || typeof f !== "object") return [];
    return [f.name, f.value, f.description].filter(Boolean);
  });

  return uniq([
    ...fromFeatures,
    ...toArray(entity.amenities),
    ...toArray(entity.featureList)
  ]);
}

function normalizeRoomRecord(room = {}) {
  const amenitiesRaw = uniq((room.amenities || []).map(v => String(v).trim()).filter(Boolean));
  const amenitiesNormalized = uniq(amenitiesRaw.flatMap(normalizeAmenity));

  return {
    room_name: room.room_name || null,
    description: room.description || null,
    occupancy: Number.isFinite(room.occupancy) ? room.occupancy : null,
    beds: room.beds || null,
    amenities: amenitiesRaw,
    amenities_normalized: amenitiesNormalized
  };
}

function extractFromJsonLd(html = "") {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .map(v => parseJsonSafe(v))
    .filter(Boolean);

  const objects = flattenGraph(scripts);
  const roomEntities = uniq(objects.flatMap(obj => collectRoomEntities(obj)).map(r => JSON.stringify(r))).map(s => JSON.parse(s));

  const rooms = roomEntities.map(entity => {
    const occupancyCandidate = entity.occupancy?.maxValue || entity.occupancy?.value || entity.occupancy;
    const occupancy = parseInt(String(occupancyCandidate || "").match(/\d+/)?.[0] || "", 10);

    const beds = typeof entity.bed === "string"
      ? entity.bed
      : entity.bed?.name || entity.bed?.typeOfBed || entity.bed?.description || null;

    return normalizeRoomRecord({
      room_name: entity.name || entity.alternateName || null,
      description: entity.description || null,
      occupancy,
      beds,
      amenities: extractAmenityValues(entity)
    });
  }).filter(room => room.room_name);

  return rooms;
}

function detectCandidateJsonEndpoints(html = "", sourceUrl = "") {
  const keywordPattern = /(rooms?|accommodations?|units?|amenities?)/i;
  const urlPattern = /https?:\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-/?.=&%]*(rooms?|accommodations?|units?|amenities?)[a-zA-Z0-9_\-/?.=&%]*/gi;
  const matches = html.match(urlPattern) || [];
  const base = sourceUrl ? new URL(sourceUrl) : null;

  return uniq(matches
    .filter(value => keywordPattern.test(value))
    .map(value => {
      if (/^https?:\/\//i.test(value)) return value;
      if (!base) return null;
      try {
        return new URL(value, base).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean));
}

function looksLikeRoomPayload(payload) {
  if (!payload) return false;
  if (Array.isArray(payload)) return payload.some(item => looksLikeRoomPayload(item));
  if (typeof payload !== "object") return false;

  const keys = Object.keys(payload).join(" ").toLowerCase();
  if (/room|accommodation|amenit|bed|occupancy/.test(keys)) return true;

  return Object.values(payload).some(value => {
    if (typeof value === "object") return looksLikeRoomPayload(value);
    return false;
  });
}

function extractRoomsFromJsonPayload(payload) {
  const roomCandidates = [];

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;

    const name = node.room_name || node.roomName || node.name || node.title;
    const hasRoomHints = /room|suite|villa|studio/i.test(String(name || "")) ||
      /room|accommodation|unit/i.test(Object.keys(node).join(" "));

    if (hasRoomHints && name) {
      const occupancyCandidate = node.occupancy || node.maxOccupancy || node.max_persons || node.capacity;
      const occupancy = parseInt(String(occupancyCandidate || "").match(/\d+/)?.[0] || "", 10);
      const bedCandidate = node.beds || node.bed || node.bedType || node.bedding || null;
      const amenities = uniq([
        ...toArray(node.amenities),
        ...toArray(node.features),
        ...toArray(node.amenityFeature).flatMap(f => typeof f === "string" ? [f] : [f?.name, f?.description])
      ]);

      roomCandidates.push(normalizeRoomRecord({
        room_name: String(name),
        description: node.description || node.roomDescription || null,
        occupancy,
        beds: typeof bedCandidate === "string" ? bedCandidate : bedCandidate?.name || null,
        amenities
      }));
    }

    Object.values(node).forEach(value => {
      if (typeof value === "object") walk(value);
    });
  }

  walk(payload);
  return uniq(roomCandidates.map(r => JSON.stringify(r))).map(s => JSON.parse(s));
}

async function extractFromJsonEndpoints(html, sourceUrl, fetchImpl = fetch) {
  const endpoints = detectCandidateJsonEndpoints(html, sourceUrl);
  const rooms = [];

  for (const endpoint of endpoints.slice(0, 5)) {
    try {
      const res = await fetchImpl(endpoint, { headers: { Accept: "application/json,text/plain,*/*" } });
      if (!res.ok) continue;
      const text = await res.text();
      const payload = parseJsonSafe(text);
      if (!payload || !looksLikeRoomPayload(payload)) continue;
      rooms.push(...extractRoomsFromJsonPayload(payload));
    } catch {
      // Ignore endpoint failures and continue
    }
  }

  return uniq(rooms.map(r => JSON.stringify(r))).map(s => JSON.parse(s));
}

function extractFromHtmlFallback(html = "") {
  const sections = html.split(/<h[1-4][^>]*>/i).slice(1);
  const rooms = [];

  for (const section of sections) {
    const heading = section.split(/<\/h[1-4]>/i)[0] || "";
    const roomName = stripHtml(heading);
    if (!/room|zimmer|suite|villa|studio/i.test(roomName)) continue;

    const body = section.split(/<\/h[1-4]>/i).slice(1).join(" ");
    const text = stripHtml(body).slice(0, 900);
    const occupancy = parseInt((text.match(/(?:max\.?|für|for)\s*(\d+)\s*(?:personen|guests|gäste|adults?)/i) || [])[1] || "", 10);
    const bedsMatch = text.match(/((?:king|queen|twin|double|single|sofa)[^,.]{0,25}(?:bed|bett|beds|betten))/i);
    const amenities = uniq(
      [...text.matchAll(/(?:wifi|wi-fi|wlan|air conditioning|klimaanlage|balkon|balcony|tv|minibar|safe|kitchen|küche|shower|dusche|bathtub|badewanne)/gi)]
        .map(m => m[0])
    );

    rooms.push(normalizeRoomRecord({
      room_name: roomName,
      description: text || null,
      occupancy,
      beds: bedsMatch ? bedsMatch[1] : null,
      amenities
    }));
  }

  return rooms;
}

async function extractRoomsFromHotelPage(sourceUrl, fetchImpl = fetch) {
  const res = await fetchImpl(sourceUrl, {
    headers: {
      "User-Agent": "TravelDiveRoomExtractor/1.0",
      Accept: "text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) throw new Error(`Konnte Hotelseite nicht laden (${res.status})`);

  const html = await res.text();

  let rooms = extractFromJsonLd(html);
  if (rooms.length === 0) {
    rooms = await extractFromJsonEndpoints(html, sourceUrl, fetchImpl);
  }
  if (rooms.length === 0) {
    rooms = extractFromHtmlFallback(html);
  }

  return {
    source_url: sourceUrl,
    scraped_at: new Date().toISOString(),
    rooms
  };
}

module.exports = {
  AMENITY_NORMALIZATION_MAP,
  normalizeAmenity,
  extractFromJsonLd,
  detectCandidateJsonEndpoints,
  extractFromJsonEndpoints,
  extractFromHtmlFallback,
  extractRoomsFromHotelPage,
  extractRoomsFromJsonPayload,
  extractFromJsonPayload: extractRoomsFromJsonPayload
};
