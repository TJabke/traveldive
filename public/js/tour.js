// TravelDive Tour Renderer
// Loads tour data and renders the immersive customer experience

let tour = null;
let selectedHotelIndex = 0;
let selectedTransfer = null;
let mapLocations = [];
let selectedMapLocation = 0;

const PREF_ICONS = {
  strand:"🏖",familie:"👨‍👩‍👧",kulinarik:"🍽",kultur:"🏛",wellness:"🧖",
  "sport & aktiv":"🏃",nightlife:"🎉",shopping:"🛍",wassersport:"🤿",
  wandern:"🥾",romantik:"💑",fotografie:"📸"
};

// ── INIT ──
async function initTour() {
  let loadGuardTimer = null;
  try {
    loadGuardTimer = setTimeout(() => {
      const splash = document.getElementById("splash");
      if (splash && !splash.classList.contains("hidden")) {
        console.error("Tour init timeout: splash guard triggered");
        showError();
      }
    }, 12000);

    await withTimeout(TravelDiveAPI.init(), 5000, "Konfiguration konnte nicht geladen werden.");

    // Get tour slug from URL
    const path = window.location.pathname;
    const slug = path.replace("/t/", "").replace("/tour.html", "").replace(/^\/+|\/+$/g, "");

    if (!slug) {
      // Try query param fallback
      const params = new URLSearchParams(window.location.search);
      const qSlug = params.get("slug");
      if (!qSlug) return showError();
      tour = await withTimeout(TravelDiveAPI.getTour(qSlug), 7000, "Tour konnte nicht geladen werden.");
    } else {
      tour = await withTimeout(TravelDiveAPI.getTour(slug), 7000, "Tour konnte nicht geladen werden.");
    }

    if (!tour) return showError();

    // Start tracking
    TravelDiveTracker.init(tour.id);

    // Render all sections
    renderHero();
    renderHotelSelector();
    renderTransfers();
    renderHotelDetail(0);
    renderWeather();
    renderPOIs();
    renderMap();
    renderDayPlan();
    renderCTA();
    renderProgress();
    renderFooter();

    // Hide splash
    setTimeout(() => document.getElementById("splash").classList.add("hidden"), 2000);

    // Setup scroll handlers
    setupScrollHandlers();

  } catch (err) {
    console.error("Tour init error:", err);
    setTimeout(() => document.getElementById("splash").classList.add("hidden"), 1000);
    showError();
  } finally {
    if (loadGuardTimer) clearTimeout(loadGuardTimer);
  }
}

function showError() {
  document.getElementById("splash").classList.add("hidden");
  document.querySelectorAll("section, .progress-wrap, footer").forEach(el => el.style.display = "none");
  document.getElementById("errorPage").style.display = "flex";
}

// ── HERO ──
async function renderHero() {
  // Agent info
  const initials = tour.agent_name.split(" ").map(n=>n[0]).join("");
  document.getElementById("agentInfo").innerHTML = `
    <span>Zusammengestellt von <strong>${tour.agent_name}</strong>${tour.agent_company ? " · "+tour.agent_company : ""}</span>
    <div class="agent-avatar">${initials}</div>
  `;

  // Hero title
  document.getElementById("heroTitle").innerHTML = tour.hero_title || `Ihr Traumurlaub in <em>${tour.destination}</em>`;
  
  // Subtitle
  const subtitle = tour.hero_subtitle || tour.personal_note || 
    `Tauchen Sie ein in das, was Sie erwartet.`;
  document.getElementById("heroSubtitle").textContent = subtitle;

  // Meta
  const dateStr = formatDateRange(tour.date_from, tour.date_to);
  const metaItems = [];
  if (dateStr) metaItems.push(`📅 ${dateStr}`);
  metaItems.push(`☀️ ${tour.nights} Nächte · ${tour.meal_plan}`);
  if (tour.departure_airport) metaItems.push(`✈️ ab ${tour.departure_airport}`);
  document.getElementById("heroMeta").innerHTML = metaItems.map(m => 
    `<div class="hero-meta-item">${m}</div>`
  ).join("");

  const countdownEl = document.getElementById("heroCountdown");
  const daysToTrip = getDaysUntilTrip(tour.date_from);
  if (daysToTrip !== null && daysToTrip >= 0) {
    countdownEl.style.display = "inline-flex";
    countdownEl.innerHTML = `⏳ Noch <strong>${daysToTrip}</strong> Tage bis zu Ihrer Traumreise`;
  } else {
    countdownEl.style.display = "none";
  }

  const hotel = (tour.hotels || [])[selectedHotelIndex];
  const story = tour.personal_note || `Stellen Sie sich vor: Morgens mit Meerblick aufwachen, tagsüber ${tour.destination} entdecken und abends entspannt den Tag ausklingen lassen.`;
  document.getElementById("heroStory").textContent = story;

  const highlights = [
    `🏝 ${tour.destination}`,
    `🛏 ${tour.nights} Nächte`,
    tour.meal_plan ? `🍽 ${tour.meal_plan}` : null,
    hotel?.name ? `🏨 ${hotel.name}` : null
  ].filter(Boolean);
  document.getElementById("heroHighlights").innerHTML = highlights.map(h => `<span class="hero-highlight">${h}</span>`).join("");

  // Preferences
  const prefs = getDisplayPreferences();
  if (prefs.length > 0) {
    document.getElementById("heroPref").style.display = "flex";
    document.getElementById("heroPrefTags").innerHTML = prefs.map(p => {
      const icon = PREF_ICONS[p.toLowerCase()] || "✦";
      return `<span class="pf-tag">${icon} ${p}</span>`;
    }).join("");
  }

  // Hero background: Video takes priority, then destination image, then gradient
  if (tour.hero_video_url) {
    const vid = extractYouTubeId(tour.hero_video_url);
    if (vid) {
      document.getElementById("heroVideoWrap").innerHTML = `
        <iframe src="https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&showinfo=0&modestbranding=1&playsinline=1&rel=0" 
          allow="autoplay;encrypted-media" allowfullscreen loading="lazy"></iframe>
        <div class="hero-video-fallback"></div>
      `;
    }
  } else {
    // Load destination/hotel image as hero background
    loadHeroBackground();
  }
}

