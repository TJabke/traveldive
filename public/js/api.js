// TravelDive API Client (VPS Version)
const API = {
  config: null,
  supabase: null,

  async init() {
    if (this.config) return this.config;
    try {
      const res = await fetch("/api/config");
      this.config = await res.json();
      if (window.supabase && this.config.supabaseUrl) {
        this.supabase = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
      }
      return this.config;
    } catch (err) { console.error("Config load failed:", err); return null; }
  },

  // Tours
  async getTours() { return (await fetch("/api/tours")).json(); },
  async getTour(slug) { const r = await fetch(`/api/tours/${slug}`); return r.ok ? r.json() : null; },
  async createTour(data) { return (await fetch("/api/tours", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data) })).json(); },
  async updateTour(slug, data) { return (await fetch(`/api/tours/${slug}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data) })).json(); },
  async deleteTour(slug) { return (await fetch(`/api/tours/${slug}`, { method: "DELETE" })).json(); },

  // AI Generation
  async generateTourContent(params) { return (await fetch("/api/generate", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(params) })).json(); },

  // Google Places
  async searchPlace(query) { const d = await (await fetch(`/api/places/search?query=${encodeURIComponent(query)}`)).json(); return d.results || []; },
  async getPlaceDetails(placeId) { return (await fetch(`/api/places/details?place_id=${placeId}`)).json(); },
  getPlacePhotoUrl(photoRef, maxWidth = 800) { return `/api/places/photo?photo_ref=${photoRef}&maxwidth=${maxWidth}`; },

  // Weather
  async getWeather(lat, lng, month) { return (await fetch(`/api/weather?lat=${lat}&lng=${lng}&month=${month}`)).json(); },

  // Extraction
  async extractHotelRooms(url) { return (await fetch("/api/extract/rooms", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ url }) })).json(); },

  // Tracking
  async trackEvent(tourId, eventType, data = {}, sessionId = null) {
    try { await fetch("/api/tracking", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ tour_id: tourId, event_type: eventType, data, session_id: sessionId }) }); } catch(e) { console.warn("Tracking failed:", e); }
  },
  async trackBatch(events) {
    try { await fetch("/api/tracking/batch", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ events }) }); } catch(e) { console.warn("Batch tracking failed:", e); }
  },
  async getAnalytics(tourId) { return (await fetch(`/api/tracking/${tourId}`)).json(); },

  // Maps
  async loadGoogleMaps() {
    if (window.google?.maps) return;
    const config = await this.init();
    if (!config?.googleMapsKey) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsKey}&libraries=places&language=de`;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  },
  getGoogleMapsEmbedUrl(query, zoom = 14) {
    const k = this.config?.googleMapsKey;
    return k ? `https://www.google.com/maps/embed/v1/place?key=${k}&q=${encodeURIComponent(query)}&zoom=${zoom}&language=de` : "";
  },
  getStreetViewEmbedUrl(lat, lng, heading = 0) {
    const k = this.config?.googleMapsKey;
    return k ? `https://www.google.com/maps/embed/v1/streetview?key=${k}&location=${lat},${lng}&heading=${heading}&fov=90` : "";
  }
};

window.TravelDiveAPI = API;
