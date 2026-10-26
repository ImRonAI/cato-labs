/* Per-site concierge settings injected by scripts/build-studio-concierge.mjs.
   Each site's motion lives in its own module: public/studio-motion/<slug>.js. */

export const SITES = {
  'aether-motors': {
    tone: 'Quiet, exact, confident; no hype.',
    locations: [
      { name: 'Atelier Geneva', lat: 46.2044, lon: 6.1432, tz: 'Europe/Zurich' },
      { name: 'the Yas Marina suite', lat: 24.4672, lon: 54.6031, tz: 'Asia/Dubai' },
      { name: 'Tokyo headquarters', lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
    ],
  },
  aurelle: {
    tone: 'Poised, sensory, alpine; restrained.',
    locations: [{ name: 'the Chamonix atelier', lat: 45.9237, lon: 6.8694, tz: 'Europe/Paris' }],
  },
  'helios-grid': {
    tone: 'Precise, sober, engineering-led.',
    locations: [
      { name: 'Zurich', lat: 47.3769, lon: 8.5417, tz: 'Europe/Zurich' },
      { name: 'Geneva', lat: 46.2044, lon: 6.1432, tz: 'Europe/Zurich' },
    ],
  },
  kuroshio: {
    tone: 'Calm, hospitable, precise.',
    locations: [{ name: 'the counter in Ginza', lat: 35.6717, lon: 139.765, tz: 'Asia/Tokyo' }],
  },
  'maison-verve': {
    tone: 'Quiet, precise, unhurried; no superlatives.',
    locations: [{ name: 'the atelier on Quai des Bergues', lat: 46.2058, lon: 6.1453, tz: 'Europe/Zurich' }],
  },
  monolith: {
    tone: 'Architectural, measured, material.',
    locations: [
      { name: 'the Zurich studio', lat: 47.3717, lon: 8.5446, tz: 'Europe/Zurich' },
      { name: 'the Kyoto atelier', lat: 35.0037, lon: 135.7756, tz: 'Asia/Tokyo' },
    ],
  },
  'nocturne-audio': {
    tone: 'Quiet, precise, confident.',
    locations: [
      { name: 'the Geneva listening room', lat: 46.2022, lon: 6.1468, tz: 'Europe/Zurich' },
      { name: 'the Tokyo listening room in Ginza', lat: 35.6702, lon: 139.7631, tz: 'Asia/Tokyo' },
      { name: 'the London listening room in Mayfair', lat: 51.5096, lon: -0.1477, tz: 'Europe/London' },
      { name: 'the New York listening room in Tribeca', lat: 40.7163, lon: -74.0086, tz: 'America/New_York' },
    ],
  },
  'solstice-bio': {
    tone: 'Scientific, careful, plain-spoken; never overstates.',
    locations: [
      { name: 'the Zurich research hub', lat: 47.3769, lon: 8.5417, tz: 'Europe/Zurich' },
      { name: 'the Boston research hub', lat: 42.3601, lon: -71.0589, tz: 'America/New_York' },
      { name: 'clinical leadership in Geneva', lat: 46.2044, lon: 6.1432, tz: 'Europe/Zurich' },
    ],
  },
  'velour-capital': {
    tone: 'Discreet, measured, institutional; never quotes returns.',
    locations: [
      { name: 'the London office', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
      { name: 'the Zurich office', lat: 47.3769, lon: 8.5417, tz: 'Europe/Zurich' },
    ],
  },
  vespera: {
    tone: 'Sober, factual, patient.',
    locations: [
      { name: 'Colorado Springs', lat: 38.8339, lon: -104.8214, tz: 'America/Denver' },
      { name: 'Geneva', lat: 46.2044, lon: 6.1432, tz: 'Europe/Zurich' },
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
    ],
  },
};