async function loadHeroBackground() {
  const fallback = document.querySelector(".hero-video-fallback");
  if (!fallback) return;

  if (tour.hero_image_url) {
    fallback.style.backgroundImage = `url('${tour.hero_image_url}')`;
    fallback.style.backgroundSize = "cover";
    fallback.style.backgroundPosition = "center";
    return;
  }

  // Try multiple search queries for best result
  const h = (tour.hotels || [])[0];
  if (h?.photo_url) {
    fallback.style.backgroundImage = `url('${h.photo_url}')`;
    fallback.style.backgroundSize = "cover";
    fallback.style.backgroundPosition = "center";
  }
  const queries = [
    h ? `${h.name} ${h.location || ""}` : null,
    `${tour.destination} landscape panorama`,
    tour.destination
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const results = await TravelDiveAPI.searchPlace(query);
      if (results[0]?.photo_ref) {
        const url = TravelDiveAPI.getPlacePhotoUrl(results[0].photo_ref, 2400);
        fallback.style.backgroundImage = `url('${url}')`;
        fallback.style.backgroundSize = "cover";
        fallback.style.backgroundPosition = "center";
        // Keep gradient as overlay via the existing hero-overlay element
        return;
      }
    } catch(e) { console.warn("Hero bg search failed:", e); }
  }
  // If all searches fail, gradient fallback stays via CSS
}

// ── TRANSFERS ──
function renderTransfers() {
  const h = (tour.hotels || [])[selectedHotelIndex];
  const transfers = h?.transfers || tour.transfers || [];
  if (transfers.length === 0) {
    document.getElementById("transfer").style.display = "none";
    return;
  }
  document.getElementById("transfer").style.display = "";

  document.getElementById("transferIntro").textContent = 
    `Sie landen und müssen zum Hotel. Hier sind Ihre Optionen – wählen Sie Ihren Favoriten.`;

  // Route display
  if (tour.departure_airport && h) {
    document.getElementById("transferRoute").innerHTML = `
      <div class="route-point"><span class="rp-icon">✈️</span> Flughafen</div>
      <div class="route-arrow">→</div>
      <div class="route-point"><span class="rp-icon">🏨</span> ${h.name}</div>
    `;
  }

  document.getElementById("transferOptions").innerHTML = transfers.map((t, i) => `
    <div class="transfer-card" onclick="selectTransfer(${i})">
      <div class="tc-icon">${t.icon || "🚐"}</div>
      <div class="tc-name">${t.name}</div>
      <div class="tc-duration">⏱ ${t.duration}</div>
      <div class="tc-desc">${t.description}</div>
      <div class="tc-price">${t.price} <span class="tc-price-note">${t.price_note || ""}</span></div>
      ${t.tags ? `<div class="tc-tags">${t.tags.map(tag=>`<span class="tc-tag">${tag}</span>`).join("")}</div>` : ""}
    </div>
  `).join("");
  
  // Reset transfer selection message
  document.getElementById("transferMsg").classList.remove("show");
}

