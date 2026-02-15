// TravelDive Dashboard
let currentTour = null; // Tour being edited
let tours = [];
let agentProfile = { name: "", company: "", email: "", phone: "" };
const PREFS = ["Strand","Familie","Kulinarik","Kultur","Wellness","Sport & Aktiv","Nightlife","Shopping","Wassersport","Wandern","Romantik","Fotografie"];
const PREF_ICONS = {"strand":"🏖","familie":"👨‍👩‍👧","kulinarik":"🍽","kultur":"🏛","wellness":"🧖","sport & aktiv":"🏃","nightlife":"🎉","shopping":"🛍","wassersport":"🤿","wandern":"🥾","romantik":"💑","fotografie":"📸"};
const TRAVELER_TYPE_OPTIONS = { family:"Familie mit Kindern", solo:"Alleinreisend", couple:"Pärchen" };

// ── AGENT PROFILE ──
function loadAgentProfile() {
  try {
    const saved = localStorage.getItem("traveldive_agent");
    if (saved) agentProfile = JSON.parse(saved);
  } catch(e) {}
  updateSidebarAgent();
  // Do not block dashboard usage if profile is not configured yet
  if (!agentProfile.name) {
    agentProfile.name = "Reiseberater";
    if (!agentProfile.company) agentProfile.company = "TravelDive";
    saveAgentProfile();
  }
}

function saveAgentProfile() {
  localStorage.setItem("traveldive_agent", JSON.stringify(agentProfile));
  updateSidebarAgent();
}

function updateSidebarAgent() {
  const initials = agentProfile.name 
    ? agentProfile.name.split(" ").map(n => n[0]).join("").toUpperCase()
    : "?";
  document.getElementById("sidebarAvatar").textContent = initials;
  document.getElementById("sidebarName").textContent = agentProfile.name || "Profil einrichten";
  document.getElementById("sidebarCompany").textContent = agentProfile.company || "Klicken zum Bearbeiten";
}

function showAgentSettings() {
  const fields = `
    <div class="form-group" style="margin-bottom:.8rem;">
      <label class="form-label">Ihr Name</label>
      <input class="form-input" id="mAgentName" value="${esc(agentProfile.name||"")}" placeholder="z.B. Sarah Meier">
    </div>
    <div class="form-group" style="margin-bottom:.8rem;">
      <label class="form-label">Reisebüro / Agentur</label>
      <input class="form-input" id="mAgentCompany" value="${esc(agentProfile.company||"")}" placeholder="z.B. Sonnenklar Reisebüro">
    </div>
    <div class="form-group" style="margin-bottom:.8rem;">
      <label class="form-label">E-Mail (wird im Tour-CTA angezeigt)</label>
      <input class="form-input" id="mAgentEmail" type="email" value="${esc(agentProfile.email||"")}" placeholder="sarah@reisebuero.de">
    </div>
    <div class="form-group">
      <label class="form-label">Telefon (optional)</label>
      <input class="form-input" id="mAgentPhone" value="${esc(agentProfile.phone||"")}" placeholder="+49 89 12345678">
    </div>
  `;
  openModal("Beraterprofil", fields, () => {
    agentProfile.name = document.getElementById("mAgentName").value.trim();
    agentProfile.company = document.getElementById("mAgentCompany").value.trim();
    agentProfile.email = document.getElementById("mAgentEmail").value.trim();
    agentProfile.phone = document.getElementById("mAgentPhone").value.trim();
    if (!agentProfile.name) return alert("Bitte geben Sie Ihren Namen ein.");
    saveAgentProfile();
    closeModal();
  });
}

// ── INIT ──
async function init() {
  await TravelDiveAPI.init();
  loadAgentProfile();
  renderPrefTags();
  loadTours();
}

