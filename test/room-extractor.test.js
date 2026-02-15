const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractFromJsonLd,
  detectCandidateJsonEndpoints,
  extractFromJsonPayload,
  extractFromHtmlFallback
} = require("../lib/room-extractor");

test("extractFromJsonLd parses HotelRoom schema with amenities", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Hotel",
        "name": "Hotel Demo",
        "containsPlace": [{
          "@type": "HotelRoom",
          "name": "Deluxe Ocean View",
          "description": "Großes Zimmer mit Balkon",
          "bed": "1 King Bed",
          "occupancy": {"@type":"QuantitativeValue","maxValue": 3},
          "amenityFeature": [
            {"@type":"LocationFeatureSpecification", "name":"Wi-Fi"},
            {"@type":"LocationFeatureSpecification", "name":"Air Conditioning"}
          ]
        }]
      }
    </script>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[{"@type":"HotelRoom","name":"Family Suite","bed":"2 Queen Beds","occupancy":4,"amenityFeature":[{"name":"Balcony"}]}]}
    </script>
  `;

  const rooms = extractFromJsonLd(html);
  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].room_name, "Deluxe Ocean View");
  assert.equal(rooms[0].occupancy, 3);
  assert.ok(rooms[0].amenities_normalized.includes("wifi"));
  assert.ok(rooms[0].amenities_normalized.includes("air_conditioning"));
  assert.equal(rooms[1].room_name, "Family Suite");
  assert.ok(rooms[1].amenities_normalized.includes("balcony"));
});

test("detectCandidateJsonEndpoints finds room-related json endpoints", () => {
  const html = `
    <script>window.__DATA__ = { endpoints: ["/api/rooms?hotel=1", "https://example.com/accommodations.json"] }</script>
    <a href="/content/amenities/list.json">Amenities</a>
  `;

  const endpoints = detectCandidateJsonEndpoints(html, "https://hotel.example.com/page");
  assert.ok(endpoints.some(u => u.includes("/api/rooms")));
  assert.ok(endpoints.some(u => u.includes("accommodations.json")));
  assert.ok(endpoints.some(u => u.includes("amenities/list.json")));
});

test("extractRoomsFromJsonPayload parses nested room arrays", () => {
  const payload = {
    data: {
      rooms: [
        {
          roomName: "Junior Suite",
          roomDescription: "Meerblick",
          maxOccupancy: 2,
          bedType: "King Bed",
          amenities: ["WiFi", "Klimaanlage"]
        }
      ]
    }
  };

  const rooms = extractFromJsonPayload(payload);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].room_name, "Junior Suite");
  assert.equal(rooms[0].occupancy, 2);
  assert.ok(rooms[0].amenities_normalized.includes("wifi"));
  assert.ok(rooms[0].amenities_normalized.includes("air_conditioning"));
});

test("extractFromHtmlFallback parses heading + amenities", () => {
  const html = `
    <h3>Deluxe Zimmer</h3>
    <p>Für 2 Personen mit King Bed, WLAN, Klimaanlage und Balkon.</p>
  `;
  const rooms = extractFromHtmlFallback(html);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].room_name, "Deluxe Zimmer");
  assert.equal(rooms[0].occupancy, 2);
  assert.ok(rooms[0].amenities_normalized.includes("wifi"));
  assert.ok(rooms[0].amenities_normalized.includes("air_conditioning"));
  assert.ok(rooms[0].amenities_normalized.includes("balcony"));
});