function selectTransfer(index) {
  const h = (tour.hotels || [])[selectedHotelIndex];
  const transfers = h?.transfers || tour.transfers || [];
  const t = transfers[index];
  if (!t) return;
  selectedTransfer = t.name;
  document.querySelectorAll(".transfer-card").forEach((c,i) => c.classList.toggle("selected", i===index));
  document.getElementById("transferChoice").textContent = t.name;
  document.getElementById("transferMsg").classList.add("show");
  updateCTASelections();
  TravelDiveTracker.trackTransferSelect(t.name);
}

// ── HOTEL SELECTOR ──
function renderHotelSelector() {
  const hotels = tour.hotels || [];
  if (hotels.length <= 1) {
    document.getElementById("selector").style.display = "none";
    return;
  }

  document.getElementById("selectorLabel").textContent = `${tour.agent_name.split(" ")[0]}s Empfehlungen`;
  document.getElementById("selectorTitle").textContent = `${hotels.length} Hotels, die zu Ihnen passen`;

  document.getElementById("hotelCards").innerHTML = hotels.map((h, i) => `
    <div class="hotel-select-card ${i===0?"active":""}" onclick="selectHotel(${i})">
      <div class="hsc-img" style="background-image:url('${h.photo_url || ""}');background-color:var(--ocean);"></div>
      <div class="hsc-info">
        <div class="hsc-name">${h.name}</div>
        <div class="hsc-meta">
          <span>${"★".repeat(h.stars||5)}</span>
          <span>${h.location||""}</span>
        </div>
        <div class="hsc-price">${h.price_pp ? h.price_pp+"€" : ""} <span>p.P.</span></div>
      </div>
    </div>
  `).join("");

  // Load real photos for hotel cards
  hotels.forEach(async (h, i) => {
    if (h.place_id) {
      try {
        const details = await TravelDiveAPI.getPlaceDetails(h.place_id);
        if (details.photo_refs && details.photo_refs[0]) {
          const url = TravelDiveAPI.getPlacePhotoUrl(details.photo_refs[0], 600);
          const card = document.querySelectorAll(".hsc-img")[i];
          if (card) card.style.backgroundImage = `url('${url}')`;
        }
      } catch(e) { /* fallback to existing photo */ }
    }
  });
}

function selectHotel(index) {
  selectedHotelIndex = index;
  selectedMapLocation = 0;
  selectedTransfer = null; // Reset transfer selection
  document.querySelectorAll(".hotel-select-card").forEach((c,i) => c.classList.toggle("active", i===index));
  
  // Re-render ALL hotel-dependent sections
  renderHotelDetail(index);
  renderTransfers();
  renderPOIs();
  renderMap();
  renderDayPlan();
  renderCTA();
  
  document.getElementById("hotel").scrollIntoView({behavior:"smooth"});
  updateCTASelections();
  TravelDiveTracker.trackHotelSelect(tour.hotels[index].name);
}