// ── VIEWS ──
function showView(view) {
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
  document.getElementById("view-" + view).classList.add("active");
  document.querySelectorAll(".sidebar-item").forEach(item => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  if (view === "analytics") loadAnalyticsTourList();
}

// ── TOUR LIST ──
async function loadTours() {
  try {
    tours = await TravelDiveAPI.getTours();
    if (!Array.isArray(tours)) tours = [];
    renderTourTable();
    updateStats();
  } catch(e) {
    console.error("Load tours error:", e);
    tours = [];
    renderTourTable();
  }
}

function renderTourTable() {
  const body = document.getElementById("tourTableBody");
  if (tours.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">Noch keine Tours erstellt. Klicken Sie "+ Neue Tour" um zu starten.</td></tr>';
    return;
  }
  body.innerHTML = tours.map(t => {
    const initials = (t.customer_name||"??").split(" ").map(n=>n[0]).join("");
    const hotels = t.hotels ? (Array.isArray(t.hotels) ? t.hotels.length : 0) : 0;
    const dateStr = t.date_from ? new Date(t.date_from+"T00:00:00").toLocaleDateString("de-DE",{day:"numeric",month:"short"}) : "–";
    return `<tr>
      <td><div class="tour-customer"><div class="tc-avatar">${initials}</div><div><div class="tc-name">${t.customer_name||"–"}</div><div class="tc-email">${t.customer_email||""}</div></div></div></td>
      <td>${t.destination||"–"}</td>
      <td style="font-size:.8rem;">${dateStr}</td>
      <td>${hotels} Hotel${hotels!==1?"s":""}</td>
      <td><span class="badge badge-${t.status||"draft"}"><span class="badge-dot"></span> ${t.status==="live"?"Live":"Entwurf"}</span></td>
      <td style="font-weight:600;color:var(--ocean);">${t.unique_views||0}</td>
      <td><button class="btn btn-sm" onclick="editTour('${t.slug}')">Bearbeiten</button></td>
    </tr>`;
  }).join("");
}

function updateStats() {
  const live = tours.filter(t => t.status === "live").length;
  const views = tours.reduce((s, t) => s + (t.total_views || 0), 0);
  const clicks = tours.reduce((s, t) => s + (t.cta_clicks || 0), 0);
  const sessions = tours.reduce((s, t) => s + (t.unique_views || 0), 0);
  document.getElementById("statTours").textContent = live;
  document.getElementById("statViews").textContent = views;
  document.getElementById("statInquiries").textContent = clicks;
  document.getElementById("statConversion").textContent = sessions > 0 ? ((clicks/sessions)*100).toFixed(1)+"%" : "–";
}

// ── NEW TOUR ──
function newTour() {
  const safeName = (agentProfile.name || "Reiseberater").trim() || "Reiseberater";
  currentTour = {
    customer_name: "", customer_email: "", destination: "", date_from: "", date_to: "",
    departure_airport: "", meal_plan: "All-Inclusive", traveler_type: "family", preferences: [], personal_note: "",
    hero_video_url: "", hotels: [], pois: [], day_items: [], transfers: [], weather: {},
    agent_name: safeName, agent_company: agentProfile.company || "TravelDive",
    agent_email: agentProfile.email, agent_phone: agentProfile.phone, status: "draft"
  };
  populateEditor();
  showView("editor");
}

async function editTour(slug) {
  try {
    currentTour = await TravelDiveAPI.getTour(slug);
    if (!currentTour) return alert("Tour nicht gefunden");
    populateEditor();
    showView("editor");
  } catch(e) {
    alert("Fehler: " + e.message);
  }
}

function populateEditor() {
  const t = currentTour;
  document.getElementById("editorTitle").textContent = t.slug ? "Tour bearbeiten" : "Neue Tour";
  document.getElementById("editorBadge").className = `badge badge-${t.status||"draft"}`;
  document.getElementById("editorBadge").innerHTML = `<span class="badge-dot"></span> ${t.status==="live"?"Live":"Entwurf"}`;

  // Show/hide preview & share
  const hasSlug = !!t.slug;
  document.getElementById("btnPreview").style.display = hasSlug ? "" : "none";
  document.getElementById("shareBox").style.display = hasSlug && t.status === "live" ? "" : "none";
  if (hasSlug) document.getElementById("shareLink").value = `${window.location.origin}/t/${t.slug}`;

  // Basic fields
  document.getElementById("fCustomer").value = t.customer_name || "";
  document.getElementById("fEmail").value = t.customer_email || "";
  document.getElementById("fDateFrom").value = t.date_from || "";
  document.getElementById("fDateTo").value = t.date_to || "";
  document.getElementById("fDestination").value = t.destination || "";
  document.getElementById("fAirport").value = t.departure_airport || "";
  document.getElementById("fMealPlan").value = t.meal_plan || "All-Inclusive";
  document.getElementById("fTravelerType").value = getTravelerTypeFromTour(t);
  document.getElementById("fNote").value = t.personal_note || "";
  document.getElementById("fHeroVideo").value = t.hero_video_url || "";

  // Preferences
  const prefs = t.preferences || [];
  document.querySelectorAll(".pref-tag").forEach(tag => {
    tag.classList.toggle("selected", prefs.some(p => p.toLowerCase() === tag.dataset.pref.toLowerCase()));
  });

  // Hotels
  renderHotelList();
  // Show lists for first hotel (or empty)
  renderHotelEditorLists(0);
}

// Track which hotel is being edited in the content sections
let editingHotelIndex = 0;

function getEditingHotelIndex() {
  return editingHotelIndex;
}

function renderHotelEditorLists(index) {
  editingHotelIndex = index;
  const h = (currentTour.hotels || [])[index];
  
  // Update hotel selector label
  const label = document.getElementById("editingHotelLabel");
  if (label) {
    label.textContent = h ? `Inhalte für: ${h.name}` : "Kein Hotel ausgewählt";
  }
  
  // Update hotel selector buttons
  document.querySelectorAll(".hotel-edit-tab").forEach((btn, i) => {
    btn.classList.toggle("btn-primary", i === index);
  });

  // Render lists from hotel data
  renderEditableList("poiList", h?.pois || [], "poi");
  renderEditableList("dayList", h?.day_items || [], "day");
  renderEditableList("transferList", h?.transfers || [], "transfer");
  renderRoomCategoryManager();
}

// ── PREFERENCES ──
function renderPrefTags() {
  document.getElementById("prefTags").innerHTML = PREFS.map(p => {
    const icon = PREF_ICONS[p.toLowerCase()] || "✦";
    return `<div class="pref-tag" data-pref="${p}" onclick="this.classList.toggle('selected')">${icon} ${p}</div>`;
  }).join("");
}

function getSelectedPrefs() {
  return Array.from(document.querySelectorAll(".pref-tag.selected")).map(t => t.dataset.pref);
}

// ── HOTELS ──
function renderHotelList() {
  const hotels = currentTour.hotels || [];
  document.getElementById("hotelCount").textContent = `${hotels.length} von max. 5`;
  const container = document.getElementById("hotelList");
  
  if (hotels.length === 0) {
    container.innerHTML = '<div class="info-note">💡 Fügen Sie Hotels hinzu und klicken Sie "KI generieren" um Inhalte zu erstellen.</div>';
    return;
  }

  const contentStatus = (h) => {
    const parts = [];
    if (h.description) parts.push("Beschreibung");
    if (h.pois?.length) parts.push(`${h.pois.length} POIs`);
    if (h.day_items?.length) parts.push("Tagesplan");
    if (h.transfers?.length) parts.push("Transfers");
    return parts.length ? `<span class="ai-badge">KI ✓ ${parts.join(", ")}</span>` : '<span style="color:var(--sunset);font-size:.65rem;">Noch keine KI-Inhalte</span>';
  };

  container.innerHTML = hotels.map((h, i) => `
    <div class="hotel-entry" style="${i === editingHotelIndex ? "border-color:var(--ocean);background:var(--ocean-pale);" : ""}">
      <div class="hotel-thumb" style="background-image:url('${h.photo_url||""}');background-color:var(--bg);"></div>
      <div class="hotel-entry-info">
        <div class="he-name">${h.name} ${"★".repeat(h.stars||5)}</div>
        <div class="he-meta">${h.location||""} · ${h.price_pp||"–"} € p.P. · ${contentStatus(h)}</div>
      </div>
      <div class="hotel-entry-actions">
        <button class="btn btn-sm hotel-edit-tab ${i===editingHotelIndex?"btn-primary":""}" onclick="renderHotelEditorLists(${i});renderHotelList();">📋 Inhalte</button>
        <button class="btn btn-sm" onclick="generateHotelContent(${i})">🤖 KI generieren</button>
        <button class="btn btn-sm" onclick="editHotel(${i})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="removeHotel(${i})">✕</button>
      </div>
    </div>
  `).join("") + `<div id="editingHotelLabel" style="font-size:.75rem;color:var(--ocean);font-weight:600;margin-top:.6rem;padding:.4rem .6rem;background:var(--ocean-pale);border-radius:6px;display:inline-block;">Inhalte für: ${hotels[editingHotelIndex]?.name || "–"}</div>`;
}

function addHotel() {
  if ((currentTour.hotels || []).length >= 5) return alert("Maximal 5 Hotels");
  openModal("Hotel hinzufügen", `
    <div class="form-group" style="margin-bottom:.8rem;"><label class="form-label">Hotelname</label><input class="form-input" id="mHotelName" placeholder="z.B. Blue Palace Elounda"></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Ort</label><input class="form-input" id="mHotelLoc" placeholder="z.B. Elounda"></div>
    <div class="form-group"><label class="form-label">Sterne</label><select class="form-select" id="mHotelStars"><option>5</option><option>4</option><option>3</option></select></div></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Preis p.P. (€)</label><input class="form-input" id="mHotelPrice" type="number" placeholder="1249"></div>
    <div class="form-group"><label class="form-label">Preishinweis</label><input class="form-input" id="mHotelPriceNote" placeholder="z.B. Frühbucher bis 31.3."></div></div>
    <div class="form-group"><label class="form-label">YouTube Video URL (optional)</label><input class="form-input" id="mHotelVideo" placeholder="https://youtube.com/..."></div>
    <div class="form-group" style="margin-top:.5rem;"><label class="form-label">Google Places Suche</label><input class="form-input" id="mHotelSearch" placeholder="Hotelname eingeben → Enter drücken für Fotos & Infos"><div class="form-hint">Findet automatisch Fotos, Bewertungen und Koordinaten.</div></div>
  `, () => {
    const hotel = {
      name: document.getElementById("mHotelName").value,
      location: document.getElementById("mHotelLoc").value,
      stars: parseInt(document.getElementById("mHotelStars").value),
      price_pp: document.getElementById("mHotelPrice").value,
      price_note: document.getElementById("mHotelPriceNote").value,
      video_url: document.getElementById("mHotelVideo").value,
      place_id: null, photo_url: "", lat: null, lng: null,
      description: "", pools: [], restaurants: [], room: {}, room_options: [], selected_room_index: 0, room_source_url: "", reviews: []
      description: "", pools: [], restaurants: [], room: {}, room_options: [], selected_room_index: 0, reviews: []
    };
    if (!hotel.name) return alert("Bitte Hotelnamen eingeben");
    if (!currentTour.hotels) currentTour.hotels = [];
    currentTour.hotels.push(hotel);
    renderHotelList();
    closeModal();
    // Try to find on Google Places
    searchHotelPlace(currentTour.hotels.length - 1);
  });
}

async function searchHotelPlace(index) {
  const h = currentTour.hotels[index];
  try {
    const results = await TravelDiveAPI.searchPlace(`${h.name} ${h.location || currentTour.destination || ""}`);
    if (results[0]) {
      h.place_id = results[0].place_id;
      h.lat = results[0].lat;
      h.lng = results[0].lng;
      if (results[0].photo_ref) {
        h.photo_url = TravelDiveAPI.getPlacePhotoUrl(results[0].photo_ref, 600);
      }
      renderHotelList();
    }
  } catch(e) { console.warn("Place search failed:", e); }
}

function removeHotel(index) {
  if (!confirm("Hotel entfernen?")) return;
  currentTour.hotels.splice(index, 1);
  renderHotelList();
}

function editHotel(index) {
  const h = currentTour.hotels[index];
  openModal(`${h.name} bearbeiten`, `
    <div class="form-group" style="margin-bottom:.8rem;"><label class="form-label">Name</label><input class="form-input" id="mHotelName" value="${esc(h.name)}"></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Ort</label><input class="form-input" id="mHotelLoc" value="${esc(h.location||"")}"></div>
    <div class="form-group"><label class="form-label">Preis p.P.</label><input class="form-input" id="mHotelPrice" value="${h.price_pp||""}"></div></div>
    <div class="form-group"><label class="form-label">Video URL</label><input class="form-input" id="mHotelVideo" value="${esc(h.video_url||"")}"></div>
    <div class="form-group" style="margin-top:.5rem;"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="mHotelDesc">${esc(h.description||"")}</textarea></div>
  `, () => {
    h.name = document.getElementById("mHotelName").value;
    h.location = document.getElementById("mHotelLoc").value;
    h.price_pp = document.getElementById("mHotelPrice").value;
    h.video_url = document.getElementById("mHotelVideo").value;
    h.description = document.getElementById("mHotelDesc").value;
    renderHotelList();
    closeModal();
  });
}

// ── AI GENERATION ──
async function generateHotelContent(hotelIndex) {
  const h = currentTour.hotels[hotelIndex];
  const prefs = getSelectedPrefs();
  const dest = document.getElementById("fDestination").value;
  const dates = document.getElementById("fDateFrom").value + " – " + document.getElementById("fDateTo").value;
  const nights = calcNights();
  const mealPlan = document.getElementById("fMealPlan").value;

  if (!h.name || !dest) return alert("Bitte Hotel und Reiseziel angeben");

  // Show generating state
  const btn = event.target;
  btn.textContent = "⏳ Generiert…";
  btn.disabled = true;

  try {
    const data = await TravelDiveAPI.generateTourContent({
      hotel_name: h.name,
      location: h.location || "",
      destination: dest,
      dates: dates,
      nights: nights,
      meal_plan: mealPlan,
      traveler_type: document.getElementById("fTravelerType")?.value || "family",
      preferences: prefs
    });

    // Update hotel with generated content (ALL content stored per hotel)
    h.description = data.hotel_description || h.description;
    h.pools = data.pools || [];
    h.restaurants = data.restaurants || [];
    h.room = data.room || {};
    if (!Array.isArray(h.room_options)) h.room_options = [];
    if (h.room && Object.keys(h.room).length && h.room_options.length === 0) {
      h.room_options = [{
        category: h.room.type || "Zimmerkategorie",
        size: h.room.size || "",
        description: h.room.description || "",
        features: h.room.features || []
      }];
      h.selected_room_index = 0;
    }
    h.reviews = data.reviews || [];
    
    // Store POIs, day plan, transfers, weather PER HOTEL
    if (data.pois) h.pois = data.pois.map(p => ({...p, is_manual: false}));
    if (data.day_items) h.day_items = data.day_items.map(d => ({...d, is_manual: false}));
    if (data.transfers) h.transfers = data.transfers.map(t => ({...t, is_manual: false}));
    if (data.weather) h.weather = data.weather;
    if (data.hero_title) h.hero_title = data.hero_title;
    if (data.hero_subtitle) h.hero_subtitle = data.hero_subtitle;

    // Update editor lists to show content from current hotel
    renderHotelEditorLists(hotelIndex);

    renderHotelList();
    btn.textContent = "✓ Generiert!";
    setTimeout(() => { btn.textContent = "🤖 KI generieren"; btn.disabled = false; }, 2000);
  } catch(e) {
    console.error("Generate error:", e);
    btn.textContent = "❌ Fehler";
    btn.disabled = false;
    alert("KI-Generierung fehlgeschlagen: " + e.message);
  }
}

async function generatePOIs() {
  const dest = document.getElementById("fDestination").value;
  const hIdx = getEditingHotelIndex();
  const h = (currentTour.hotels||[])[hIdx];
  if (!dest) return alert("Bitte Reiseziel angeben");
  if (!h) return alert("Bitte zuerst ein Hotel hinzufügen");
  document.getElementById("poiGenerating").classList.add("active");
  document.getElementById("poiList").style.display = "none";
  try {
    const data = await TravelDiveAPI.generateTourContent({
      hotel_name: h.name || "",
      location: h.location || "",
      destination: dest, dates: "", nights: calcNights(),
      meal_plan: document.getElementById("fMealPlan").value,
      preferences: getSelectedPrefs()
    });
    if (data.pois) {
      h.pois = data.pois.map(p => ({...p, is_manual: false}));
      renderEditableList("poiList", h.pois, "poi");
    }
  } catch(e) { alert("Fehler: " + e.message); }
  document.getElementById("poiGenerating").classList.remove("active");
  document.getElementById("poiList").style.display = "";
}

async function generateDayPlan() {
  const dest = document.getElementById("fDestination").value;
  const hIdx = getEditingHotelIndex();
  const h = (currentTour.hotels||[])[hIdx];
  if (!dest) return alert("Bitte Reiseziel angeben");
  if (!h) return alert("Bitte zuerst ein Hotel hinzufügen");
  document.getElementById("dayGenerating").classList.add("active");
  document.getElementById("dayList").style.display = "none";
  try {
    const data = await TravelDiveAPI.generateTourContent({
      hotel_name: h.name || "",
      location: h.location || "",
      destination: dest, dates: "", nights: calcNights(),
      meal_plan: document.getElementById("fMealPlan").value,
      preferences: getSelectedPrefs()
    });
    if (data.day_items) {
      h.day_items = data.day_items.map(d => ({...d, is_manual: false}));
      renderEditableList("dayList", h.day_items, "day");
    }
  } catch(e) { alert("Fehler: " + e.message); }
  document.getElementById("dayGenerating").classList.remove("active");
  document.getElementById("dayList").style.display = "";
}

async function generateTransfers() {
  const dest = document.getElementById("fDestination").value;
  const hIdx = getEditingHotelIndex();
  const h = (currentTour.hotels||[])[hIdx];
  if (!dest) return alert("Bitte Reiseziel angeben");
  if (!h) return alert("Bitte zuerst ein Hotel hinzufügen");
  document.getElementById("transferGenerating").classList.add("active");
  document.getElementById("transferList").style.display = "none";
  try {
    const data = await TravelDiveAPI.generateTourContent({
      hotel_name: h.name || "",
      location: h.location || "",
      destination: dest, dates: "", nights: calcNights(),
      meal_plan: document.getElementById("fMealPlan").value,
      preferences: getSelectedPrefs()
    });
    if (data.transfers) {
      h.transfers = data.transfers.map(t => ({...t, is_manual: false}));
      renderEditableList("transferList", h.transfers, "transfer");
    }
  } catch(e) { alert("Fehler: " + e.message); }
  document.getElementById("transferGenerating").classList.remove("active");
  document.getElementById("transferList").style.display = "";
}

// ── EDITABLE LISTS ──
function renderEditableList(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:.82rem;">Noch keine Einträge. Klicken Sie "KI generieren" oder fügen Sie manuell hinzu.</div>';
    return;
  }
  container.innerHTML = items.map((item, i) => {
    const badge = item.is_manual ? '<span class="manual-badge">Manuell</span>' : '<span class="ai-badge">KI</span>';
    let topInfo = "";
    if (type === "day" && item.time) topInfo = `<span class="ei-time">${item.time}</span>`;
    if (type === "poi" && item.category) topInfo = `<span class="ei-category">${item.category}</span>`;
    if (type === "transfer") topInfo = `<span class="ei-category">${item.price||""}</span>`;
    return `<div class="editable-item" draggable="true" data-type="${type}" data-index="${i}">
      <div class="drag-handle">⠿</div>
      <div class="ei-content">
        <div class="ei-top">${topInfo}${badge}</div>
        <div class="ei-title">${item.name || item.title || ""}</div>
        <div class="ei-desc">${item.description || ""}</div>
      </div>
      <div class="ei-actions">
        <button class="ei-btn" onclick="editItem('${type}',${i})">✏️</button>
        <button class="ei-btn delete" onclick="removeListItem('${type}',${i})">🗑</button>
      </div>
    </div>`;
  }).join("");
  setupDragDrop(containerId, type);
}

