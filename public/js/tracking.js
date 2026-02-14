// TravelDive Engagement Tracker
// Tracks section visibility, interactions, and sends data to backend

const Tracker = {
  tourId: null,
  sessionId: null,
  sectionTimes: {},
  activeSections: new Set(),
  interval: null,
  pendingEvents: [],
  flushInterval: null,

  init(tourId) {
    this.tourId = tourId;
    this.sessionId = this.generateSessionId();
    
    // Track page view
    TravelDiveAPI.trackEvent(tourId, "page_view", {}, this.sessionId);

    // Start observing sections
    this.observeSections();
    
    // Tick every second for active sections
    this.interval = setInterval(() => this.tick(), 1000);

    // Flush pending events every 15 seconds
    this.flushInterval = setInterval(() => this.flush(), 15000);

    // Flush on page unload
    window.addEventListener("beforeunload", () => this.flush());

    // Flush when page becomes hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.flush();
    });
  },

  observeSections() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const name = entry.target.dataset.track;
        if (!name) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.2) {
          this.activeSections.add(name);
        } else {
          this.activeSections.delete(name);
        }
      });
    }, { threshold: [0.2, 0.5, 0.8] });

    document.querySelectorAll("[data-track]").forEach(el => observer.observe(el));
  },

  tick() {
    this.activeSections.forEach(name => {
      this.sectionTimes[name] = (this.sectionTimes[name] || 0) + 1;
    });
  },

  // Track specific user actions
  trackHotelSelect(hotelName) {
    this.pendingEvents.push({
      tour_id: this.tourId,
      event_type: "hotel_select",
      data: { hotel_name: hotelName },
      session_id: this.sessionId
    });
  },

  trackTransferSelect(transferName) {
    this.pendingEvents.push({
      tour_id: this.tourId,
      event_type: "transfer_select",
      data: { transfer_name: transferName },
      session_id: this.sessionId
    });
  },

  trackCTAClick() {
    // CTA is important - send immediately
    TravelDiveAPI.trackEvent(
      this.tourId, "cta_click", {}, this.sessionId
    );
  },

  trackDetailTab(tabName) {
    this.pendingEvents.push({
      tour_id: this.tourId,
      event_type: "detail_tab",
      data: { tab: tabName },
      session_id: this.sessionId
    });
  },

  // Send accumulated data to backend
  flush() {
    // Add section time events
    for (const [section, seconds] of Object.entries(this.sectionTimes)) {
      if (seconds > 0) {
        this.pendingEvents.push({
          tour_id: this.tourId,
          event_type: "section_time",
          data: { section, seconds },
          session_id: this.sessionId
        });
      }
    }
    // Reset section times after flushing
    this.sectionTimes = {};

    if (this.pendingEvents.length > 0) {
      const events = [...this.pendingEvents];
      this.pendingEvents = [];
      TravelDiveAPI.trackBatch(events);
    }
  },

  generateSessionId() {
    return "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  destroy() {
    this.flush();
    clearInterval(this.interval);
    clearInterval(this.flushInterval);
  }
};

window.TravelDiveTracker = Tracker;