// ── HOTEL DETAIL ──
function renderHotelDetail(index) {
  const h = (tour.hotels || [])[index];
  if (!h) return;

  document.getElementById("hotelDetailName").textContent = h.name;

  // Video
  const vidWrap = document.getElementById("hotelVideoWrap");
  if (h.video_url) {
    const vid = extractYouTubeId(h.video_url);
    if (vid) {
      vidWrap.innerHTML = `<div class="hotel-video-showcase"><iframe src="https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    } else { vidWrap.innerHTML = ""; }
  } else { vidWrap.innerHTML = ""; }

  // Photos from Google Places
  renderHotelPhotos(h);

  // Overview panel
  document.getElementById("panel-overview").innerHTML = `
    <div class="hotel-overview-grid">
      <div>
        <div class="hotel-stars">${"★".repeat(h.stars||5)} · ${h.category || "Luxury"}</div>
        <p class="hotel-desc">${h.description || ""}</p>
      </div>
      <div>
        <div class="reviews-title">Was Gäste sagen${getTravelerTypeLabel() ? ` <span style="font-size:.7rem;color:var(--text-light);font-family:'DM Sans',sans-serif;">(${getTravelerTypeLabel()})</span>` : ""}</div>
        ${getAudienceReviews(h.reviews || []).map(r => `
          <div class="review-card">
            <p>"${r.text}"</p>
            <div class="reviewer">— ${r.author}${r.date ? " · "+r.date : ""}</div>
            <div class="review-source">Quelle: ${resolveReviewSource(r)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // Facilities panel
  const pools = h.pools || [];
  const restaurants = h.restaurants || [];
  document.getElementById("panel-facilities").innerHTML = `
    ${pools.length ? `<div style="margin-bottom:2rem;"><div class="section-label" style="margin-bottom:1.5rem;">Pools</div><div class="facility-grid">${pools.map(p=>`
      <div class="facility-card"><div class="fc-icon">${p.icon||"🏊"}</div><div class="fc-name">${p.name}</div><div class="fc-desc">${p.description}</div>
      ${p.tags?`<div class="fc-tags">${p.tags.map(t=>`<span class="fc-tag">${t}</span>`).join("")}</div>`:""}</div>
    `).join("")}</div></div>` : ""}
    ${restaurants.length ? `<div><div class="section-label" style="margin-bottom:1.5rem;">Restaurants</div><div class="facility-grid">${restaurants.map(r=>`
      <div class="facility-card"><div class="fc-icon">${r.icon||"🍽"}</div><div class="fc-name">${r.name}</div><div class="fc-desc">${r.description}</div>
      ${r.tags?`<div class="fc-tags">${r.tags.map(t=>`<span class="fc-tag">${t}</span>`).join("")}</div>`:""}</div>
    `).join("")}</div></div>` : ""}
  `;

  // Room panel
  const roomOptions = Array.isArray(h.room_options) ? h.room_options : [];
  const selectedRoom = roomOptions[h.selected_room_index || 0] || h.room || {};
  const normalizedFeatures = (selectedRoom.features || []).map(f => typeof f === "string" ? { title: f, detail: "" } : f);
  document.getElementById("panel-room").innerHTML = `
    <div style="margin-bottom:1.2rem;">
      <div class="hotel-stars">${selectedRoom.category || selectedRoom.type || "Zimmer"} ${selectedRoom.size ? `· ${selectedRoom.size}` : ""}</div>
      <p class="hotel-desc">${selectedRoom.description || ""}</p>
    </div>
    ${roomOptions.length > 0 ? `
      <div class="room-category-list">
        ${roomOptions.map((opt, idx) => `
          <span class="room-category-chip ${idx === (h.selected_room_index || 0) ? "active" : ""}">${escapeHTML(opt.category || opt.type || "Zimmer")}</span>
        `).join("")}
      </div>
    ` : ""}
    <div class="room-features">
      ${normalizedFeatures.map(f => `
        <div class="room-feature">
          <div class="rf-icon">${f.icon || "✦"}</div>
          <div class="rf-text"><div class="rf-title">${f.title || "Highlight"}</div><div class="rf-detail">${f.detail || ""}</div></div>
        </div>
      `).join("")}
    </div>
  `;

  // Reset tabs
  document.querySelectorAll(".detail-tab").forEach((t,i) => t.classList.toggle("active", i===0));
  document.querySelectorAll(".detail-panel").forEach((p,i) => p.classList.toggle("active", i===0));
}

async function renderHotelPhotos(hotel) {
  const container = document.getElementById("hotelPhotos");
  container.innerHTML = '<div class="skeleton skeleton-img"></div>'.repeat(4);

  let photoRefs = [];

  // Strategy 1: Use place_id if available
  if (hotel.place_id) {
    try {
      const details = await TravelDiveAPI.getPlaceDetails(hotel.place_id);
      photoRefs = details.photo_refs || [];
    } catch(e) { console.warn("Place details failed:", e); }
  }

  // Strategy 2: Search by name if no photos yet
  if (photoRefs.length === 0) {
    try {
      const query = `${hotel.name} ${hotel.location || tour.destination || ""}`;
      const results = await TravelDiveAPI.searchPlace(query);
      if (results[0]) {
        // Save place_id for future use
        if (!hotel.place_id) {
          hotel.place_id = results[0].place_id;
          hotel.lat = results[0].lat;
          hotel.lng = results[0].lng;
        }
        // Get full details for more photos
        try {
          const details = await TravelDiveAPI.getPlaceDetails(results[0].place_id);
          photoRefs = details.photo_refs || [];
        } catch(e2) {
          // At least use the search thumbnail
          if (results[0].photo_ref) photoRefs = [results[0].photo_ref];
        }
      }
    } catch(e) { console.warn("Place search failed:", e); }
  }

  // Render photos
  if (photoRefs.length > 0) {
    const labels = ["Außenansicht", "Zimmer", "Pool", "Restaurant", "Lobby", "Strand", "Spa", "Garten"];
    const count = Math.min(photoRefs.length, 4);
    container.innerHTML = photoRefs.slice(0, count).map((ref, i) => `
      <div class="hotel-photo" style="background-image:url('${TravelDiveAPI.getPlacePhotoUrl(ref, 1400)}')" onclick="openPhotoLightbox('${encodeURIComponent(TravelDiveAPI.getPlacePhotoUrl(ref, 1800))}', '${encodeURIComponent(labels[i] || "Hotelbild")}')">
        <div class="hotel-photo-label">${labels[i] || ""}</div>
      </div>
    `).join("");
  } else if (hotel.photo_url) {
    // Fallback: single stored photo
    container.innerHTML = `
      <div class="hotel-photo" style="background-image:url('${hotel.photo_url}');grid-column:1/-1;aspect-ratio:21/9;" onclick="openPhotoLightbox('${encodeURIComponent(hotel.photo_url)}', 'Hotelansicht')"></div>
    `;
  } else {
    // No photos at all - show placeholder
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-light);font-size:.85rem;background:var(--sand);border-radius:12px;">
        📷 Hotelbilder werden geladen sobald die Verbindung zu Google Places verfügbar ist.
      </div>
    `;
  }
}

// ── WEATHER ──
async function renderWeather() {
  const w = tour.weather || {};
  const month = tour.date_from ? new Date(tour.date_from).getMonth() + 1 : 6;
  const monthNames = ["","Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

  document.getElementById("weatherLabel").textContent = `Klima im ${monthNames[month]}`;
  document.getElementById("weatherTitle").textContent = `Wetter in ${tour.destination}`;

  // Try to get real weather data if we have coordinates
  let weather = w;
  const currentHotel = (tour.hotels || [])[selectedHotelIndex];
  if (currentHotel?.lat && currentHotel?.lng) {
    try {
      const real = await TravelDiveAPI.getWeather(currentHotel.lat, currentHotel.lng, month);
      if (real && !real.error) {
        weather = { ...w, temp_day: real.temp_day+"°", temp_night: real.temp_night+"°", sun_hours: real.sun_hours+"h", rain_days: real.rain_days };
      }
    } catch(e) { /* use stored data */ }
  }

  const cards = [
    { icon:"☀️", val:weather.temp_day||"–", label:"Tagsüber" },
    { icon:"🌙", val:weather.temp_night||"–", label:"Nachts" },
    { icon:"🌊", val:weather.water_temp||"–", label:"Wasser" },
    { icon:"🌤", val:weather.sun_hours||"–", label:"Sonne/Tag" },
    { icon:"💧", val:weather.rain_days||"–", label:"Regentage" }
  ];
  document.getElementById("weatherGrid").innerHTML = cards.map(c => `
    <div class="weather-card"><div class="wicon">${c.icon}</div><div class="temp">${c.val}</div><div class="wlabel">${c.label}</div></div>
  `).join("");

  const moodText = getWeatherMood(weather, monthNames[month]);
  document.getElementById("weatherMood").textContent = moodText;

  const activityIdeas = getWeatherActivities(weather);
  document.getElementById("weatherActivities").innerHTML = activityIdeas.map(idea => `
    <div class="weather-activity">${idea}</div>
  `).join("");
  
  document.getElementById("weatherSub").textContent = `${monthNames[month]} ist eine wunderbare Reisezeit für ${tour.destination}.`;
}

// ── POIs ──
function renderPOIs() {
  const h = (tour.hotels || [])[selectedHotelIndex];
  const pois = h?.pois || tour.pois || [];
  if (pois.length === 0) {
    document.getElementById("explore").style.display = "none";
    return;
  }
  document.getElementById("explore").style.display = "";

  document.getElementById("poiGrid").innerHTML = pois.map((p, i) => `
    <div class="poi-card">
      <div class="poi-img" id="poi-img-${i}" style="background-color:var(--ocean);background-image:url('${p.photo_url||""}');">
        ${p.distance ? `<div class="poi-dist">${p.distance}</div>` : ""}
      </div>
      <div class="poi-info">
        <div class="poi-type">${p.category || "Sehenswürdigkeit"}</div>
        <div class="poi-name">${p.name}</div>
        <div class="poi-desc">${p.description}</div>
      </div>
    </div>
  `).join("");

  // Load real photos from Google Places
  pois.forEach(async (p, i) => {
    const searchTerm = p.search_query || p.name;
    if (!searchTerm) return;
    try {
      const results = await TravelDiveAPI.searchPlace(`${searchTerm} ${tour.destination}`);
      if (results[0]?.photo_ref) {
        const url = TravelDiveAPI.getPlacePhotoUrl(results[0].photo_ref, 600);
        const el = document.getElementById(`poi-img-${i}`);
        if (el) {
          el.style.backgroundImage = `url('${url}')`;
        }
      }
    } catch(e) {
      console.warn(`POI photo failed for "${searchTerm}":`, e);
    }
  });
}

// ── MAP ──
function renderMap() {
  const h = (tour.hotels || [])[selectedHotelIndex];
  if (!h) return;

  const pois = (h.pois || tour.pois || []).slice(0, 6);
  mapLocations = [
    {
      label: `🏨 ${h.name}`,
      query: buildMapQuery(h, `${h.name} ${h.location || tour.destination}`),
      externalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + " " + (h.location || tour.destination || ""))}`
    },
    ...pois.map((p) => ({
      label: `📍 ${p.name || "Highlight"}`,
      query: buildMapQuery(p, `${p.name || "Highlight"} ${tour.destination}`),
      externalUrl: p.lat && p.lng
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.lat},${p.lng}`)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name || "Highlight") + " " + tour.destination)}`
    }))
  ];
  selectedMapLocation = Math.min(selectedMapLocation, mapLocations.length - 1);
  const focused = mapLocations[selectedMapLocation] || mapLocations[0];
  const url = TravelDiveAPI.getGoogleMapsEmbedUrl(focused.query, 14);
  if (url) {
    document.getElementById("mapWrap").innerHTML = `
      <iframe src="${url}" allowfullscreen loading="lazy"></iframe>
      <div class="map-locations">
        ${mapLocations.map((location, index) => `
          <button class="map-location ${index === selectedMapLocation ? "active" : ""}" onclick="focusMapLocation(${index})">${escapeHTML(location.label)}</button>
        `).join("")}
      </div>
    `;
  }
}

function focusMapLocation(index) {
  if (!mapLocations[index]) return;
  selectedMapLocation = index;
  renderMap();
  if (mapLocations[index].externalUrl) {
    window.open(mapLocations[index].externalUrl, "_blank", "noopener");
  }
}

function buildMapQuery(item, fallbackQuery) {
  if (item.place_id) return `place_id:${item.place_id}`;
  if (item.lat && item.lng) return `${item.lat},${item.lng}`;
  return fallbackQuery;
}

// ── DAY PLAN ──
function renderDayPlan() {
  const h = (tour.hotels || [])[selectedHotelIndex];
  const items = h?.day_items || tour.day_items || [];
  if (items.length === 0) {
    document.getElementById("day").style.display = "none";
    return;
  }
  document.getElementById("day").style.display = "";

  // Preference tags
  const prefs = getDisplayPreferences();
  if (prefs.length > 0) {
    const dayPref = document.getElementById("dayPref");
    dayPref.style.display = "flex";
    dayPref.innerHTML = `
      <div class="dp-label">Personalisiert für:</div>
      <div class="dp-tags">${prefs.map(p => {
        const icon = PREF_ICONS[p.toLowerCase()] || "✦";
        return `<span class="dp-tag">${icon} ${p}</span>`;
      }).join("")}</div>
    `;
  }

  document.getElementById("timeline").innerHTML = items.map(item => `
    <div class="tl-item">
      <div class="tl-dot"></div>
      <div>
        <div class="tl-time">${item.time}</div>
        <div class="tl-title">${item.title}</div>
        <div class="tl-desc">${item.description}</div>
      </div>
    </div>
  `).join("");
}

// ── CTA ──
function renderCTA() {
  const h = (tour.hotels || [])[selectedHotelIndex];
  if (h) {
    document.getElementById("ctaPrice").textContent = h.price_pp ? `${h.price_pp} €` : "";
    document.getElementById("ctaPriceSub").textContent = 
      `pro Person · ${tour.nights} Nächte · ${tour.meal_plan}${tour.departure_airport ? " · inkl. Flug ab "+tour.departure_airport : ""}`;
  }

  const agent = tour.agent_name.split(" ")[0];
  document.getElementById("ctaBtn").textContent = `Jetzt bei ${agent} anfragen`;
  
  // Build contact info
  const contactInfo = document.getElementById("ctaContact");
  if (contactInfo) {
    const parts = [];
    if (tour.agent_email) parts.push(`<a href="mailto:${tour.agent_email}" style="color:var(--ocean);text-decoration:none;">✉️ ${tour.agent_email}</a>`);
    if (tour.agent_phone) parts.push(`<a href="tel:${tour.agent_phone}" style="color:var(--ocean);text-decoration:none;">📞 ${tour.agent_phone}</a>`);
    contactInfo.innerHTML = parts.join('<span style="margin:0 .8rem;color:var(--text-light);">·</span>');
  }

  document.getElementById("ctaBtn").onclick = function() {
    TravelDiveTracker.trackCTAClick();
    if (tour.agent_email) {
      const hotel = (tour.hotels || [])[selectedHotelIndex];
      const subject = encodeURIComponent(`Anfrage: ${tour.destination}${hotel ? " – " + hotel.name : ""}`);
      const body = encodeURIComponent(
        `Hallo ${tour.agent_name},\n\nich interessiere mich für das Angebot "${tour.destination}"` +
        (hotel ? ` im ${hotel.name}` : "") +
        (selectedTransfer ? `\n\nBevorzugter Transfer: ${selectedTransfer}` : "") +
        `\n\nBitte kontaktieren Sie mich für weitere Details.\n\nMit freundlichen Grüßen`
      );
      window.location.href = `mailto:${tour.agent_email}?subject=${subject}&body=${body}`;
    } else {
      alert(`Vielen Dank für Ihr Interesse! ${tour.agent_name} wird sich bei Ihnen melden.`);
    }
  };

  updateCTASelections();
}

function updateCTASelections() {
  const parts = [];
  if (selectedTransfer) parts.push("Anreise: " + selectedTransfer);
  const h = (tour.hotels || [])[selectedHotelIndex];
  if (h) parts.push("Hotel: " + h.name);
  document.getElementById("ctaSelections").textContent = parts.join(" · ");
  
  // Update price
  if (h?.price_pp) document.getElementById("ctaPrice").textContent = h.price_pp + " €";
}

// ── PROGRESS ──
function renderProgress() {
  const sections = [
    { id:"hero", label:"Willkommen" },
    { id:"selector", label:"Hotels" },
    { id:"transfer", label:"Anreise" },
    { id:"hotel", label:"Details" },
    { id:"weather", label:"Klima" },
    { id:"explore", label:"Umgebung" },
    { id:"day", label:"Ihr Tag" },
    { id:"cta", label:"Anfragen" }
  ].filter(s => {
    const el = document.getElementById(s.id);
    return el && el.style.display !== "none";
  });

  document.getElementById("progressBar").innerHTML = sections.map(s => `
    <div class="progress-step" data-target="${s.id}">
      <div class="step-dot"></div><span>${s.label}</span>
    </div>
  `).join("");

  // Click handlers
  document.querySelectorAll(".progress-step").forEach(step => {
    step.addEventListener("click", () => {
      const target = document.getElementById(step.dataset.target);
      if (target) target.scrollIntoView({behavior:"smooth"});
    });
  });
}

function renderFooter() {
  const created = tour.created_at ? new Date(tour.created_at).toLocaleDateString("de-DE", {day:"numeric",month:"long",year:"numeric"}) : "";
  document.getElementById("footerMeta").textContent = 
    `Zusammengestellt${created ? " am "+created : ""}${tour.customer_name ? " für "+tour.customer_name : ""}`;
}

// ── SCROLL ──
function setupScrollHandlers() {
  let lastScroll = 0;
  const sectionEls = Array.from(document.querySelectorAll("[data-track]")).filter(el => el.style.display !== "none");
  const steps = document.querySelectorAll(".progress-step");

  function onScroll() {
    const y = window.scrollY;
    // Topbar
    document.getElementById("topbar").classList.toggle("hide", y > lastScroll && y > 200);
    lastScroll = y;

    // Progress
    const viewY = y + window.innerHeight / 3;
    let cur = 0;
    sectionEls.forEach((el, i) => { if (el.offsetTop <= viewY) cur = i; });
    steps.forEach((s, i) => {
      s.classList.remove("active","done");
      if (i < cur) s.classList.add("done");
      if (i === cur) s.classList.add("active");
    });

    // Timeline reveal
    document.querySelectorAll(".tl-item").forEach(item => {
      if (item.getBoundingClientRect().top < window.innerHeight * 0.85) item.classList.add("visible");
    });
  }

  window.addEventListener("scroll", onScroll, {passive: true});
  onScroll();
}

// ── DETAIL TAB ──
function switchDetailTab(tab, el) {
  document.querySelectorAll(".detail-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".detail-panel").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("panel-"+tab).classList.add("active");
  TravelDiveTracker.trackDetailTab(tab);
}

// ── HELPERS ──
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getDaysUntilTrip(dateFrom) {
  if (!dateFrom) return null;
  const tripDate = new Date(dateFrom);
  if (Number.isNaN(tripDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  tripDate.setHours(0, 0, 0, 0);
  return Math.ceil((tripDate - today) / (1000 * 60 * 60 * 24));
}

function resolveReviewSource(review) {
  return review.source || review.platform || review.provider || "Verifizierte Gästemeinung";
}

function openPhotoLightbox(encodedUrl, encodedCaption = "") {
  const lightbox = document.getElementById("photoLightbox");
  const image = document.getElementById("photoLightboxImage");
  const captionEl = document.getElementById("photoLightboxCaption");
  if (!lightbox || !image || !captionEl) return;
  image.src = decodeURIComponent(encodedUrl || "");
  captionEl.textContent = decodeURIComponent(encodedCaption || "");
  lightbox.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closePhotoLightbox(event) {
  if (event) event.stopPropagation();
  const lightbox = document.getElementById("photoLightbox");
  const image = document.getElementById("photoLightboxImage");
  if (!lightbox || !image) return;
  lightbox.style.display = "none";
  image.src = "";
  document.body.style.overflow = "";
}


function getTravelerType() {
  if (tour?.traveler_type) return tour.traveler_type;
  const prefs = Array.isArray(tour?.preferences) ? tour.preferences : [];
  const meta = prefs.find(p => String(p).startsWith("__traveler_type:"));
  return meta ? meta.split(":")[1] : "";
}

function getTravelerTypeLabel() {
  const t = getTravelerType();
  const labels = { family: "für Familien", solo: "für Alleinreisende", couple: "für Pärchen" };
  return labels[t] || "";
}

function getDisplayPreferences() {
  return (tour?.preferences || []).filter(p => !String(p).startsWith("__traveler_type:"));
}

function getAudienceReviews(reviews) {
  const list = Array.isArray(reviews) ? reviews : [];
  const t = getTravelerType();
  if (!t || list.length === 0) return list;

  const keywords = {
    family: ["famil", "kinder", "child", "kids"],
    solo: ["solo", "allein", "single"],
    couple: ["paar", "pärchen", "partner", "honeymoon", "romantik"]
  };

  const scored = list.map(r => {
    const hay = [r.traveler_type, r.audience, r.author, r.text, Array.isArray(r.tags) ? r.tags.join(" ") : r.tags]
      .filter(Boolean).join(" ").toLowerCase();
    const explicit = [r.traveler_type, r.audience].filter(Boolean).join(" ").toLowerCase();
    const score = (explicit.includes(t) ? 3 : 0) + (keywords[t] || []).reduce((acc, kw) => acc + (hay.includes(kw) ? 1 : 0), 0);
    return { ...r, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);
  const matched = scored.filter(r => r._score > 0);
  const finalList = matched.length >= 2 ? matched : scored;
  return finalList.slice(0, 3).map(({ _score, ...rest }) => rest);
}


function withTimeout(promise, timeoutMs, message = "Zeitüberschreitung") {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function formatDateRange(from, to) {
  if (!from) return "";
  const f = new Date(from);
  const t = to ? new Date(to) : null;
  const opts = { day:"numeric", month:"long", year:"numeric" };
  if (t && f.getMonth() === t.getMonth()) {
    return `${f.getDate()}.–${t.toLocaleDateString("de-DE", opts)}`;
  }
  return t ? `${f.toLocaleDateString("de-DE",{day:"numeric",month:"long"})} – ${t.toLocaleDateString("de-DE",opts)}` : f.toLocaleDateString("de-DE",opts);
}

function getWeatherMood(weather, monthName) {
  const sunHours = parseFloat(String(weather.sun_hours || "").replace("h", "").replace(",", "."));
  const rainDays = parseFloat(String(weather.rain_days || "").replace(",", "."));

  if (!Number.isNaN(sunHours) && sunHours >= 8) {
    return `☀️ ${monthName} bringt viel Sonne – perfekt für lange Strandtage und Dinner bei Sonnenuntergang.`;
  }
  if (!Number.isNaN(rainDays) && rainDays >= 9) {
    return `🌴 ${monthName} wirkt tropisch und lebendig – ideal für eine Mischung aus Entspannung, Spa und Ausflügen.`;
  }
  return `🌺 ${monthName} bietet angenehme Bedingungen für eine abwechslungsreiche Urlaubswoche.`;
}

function getWeatherActivities(weather) {
  const sunHours = parseFloat(String(weather.sun_hours || "").replace("h", "").replace(",", "."));
  const rainDays = parseFloat(String(weather.rain_days || "").replace(",", "."));
  const ideas = ["🌅 Früher Strandspaziergang mit ruhiger See", "🍹 Sundowner mit Blick aufs Meer"];

  if (!Number.isNaN(sunHours) && sunHours >= 8) {
    ideas.unshift("🤿 Perfektes Zeitfenster für Pool, Strand und Wassersport");
  }
  if (!Number.isNaN(rainDays) && rainDays >= 8) {
    ideas.push("🧖‍♀️ Bei kurzen Schauern: Spa, Kulinarik oder Kultur-Highlights");
  }

  return ideas.slice(0, 3);
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Make switchDetailTab global
window.switchDetailTab = switchDetailTab;

// ── START ──
document.addEventListener("DOMContentLoaded", initTour);