function getListForType(type) {
  const h = (currentTour.hotels||[])[getEditingHotelIndex()];
  if (!h) return [];
  if (type === "poi") return h.pois || (h.pois = []);
  if (type === "day") return h.day_items || (h.day_items = []);
  return h.transfers || (h.transfers = []);
}

function removeListItem(type, index) {
  const list = getListForType(type);
  list.splice(index, 1);
  const containerId = type === "poi" ? "poiList" : type === "day" ? "dayList" : "transferList";
  renderEditableList(containerId, list, type);
}

function editItem(type, index) {
  const list = getListForType(type);
  const item = list[index];
  
  let fields = "";
  if (type === "poi") {
    fields = `
      <div class="form-group" style="margin-bottom:.7rem;"><label class="form-label">Name</label><input class="form-input" id="mItemName" value="${esc(item.name||"")}"></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Kategorie</label><select class="form-select" id="mItemCat"><option ${item.category==="Strand"?"selected":""}>Strand</option><option ${item.category==="Kultur"?"selected":""}>Kultur</option><option ${item.category==="Gastronomie"?"selected":""}>Gastronomie</option><option ${item.category==="Natur"?"selected":""}>Natur</option><option ${item.category==="Stadt"?"selected":""}>Stadt</option><option ${item.category==="Sport"?"selected":""}>Sport</option><option ${item.category==="Geheimtipp"?"selected":""}>Geheimtipp</option></select></div>
      <div class="form-group"><label class="form-label">Entfernung</label><input class="form-input" id="mItemDist" value="${esc(item.distance||"")}"></div></div>
      <div class="form-group"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="mItemDesc">${esc(item.description||"")}</textarea></div>`;
  } else if (type === "day") {
    fields = `
      <div class="form-row"><div class="form-group"><label class="form-label">Uhrzeit</label><input class="form-input" id="mItemTime" value="${esc(item.time||"")}"></div>
      <div class="form-group"><label class="form-label">Titel</label><input class="form-input" id="mItemTitle" value="${esc(item.title||"")}"></div></div>
      <div class="form-group"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="mItemDesc">${esc(item.description||"")}</textarea></div>`;
  } else {
    fields = `
      <div class="form-row"><div class="form-group"><label class="form-label">Name</label><input class="form-input" id="mItemName" value="${esc(item.name||"")}"></div>
      <div class="form-group"><label class="form-label">Icon (Emoji)</label><input class="form-input" id="mItemIcon" value="${esc(item.icon||"")}"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Dauer</label><input class="form-input" id="mItemDuration" value="${esc(item.duration||"")}"></div>
      <div class="form-group"><label class="form-label">Preis</label><input class="form-input" id="mItemPrice" value="${esc(item.price||"")}"></div></div>
      <div class="form-group"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="mItemDesc">${esc(item.description||"")}</textarea></div>`;
  }

  openModal("Eintrag bearbeiten", fields, () => {
    if (type === "poi") {
      item.name = document.getElementById("mItemName").value;
      item.category = document.getElementById("mItemCat").value;
      item.distance = document.getElementById("mItemDist").value;
      item.description = document.getElementById("mItemDesc").value;
    } else if (type === "day") {
      item.time = document.getElementById("mItemTime").value;
      item.title = document.getElementById("mItemTitle").value;
      item.description = document.getElementById("mItemDesc").value;
    } else {
      item.name = document.getElementById("mItemName").value;
      item.icon = document.getElementById("mItemIcon").value;
      item.duration = document.getElementById("mItemDuration").value;
      item.price = document.getElementById("mItemPrice").value;
      item.description = document.getElementById("mItemDesc").value;
    }
    const containerId = type==="poi"?"poiList":type==="day"?"dayList":"transferList";
    renderEditableList(containerId, list, type);
    closeModal();
  });
}

function addItem(type) {
  const list = getListForType(type);
  
  const emptyItem = type === "poi" 
    ? {name:"",category:"Geheimtipp",description:"",distance:"",is_manual:true}
    : type === "day"
    ? {time:"",title:"",description:"",is_manual:true}
    : {name:"",icon:"🚐",duration:"",description:"",price:"",is_manual:true};
  
  list.push(emptyItem);
  editItem(type, list.length - 1);
}


function normalizeRoomOption(option = {}) {
  return {
    category: option.category || option.type || "Zimmerkategorie",
    size: option.size || "",
    description: option.description || "",
    features: Array.isArray(option.features) ? option.features : []
  };
}

function ensureRoomOptions(hotel) {
  if (!hotel) return [];
  if (!Array.isArray(hotel.room_options)) hotel.room_options = [];
  if (hotel.room_options.length === 0 && hotel.room && Object.keys(hotel.room).length) {
    hotel.room_options = [normalizeRoomOption(hotel.room)];
    hotel.selected_room_index = 0;
  }
  if (typeof hotel.selected_room_index !== "number") hotel.selected_room_index = 0;
  return hotel.room_options;
}

function renderRoomCategoryManager() {
  const h = (currentTour.hotels || [])[getEditingHotelIndex()];
  const infoEl = document.getElementById("roomCategoryInfo");
  const listEl = document.getElementById("roomCategoryList");
  if (!infoEl || !listEl) return;
  if (!h) {
    infoEl.textContent = "Bitte zuerst ein Hotel auswählen.";
    listEl.innerHTML = "";
    return;
  }

  const options = ensureRoomOptions(h);
  const roomSourceInput = document.getElementById("roomSourceUrl");
  if (roomSourceInput) roomSourceInput.value = h.room_source_url || "";
  infoEl.textContent = `Ausgewähltes Hotel: ${h.name || "–"}. Markieren Sie eine Kategorie als Standard für die Kundenseite.`;

  if (options.length === 0) {
    listEl.innerHTML = '<div class="info-note">Noch keine Zimmerkategorien vorhanden. Legen Sie mindestens eine Kategorie an.</div>';
    return;
  }

  listEl.innerHTML = options.map((room, i) => {
    const features = (room.features || []).slice(0, 3).map(f => f.title || f).filter(Boolean).join(" · ");
    return `
      <div class="editable-item" style="display:block;">
        <div style="display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start;">
          <div>
            <div class="ei-title">${esc(room.category)} ${room.size ? `<span class="ei-time">(${esc(room.size)})</span>` : ""}</div>
            <div class="ei-desc">${esc(room.description || "Keine Beschreibung")}</div>
            ${features ? `<div class="ei-time" style="margin-top:.35rem;">Highlights: ${esc(features)}</div>` : ""}
          </div>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn btn-sm ${h.selected_room_index === i ? "btn-primary" : ""}" onclick="selectRoomOption(${i})">${h.selected_room_index === i ? "✓ Gewählt" : "Als Standard"}</button>
            <button class="btn btn-sm" onclick="editRoomOption(${i})">Bearbeiten</button>
            <button class="btn btn-sm btn-danger" onclick="removeRoomOption(${i})">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function addRoomOption() {
  const h = (currentTour.hotels || [])[getEditingHotelIndex()];
  if (!h) return alert("Bitte zuerst ein Hotel auswählen.");
  ensureRoomOptions(h);
  openRoomOptionModal({ category:"", size:"", description:"", features:[] }, -1);
}

function editRoomOption(index) {
  const h = (currentTour.hotels || [])[getEditingHotelIndex()];
  if (!h) return;
  const options = ensureRoomOptions(h);
  const room = options[index];
  if (!room) return;
  openRoomOptionModal(room, index);
}

function openRoomOptionModal(room, index) {
  const featuresText = (room.features || []).map(f => typeof f === "string" ? f : (f.title || f.detail || "")).filter(Boolean).join("\n");
  openModal(index >= 0 ? "Zimmerkategorie bearbeiten" : "Zimmerkategorie hinzufügen", `
    <div class="form-group" style="margin-bottom:.8rem;"><label class="form-label">Zimmerkategorie</label><input class="form-input" id="mRoomCategory" value="${esc(room.category || "")}" placeholder="z.B. Deluxe Ocean View"></div>
    <div class="form-group" style="margin-bottom:.8rem;"><label class="form-label">Größe (optional)</label><input class="form-input" id="mRoomSize" value="${esc(room.size || "")}" placeholder="z.B. 42 m²"></div>
    <div class="form-group" style="margin-bottom:.8rem;"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="mRoomDesc">${esc(room.description || "")}</textarea></div>
    <div class="form-group"><label class="form-label">Highlights (eine Zeile = ein Highlight)</label><textarea class="form-textarea" id="mRoomFeatures" placeholder="Kingsize-Bett\nMeerblick\nBalkon">${esc(featuresText)}</textarea></div>
  `, () => saveRoomOption(index));
}

function saveRoomOption(index) {
  const h = (currentTour.hotels || [])[getEditingHotelIndex()];
  if (!h) return;
  const options = ensureRoomOptions(h);
  const category = document.getElementById("mRoomCategory").value.trim();
  if (!category) return alert("Bitte eine Zimmerkategorie angeben.");
  const rawFeatures = document.getElementById("mRoomFeatures").value.split("\n").map(v => v.trim()).filter(Boolean);
  const roomOption = {
    category,
    size: document.getElementById("mRoomSize").value.trim(),
    description: document.getElementById("mRoomDesc").value.trim(),
    features: rawFeatures.map(item => ({ title: item, detail: "" }))
  };

  if (index >= 0) options[index] = roomOption;
  else options.push(roomOption);

  if (typeof h.selected_room_index !== "number" || h.selected_room_index < 0) h.selected_room_index = 0;
  if (index === -1 && options.length === 1) h.selected_room_index = 0;

  h.room_options = options;
  h.room = {
    type: options[h.selected_room_index]?.category || roomOption.category,
    size: options[h.selected_room_index]?.size || roomOption.size,
    description: options[h.selected_room_index]?.description || roomOption.description,
    features: options[h.selected_room_index]?.features || roomOption.features
  };

  closeModal();
  renderRoomCategoryManager();
}

function selectRoomOption(index) {
  const h = (currentTour.hotels || [])[getEditingHotelIndex()];
  if (!h) return;
  const options = ensureRoomOptions(h);
  if (!options[index]) return;
  h.selected_room_index = index;
  h.room = {
    type: options[index].category,
    size: options[index].size,
    description: options[index].description,
    features: options[index].features
  };
  renderRoomCategoryManager();
}

function removeRoomOption(index) {
  const h = (currentTour.hotels || [])[getEditingHotelIndex()];
  if (!h) return;
  const options = ensureRoomOptions(h);
  if (!options[index]) return;
  options.splice(index, 1);
  if (h.selected_room_index >= options.length) h.selected_room_index = Math.max(0, options.length - 1);
  h.room_options = options;
  const active = options[h.selected_room_index];
  h.room = active ? {
    type: active.category,
    size: active.size,
    description: active.description,
    features: active.features
  } : {};
  renderRoomCategoryManager();
}

// ── DRAG & DROP ──
function setupDragDrop(containerId, type) {
  const container = document.getElementById(containerId);
  let dragItem = null;
  container.querySelectorAll(".editable-item").forEach(item => {
    item.addEventListener("dragstart", () => { dragItem = item; item.classList.add("dragging"); });
    item.addEventListener("dragend", () => { item.classList.remove("dragging"); reorderFromDOM(containerId, type); dragItem = null; });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      if (dragItem && dragItem !== item) container.insertBefore(dragItem, item);
    });
  });
}

function reorderFromDOM(containerId, type) {
  const list = getListForType(type);
  const items = document.getElementById(containerId).querySelectorAll(".editable-item");
  const newOrder = Array.from(items).map(el => parseInt(el.dataset.index));
  const reordered = newOrder.map(i => list[i]);
  const h = (currentTour.hotels||[])[getEditingHotelIndex()];
  if (!h) return;
  if (type === "poi") h.pois = reordered;
  else if (type === "day") h.day_items = reordered;
  else h.transfers = reordered;
  const cid = type==="poi"?"poiList":type==="day"?"dayList":"transferList";
  renderEditableList(cid, reordered, type);
}


function getTravelerTypeFromTour(tourData = {}) {
  if (tourData.traveler_type && TRAVELER_TYPE_OPTIONS[tourData.traveler_type]) return tourData.traveler_type;
  const prefs = Array.isArray(tourData.preferences) ? tourData.preferences : [];
  const meta = prefs.find(p => String(p).startsWith("__traveler_type:"));
  const parsed = meta ? meta.split(":")[1] : "";
  return TRAVELER_TYPE_OPTIONS[parsed] ? parsed : "family";
}


function mapExtractedRoomToOption(room = {}) {
  const details = [];
  if (room.occupancy) details.push(`max. ${room.occupancy} Gäste`);
  if (room.beds) details.push(room.beds);
  const amenities = Array.isArray(room.amenities) ? room.amenities.slice(0, 6) : [];

  return {
    category: room.room_name || "Zimmerkategorie",
    size: "",
    description: [room.description, details.join(" · ")].filter(Boolean).join(" · "),
    features: amenities.map(item => ({ title: item, detail: "" }))
  };
}

async function extractRoomsForCurrentHotel() {
  const h = (currentTour.hotels || [])[getEditingHotelIndex()];
  if (!h) return alert("Bitte zuerst ein Hotel auswählen.");

  const url = document.getElementById("roomSourceUrl")?.value?.trim();
  if (!url) return alert("Bitte eine Hotel-URL eingeben.");

  const trigger = event?.target;
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = "⏳ Extrahiere…";
  }

  try {
    const data = await TravelDiveAPI.extractHotelRooms(url);
    if (data.error) throw new Error(data.error);

    const options = (data.rooms || []).map(mapExtractedRoomToOption).filter(r => r.category);
    if (options.length === 0) {
      alert("Keine Zimmerdaten gefunden. Bitte URL prüfen oder Zimmer manuell anlegen.");
      return;
    }

    h.room_source_url = url;
    h.room_options = options;
    h.selected_room_index = 0;
    h.room = {
      type: options[0].category,
      size: options[0].size,
      description: options[0].description,
      features: options[0].features
    };

    renderRoomCategoryManager();
    alert(`✓ ${options.length} Zimmertypen extrahiert.`);
  } catch (e) {
    alert("Zimmerextraktion fehlgeschlagen: " + (e.message || e));
  } finally {
    if (trigger) {
      trigger.disabled = false;
      trigger.textContent = "🔎 Zimmer extrahieren";
    }
  }
}

// ── SAVE & PUBLISH ──
function collectTourData() {
  const d1 = document.getElementById("fDateFrom").value;
  const d2 = document.getElementById("fDateTo").value;
  const travelerType = document.getElementById("fTravelerType")?.value || "family";
  const preferences = getSelectedPrefs();
  const metaPref = `__traveler_type:${travelerType}`;
  const mergedPrefs = [...preferences.filter(p => !String(p).startsWith("__traveler_type:")), metaPref];

  const { traveler_type: _travelerTypeIgnored, ...safeTour } = currentTour || {};

  return {
    ...safeTour,
    customer_name: document.getElementById("fCustomer").value,
    customer_email: document.getElementById("fEmail").value,
    destination: document.getElementById("fDestination").value,
    date_from: d1 || null,
    date_to: d2 || null,
    nights: calcNights(),
    departure_airport: document.getElementById("fAirport").value,
    meal_plan: document.getElementById("fMealPlan").value,
    preferences: mergedPrefs,
    personal_note: document.getElementById("fNote").value,
    hero_video_url: document.getElementById("fHeroVideo").value,
    agent_name: agentProfile.name,
    agent_company: agentProfile.company,
    agent_email: agentProfile.email,
    agent_phone: agentProfile.phone
  };
}

async function saveTour() {
  const data = collectTourData();
  if (!data.customer_name || !data.destination) return alert("Bitte Kunde und Reiseziel ausfüllen.");
  
  try {
    if (currentTour.slug) {
      currentTour = await TravelDiveAPI.updateTour(currentTour.slug, data);
    } else {
      currentTour = await TravelDiveAPI.createTour(data);
    }
    populateEditor();
    loadTours(); // Refresh list
    alert("✓ Tour gespeichert!");
  } catch(e) {
    alert("Fehler beim Speichern: " + e.message);
  }
}

async function publishTour() {
  if (!currentTour.slug) await saveTour();
  if (!currentTour.slug) return;
  
  try {
    currentTour = await TravelDiveAPI.updateTour(currentTour.slug, { status: "live" });
    populateEditor();
    loadTours();
    alert("🚀 Tour ist live!\n\nLink: " + window.location.origin + "/t/" + currentTour.slug);
  } catch(e) {
    alert("Fehler: " + e.message);
  }
}

function openPreview() {
  if (currentTour.slug) window.open("/t/" + currentTour.slug, "_blank");
}

function copyLink() {
  const input = document.getElementById("shareLink");
  input.select();
  navigator.clipboard.writeText(input.value);
  event.target.textContent = "✓ Kopiert";
  setTimeout(() => event.target.textContent = "Kopieren", 1500);
}

// ── ANALYTICS ──
async function loadAnalyticsTourList() {
  const select = document.getElementById("analyticsTourSelect");
  select.innerHTML = '<option value="">Tour auswählen…</option>';
  tours.forEach(t => {
    select.innerHTML += `<option value="${t.tour_id||t.id}">${t.customer_name} – ${t.destination}</option>`;
  });
}

async function loadAnalytics(tourId) {
  if (!tourId) return;
  const container = document.getElementById("analyticsContent");
  container.innerHTML = '<div class="generating active"><div class="gen-spinner"></div>Lade Analytics…</div>';

  try {
    const data = await TravelDiveAPI.getAnalytics(tourId);
    const maxTime = Math.max(...Object.values(data.section_times || {}), 1);
    
    container.innerHTML = `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Eindeutige Besucher</div><div class="stat-value">${data.unique_sessions||0}</div></div>
        <div class="stat-card"><div class="stat-label">Seitenaufrufe</div><div class="stat-value">${data.total_page_views||0}</div></div>
        <div class="stat-card"><div class="stat-label">CTA Klicks</div><div class="stat-value">${data.cta_clicks||0}</div></div>
        <div class="stat-card"><div class="stat-label">Conversion</div><div class="stat-value">${data.conversion_rate||0}%</div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title"><span class="icon">⏱</span> Verweildauer pro Sektion</div></div>
        <div class="card-body">
          ${Object.entries(data.section_times||{}).map(([name, secs]) => `
            <div class="st-item">
              <span style="min-width:120px;">${name}</span>
              <div class="st-bar"><div class="st-bar-fill" style="width:${(secs/maxTime*100).toFixed(0)}%;"></div></div>
              <span style="font-weight:600;min-width:50px;text-align:right;">${secs < 60 ? secs+"s" : Math.floor(secs/60)+"m "+secs%60+"s"}</span>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title"><span class="icon">📊</span> Kundenverhalten</div></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div><strong>Favorisiertes Hotel:</strong><br><span style="font-size:1.1rem;">${Object.entries(data.hotel_views||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]||"–"}</span></div>
            <div><strong>Transfer-Wahl:</strong><br><span style="font-size:1.1rem;">${data.transfer_choice||"Noch nicht gewählt"}</span></div>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--red);">Fehler: ${e.message}</div>`;
  }
}

// ── MODAL ──
let modalCallback = null;
function openModal(title, bodyHtml, onSave) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  modalCallback = onSave;
  document.getElementById("editModal").classList.add("open");
}
function closeModal() {
  document.getElementById("editModal").classList.remove("open");
  modalCallback = null;
}
function saveModalItem() {
  if (modalCallback) modalCallback();
}

// ── HELPERS ──
function calcNights() {
  const d1 = document.getElementById("fDateFrom").value;
  const d2 = document.getElementById("fDateTo").value;
  if (!d1 || !d2) return 7;
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}

function esc(str) {
  return (str||"").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── START ──
document.addEventListener("DOMContentLoaded", init);
