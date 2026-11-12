#!/usr/bin/env node
/**
 * Art-Directed Editorial Image Set Generator & Verifier for Cato Studio Sites.
 *
 * Covers all 10 flagship studio brands (77 distinct images across all existing
 * HTML image slots, canonical `<slug>-hero.jpg` hero assets, and dedicated
 * editorial/product/architectural compositions).
 *
 * Usage:
 *   node scripts/generate-studio-images.mjs [--overwrite] [--site <slug>]
 *   node scripts/generate-studio-images.mjs --ingest <mapping.json>
 *   node scripts/generate-studio-images.mjs --verify
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'images', 'studio-sites');
const ENV_PATH = path.join(ROOT_DIR, '.env.local');

const JPEG_QUALITY = '82';

export const STUDIO_IMAGE_MANIFEST = [
  // ───────────────────────────────────────────────────────────────────────────
  // 1. AETHER MOTORS (aether-motors) — Geneva bespoke electric grand tourer GT-01
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'aether-motors',
    filename: 'aether-motors-hero.jpg',
    aspectRatio: '16:9',
    description: 'Flagship Geneva pavilion hero of the coachbuilt Aether GT-01 in Liquid Silver Titanium at twilight',
    prompt:
      'Editorial automotive architecture photograph for Aether Motors Geneva: a sculpted low-slung bespoke electric grand tourer coupe in Liquid Silver Titanium poised inside a monumental dark basalt pavilion overlooking misty Swiss alpine twilight, soft overhead gallery lightbox tracing an unbroken specular line across its aerodynamic teardrop canopy, medium-format Hasselblad, zero text, zero badges, zero license plates.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-gt01-hero.jpg',
    aspectRatio: '16:9',
    description: 'Dark-studio three-quarter front profile of the Aether GT-01 in Liquid Silver Titanium',
    prompt:
      'Pure dark-studio three-quarter front profile photograph of the coachbuilt Aether GT-01 electric grand tourer finished in Liquid Silver Titanium on a matte black obsidian stone floor (#0b0b0a), taut aerodynamic bodywork, flush glass canopy, razor-thin horizontal LED light slit, chiaroscuro studio rim light, medium-format commercial photography, zero text, zero logos, zero license plates.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-gt01-chassis.jpg',
    aspectRatio: '16:9',
    description: 'Carbon-titanium monocoque rolling chassis cutaway showing quad axial-flux motors and solid-state pack',
    prompt:
      'Technical dark-studio engineering photograph of a bare carbon-fibre and brushed-titanium hypercar monocoque rolling chassis elevated on precision stands, clearly showing four compact axial-flux electric motors at the wheel hubs, CNC-machined billet aluminum double-wishbone suspension, and a structural T-bone solid-state battery pack down the spine, crisp museum lighting, zero text or labels.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-gt01-aero.jpg',
    aspectRatio: '4:3',
    description: 'GT-01 aerodynamic wind-tunnel testing profile with laminar smoke streamlines (Cd 0.19)',
    prompt:
      'Side-profile automotive engineering photograph of a sculpted liquid-silver electric grand tourer coupe inside a dark aerodynamic wind tunnel, fine luminous white laminar smoke streamlines flowing smoothly over its ultra-low nose, teardrop roofline, and active rear venturi diffuser, dramatic technical chiaroscuro, zero text or overlays.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-motors-1.jpg',
    aspectRatio: '16:9',
    description: 'Bespoke saddle-tan and Beluga Nappa leather cockpit with CNC-milled billet aluminum switchgear',
    prompt:
      'Bespoke luxury grand tourer driver cockpit interior photograph: hand-stitched Beluga black and warm saddle-tan Nappa leather seats, sculptural minimalist steering wheel, and precision knurled CNC-machined anodized billet aluminum rotary controls set into exposed matte carbon weave, moody Geneva atelier lighting, zero text or emblems.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-motors-2.jpg',
    aspectRatio: '16:9',
    description: 'Rear three-quarter studio study of the GT-01 in Exposed Forged Carbon with active air-brake',
    prompt:
      'Low rear three-quarter dark-studio photograph of a bespoke electric grand tourer coupe finished in raw Exposed Forged Carbon weave, deployed active aerodynamic rear air-brake wing, deep carbon venturi diffuser tunnels, and a single razor-thin continuous crimson titanium tail light blade, crisp specular rim lighting, zero text or badges.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-motors-3.jpg',
    aspectRatio: '16:9',
    description: 'GT-01 in Liquid Silver Titanium sweeping across a high Swiss alpine pass at blue-hour dusk',
    prompt:
      'Editorial location photograph of a sculpted liquid-silver bespoke electric grand tourer coupe carving silently along a damp ribbon of asphalt on a high-altitude Swiss alpine pass at blue-hour dusk, sheer granite cliffs and snow-dusted peaks in soft twilight mist, medium-format film grain subtlety, zero text or license plates.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-awwwards-1.jpg',
    aspectRatio: '4:3',
    description: 'Macro coachbuilt detail of brushed magnesium front fender aero louver and crystalline headlamp optic',
    prompt:
      'Extreme macro automotive design study of a coachbuilt grand tourer front fender active aerodynamic gill louver combining brushed magnesium, raw twill carbon fibre, and the razor-sharp edge of a crystalline micro-optic LED headlamp, low-key studio lighting, zero text.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-awwwards-2.jpg',
    aspectRatio: '4:3',
    description: 'Forged center-lock brushed magnesium wheel framing carbon-ceramic rotor and titanium caliper',
    prompt:
      'Architectural studio close-up of a bespoke forged center-lock brushed magnesium hypercar wheel framing a massive cross-drilled carbon-ceramic brake disc and CNC-machined raw titanium brake caliper, dramatic chiaroscuro rim light, zero brand text or logos.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-awwwards-3.jpg',
    aspectRatio: '16:9',
    description: 'Atelier Geneva coachbuilding sanctuary with bare hand-formed titanium GT-01 body shell on surface jig',
    prompt:
      'Inside a quiet Swiss coachbuilding atelier in Geneva: a bare hand-formed brushed-titanium grand tourer coupe body shell resting on a precision cast-iron surface plate beneath linear museum gallery lights, wooden coachbuilder bucks in soft background shadow, zero text.',
  },
  {
    slug: 'aether-motors',
    filename: 'aether-awwwards-4.jpg',
    aspectRatio: '16:9',
    description: 'Overhead plan-view studio silhouette of the GT-01 teardrop canopy in Obsidian Midnight finish',
    prompt:
      'Directly overhead birds-eye dark-studio photograph of a bespoke electric grand tourer coupe in deep Obsidian Midnight finish, symmetrical overhead softbox reflections outlining the tapered teardrop glass canopy and sculpted haunches, minimalist luxury aesthetic, zero text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 2. AURELLE (aurelle) — Haute Parfumerie Alpine, Chamonix-Mont-Blanc
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'aurelle',
    filename: 'aurelle-hero.jpg',
    aspectRatio: '4:3',
    description: 'Coffret Découverte: three minimalist 5ml crystal perfume vials in carved Mont-Blanc slate tray',
    prompt:
      'Editorial luxury still life photography for an alpine fragrance house in Chamonix: three minimalist 5ml clear rectangular glass perfume vials nestled in a carved dark grey Mont-Blanc slate discovery tray beside cold frosted granite and subtle glacial condensation, soft pale morning mist light, muted mineral grey and snow-white palette (#F2F3F1), medium-format Hasselblad 80mm lens, zero text, zero logos, zero typography.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-og.jpg',
    aspectRatio: '16:9',
    description: 'Wide 16:9 OpenGraph composition of three alpine mineral glass flacons on wet Mont-Blanc slate',
    prompt:
      'Wide 16:9 luxury editorial still-life photograph: trio of minimalist unlabelled heavy crystal, frosted ice-blue, and smoked-amber glass perfume flacons arranged on a wet dark slate ledge beaded with glacial meltwater droplets overlooking mist-veiled Chamonix Mont-Blanc granite peaks, pale mineral daylight, zero text or labels.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-sommet.jpg',
    aspectRatio: '3:4',
    description: 'Sommet N°1 (2,042 m): clear mineral crystal 50ml flacon on wet white alpine granite in frost',
    prompt:
      'Vertical 3:4 luxury perfume photography: a heavy architectural clear mineral crystal 50ml perfume flacon with a minimalist brushed silver cylindrical cap standing on wet white Mont-Blanc alpine granite dusted with fine frost crystals against pale morning mountain mist, Hasselblad medium format, zero text or labels on bottle.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-crevasse.jpg',
    aspectRatio: '3:4',
    description: 'Crevasse N°2 (3,100 m): frosted pale ice-blue crystal 50ml flacon on translucent glacier sérac ice',
    prompt:
      'Vertical 3:4 luxury perfume photography: a frosted pale glacial-blue crystal 50ml perfume flacon with a minimalist matte silver cap resting atop sculpted translucent blue-white glacier sérac ice, crisp cold crevasse light refracting through crystal facets, zero text or labels.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-treeline.jpg',
    aspectRatio: '3:4',
    description: 'Treeline N°3 (1,650 m): smoked amber glass 50ml flacon with charred alpine larch wood stopper',
    prompt:
      'Vertical 3:4 luxury perfume photography: a smoked warm amber architectural glass 50ml perfume flacon crowned with a hand-charred dark alpine larch wood cylindrical stopper, resting on damp dark slate beside wild larch needles and raw amber resin droplets in misty alpine forest light, zero text or labels.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-1.jpg',
    aspectRatio: '4:3',
    description: 'Cryo-enfleurage vacuum cold-extraction glass apparatus frosted at −24°C in Chamonix lab',
    prompt:
      'Cryo-enfleurage cold vacuum extraction apparatus inside a minimalist Chamonix perfume laboratory: frosted borosilicate glass vacuum chambers coated in delicate -24°C white rime ice enclosing preserved white alpine edelweiss blossoms, brushed stainless steel fittings, pale clinical alpine daylight, zero text.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-2.jpg',
    aspectRatio: '4:3',
    description: 'Harvested high-altitude edelweiss, génépi sprigs, and larch cones on chilled stainless lab tray',
    prompt:
      'Botanical fragrance harvest still-life photograph on a chilled brushed steel laboratory tray beaded with fine ice condensation: freshly gathered alpine edelweiss blossoms, green génépi sprigs, wild larch cones, and grey granite lichen in soft northern window light, zero text.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-3.jpg',
    aspectRatio: '16:9',
    description: 'Mont-Blanc massif and Aiguille du Midi granite spires emerging from pale morning mist above glacier',
    prompt:
      'Fine-art medium-format alpine landscape photograph of the Mont-Blanc massif and jagged Aiguille du Midi granite spires emerging from pale silver morning mist above a fractured blue-white glacier crevasse, quiet monochrome-leaning mineral palette, zero text.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-4.jpg',
    aspectRatio: '16:9',
    description: 'Chamonix private salon interior with raw Mont-Blanc granite tasting counter and crystal flacons',
    prompt:
      'Minimalist luxury fragrance atelier interior in Chamonix: monolithic raw Mont-Blanc granite consultation table, pale mineral lime-plaster walls, blank cold-pressed paper scent blotters, and three unlabelled crystal perfume flacons in quiet northern alpine window light, zero text.',
  },
  {
    slug: 'aurelle',
    filename: 'aurelle-5.jpg',
    aspectRatio: '4:3',
    description: 'Cold-tempered brushed stainless maceration vessels resting in a quiet stone cellar in Chamonix',
    prompt:
      'Quiet subterranean stone maturation cellar beneath Chamonix: row of small cold-tempered brushed stainless steel perfume maceration vessels resting on rough granite plinths in cool dim atmospheric light with subtle condensation, zero text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 3. HELIOS GRID (helios-grid) — Zurich & Geneva compact high-field tokamak fusion
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'helios-grid',
    filename: 'helios-grid-hero.jpg',
    aspectRatio: '16:9',
    description: 'Flagship Zurich assembly hall view of the compact HG-400 tokamak cryostat and ReBCO magnet array',
    prompt:
      'Architectural industrial engineering photograph inside a sunlit Swiss modernist concrete-and-glass fusion assembly hall in Zurich: a compact tokamak fusion core surrounded by gleaming D-shaped copper-and-stainless-steel superconducting toroidal field coils arranged radially around a precision cryostat, sober natural daylight (#f3f1ec palette), zero text or logos.',
  },
  {
    slug: 'helios-grid',
    filename: 'helios-tokamak.jpg',
    aspectRatio: '16:9',
    description: 'HG-400 D-shaped ReBCO superconducting toroidal field coil assembly in Zurich engineering hall',
    prompt:
      'Close architectural three-quarter photograph of a massive D-shaped ReBCO high-temperature superconducting toroidal field magnet coil mounted in a precision CNC-machined stainless steel structural casing with copper current leads inside a bright Swiss engineering facility in Zurich, zero text or labels.',
  },
  {
    slug: 'helios-grid',
    filename: 'helios-control-room.jpg',
    aspectRatio: '16:9',
    description: 'Helios Grid Zurich prototype tokamak diagnostics and magnet telemetry control room',
    prompt:
      'Sober Swiss fusion diagnostics and magnet telemetry control room in Zurich: warm pale architectural concrete walls, long brushed-aluminum operator console, and frameless glass displays showing clean abstract geometric magnetic flux equilibrium contours in warm copper-amber and charcoal, zero legible text or UI words.',
  },
  {
    slug: 'helios-grid',
    filename: 'helios-grid-1.jpg',
    aspectRatio: '4:3',
    description: 'Macro of copper-clad ReBCO high-temperature superconducting tape winding in Geneva cleanroom',
    prompt:
      'Extreme macro industrial precision photograph of luminous metallic copper-clad ReBCO superconducting tape being wound onto a brushed stainless steel D-shaped magnet bobbin under crisp Geneva cleanroom optical lighting, shallow depth of field, zero text.',
  },
  {
    slug: 'helios-grid',
    filename: 'helios-grid-2.jpg',
    aspectRatio: '4:3',
    description: 'Tessellated brushed tungsten divertor armor tiles inside the HG-400 toroidal vacuum chamber',
    prompt:
      'Interior architectural engineering view inside a compact toroidal tokamak fusion vacuum vessel showing precision tessellated brushed tungsten divertor armor tiles and polished Inconel first-wall geometry curving away in crisp directional rim lighting, zero text.',
  },
  {
    slug: 'helios-grid',
    filename: 'helios-grid-3.jpg',
    aspectRatio: '16:9',
    description: 'Minimalist Swiss alpine valley 400 MWe grid-interconnection substation at twilight',
    prompt:
      'Architectural twilight photograph of a clean Swiss alpine valley 400 MWe electrical grid interconnection substation: minimalist board-formed concrete baseload power hall and sculptural high-voltage ceramic insulators framed against snow-dusted Swiss mountains under a calm dusk sky, zero text or signage.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 4. KUROSHIO (kuroshio) — Twelve-seat Ginza Edomae omakase counter
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'kuroshio',
    filename: 'kuroshio-hero.jpg',
    aspectRatio: '16:9',
    description: 'Wide chiaroscuro architectural view of the twelve-seat Kiso hinoki counter and yakisugi cedar room in Ginza',
    prompt:
      'Serene wide architectural photograph of an intimate twelve-seat Edomae sushi omakase room in Ginza before service: a single monumental 200-year-old pale Kiso hinoki cypress slab counter framed by matte black charred yakisugi cedar walls and traditional timber joinery, warm museum-quiet chiaroscuro lighting, zero text or signage.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-counter.jpg',
    aspectRatio: '16:9',
    description: 'Warm directional light grazing the 200-year-old Kiso valley hinoki cypress counter at Kuroshio',
    prompt:
      'Poetic low-angle detail photograph of warm directional light grazing the silky unstained grain of an ancient 200-year-old Kiso valley hinoki cypress sushi counter against dark charred cedar shadow, a folded white linen oshibori and dark stoneware dish resting quietly, zero text.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-1.jpg',
    aspectRatio: '4:3',
    description: 'Master Edomae shokunin slicing marbled Oma bluefin otoro with a mirror-polished yanagiba blade',
    prompt:
      'Intimate chiaroscuro close-up photograph of a Japanese master sushi chef hands drawing a mirror-polished steel honyaki yanagiba knife cleanly through finely marbled pink Oma bluefin otoro tuna on a thick pale hinoki wood board, quiet precision, zero text.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-2.jpg',
    aspectRatio: '4:3',
    description: '01 · Shijimi dashi first course in matte black Echizen lacquerware bowl with faint steam',
    prompt:
      'Fine-dining Edomae omakase first course still life: a minimalist matte black Japanese lacquerware bowl holding luminous clear amber shijimi freshwater clam dashi broth with a delicate wisp of steam rising in dark chiaroscuro light on a pale hinoki counter, zero text.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-3.jpg',
    aspectRatio: '4:3',
    description: '04 · Oma bluefin akami zuke nigiri glazed with aged soy over warm red-vinegar shari',
    prompt:
      'Macro culinary portrait of a single piece of Edomae Oma bluefin akami zuke nigiri: deep ruby soy-marinated lean tuna glistening with a brush of nikiri glaze atop warm akazu red-vinegar seasoned Koshihikari rice grains, resting directly on unfinished pale hinoki cypress wood, chiaroscuro pin-spot light, zero text.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-uni.jpg',
    aspectRatio: '4:3',
    description: '09 · Hokkaido Rishiri bafun uni mounded over warm akazu rice on hand-thrown Bizen stoneware',
    prompt:
      'Macro Edomae omakase photograph of Hokkaido Rishiri bafun uni: plump velvety tongues of vivid deep-orange sea urchin generously draped over warm red-vinegar sushi rice on an earthy hand-thrown Bizen stoneware plate in warm chiaroscuro spotlight, zero text.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-5.jpg',
    aspectRatio: '4:3',
    description: '14 · Wakasa Bay nodoguro nigiri seared over white binchotan charcoal with sudachi zest',
    prompt:
      'Macro culinary photograph of Wakasa Bay nodoguro (blackthroat seaperch) nigiri lightly seared over white binchotan charcoal: pearlescent rich flesh and blistered golden skin glistening with natural fat and a tiny fleck of green sudachi zest on dark handmade ceramic ware, zero text.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-4.jpg',
    aspectRatio: '3:4',
    description: 'Quiet Ginza backstreet entrance at dusk with unbleached indigo linen noren and cedar lattice',
    prompt:
      'Vertical 3:4 architectural photograph of a discreet Ginza side-street omakase entrance at twilight: plain unbleached indigo-dyed linen noren curtain (pure woven fabric, zero kanji or text) hanging in a handcrafted cedar joinery doorway above wet granite threshold stones lit by a low warm stone lantern.',
  },
  {
    slug: 'kuroshio',
    filename: 'kuroshio-6.jpg',
    aspectRatio: '4:3',
    description: 'Glowing Kishu white binchotan charcoal embers in hammered copper konro beside iron tetsubin kettle',
    prompt:
      'Atmospheric Japanese hearth detail: incandescent white Kishu binchotan oak charcoal logs glowing softly with warm orange embers inside a hand-hammered copper konro brazier beside a textured cast-iron tetsubin kettle in quiet shadow, zero text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 5. MAISON VERVE (maison-verve) — Geneva independent haute horlogerie
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'maison-verve',
    filename: 'maison-verve-hero.jpg',
    aspectRatio: '16:9',
    description: 'Watchmaker oiled walnut workbench on Quai des Bergues in calm northern Geneva window light',
    prompt:
      'Editorial horological photograph inside an independent watchmaking atelier on Quai des Bergues in Geneva: an oiled walnut watchmaker workbench bathed in calm northern window light, brass jeweler loupes, gentian-wood polishing sticks, fine tweezers, and an intricate uncased twin-barrel mechanical tourbillon movement under a crystal bell jar, zero text or brand logos.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-1.jpg',
    aspectRatio: '4:3',
    description: 'Anglage macro: hand-bevelled 45° inward bridge angle on Calibre MV-09 catching a ribbon of light',
    prompt:
      'Extreme horological macro photograph of hand-finished anglage on a Swiss mechanical watch movement: two rhodium-plated German-silver bridges meeting at a sharp hand-filed inward angle, the mirror-polished 45-degree bevel catching a single crisp line of light beside ruby jewels in gold chatons, zero text.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-2.jpg',
    aspectRatio: '4:3',
    description: 'Côtes de Genève macro: parallel Geneva stripes across movement bridges with gold chatons',
    prompt:
      'Extreme horological macro photograph of Côtes de Genève finishing: silky parallel Geneva wave stripes flowing across mechanical watch movement bridges, accented by mirror-chamfered edges, flame-blued steel screws, and crimson rubies set in polished gold chatons, zero text or engravings.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-3.jpg',
    aspectRatio: '4:3',
    description: 'Perlage macro: overlapping hand-stamped circular graining across raw maillechort mainplate',
    prompt:
      'Extreme horological macro photograph of perlage circular graining: overlapping rows of hand-stamped luminous micro-circles across a German-silver watch mainplate, framed by gilded brass gear train wheels and polished steel pinions, studio macro lighting, zero text.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-4.jpg',
    aspectRatio: '4:3',
    description: 'Poli noir macro: black-polished steel tourbillon bridge and blued screws over balance wheel',
    prompt:
      'Extreme horological macro photograph of poli noir black-polished steel: a flat mirror-lapped steel tourbillon bridge reflecting dramatic pitch-black and silver contrast above a free-sprung balance wheel, Breguet overcoil hairspring, and chamfered flame-blued screws, zero text.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-5.jpg',
    aspectRatio: '1:1',
    description: 'MV-01 Tourbillon Souverain: Platinum 950 dress watch with white Grand Feu enamel dial and flying tourbillon',
    prompt:
      'Square 1:1 luxury haute horlogerie studio portrait of a 41.5mm Platinum 950 dress watch resting on dark grey Geneva slate: pure white fired Grand Feu enamel dial with clean minimalist baton hour markers, slender heat-blued steel hands, and an open flying tourbillon cage at 6 o clock, black alligator strap, zero dial text or brand name.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-6.jpg',
    aspectRatio: '1:1',
    description: 'MV-02 Quantième Perpétuel: 18k rose gold perpetual calendar with white gold moon on aventurine',
    prompt:
      'Square 1:1 luxury haute horlogerie studio portrait of a 40mm 18k rose gold perpetual calendar wristwatch on dark velvet-slate: warm silvered opaline dial with clean recessed sub-dials (hash marks only, zero text) and a hand-engraved white gold moon disc set against deep starry blue aventurine glass at 6 o clock, brown hand-stitched leather strap, zero brand text.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-7.jpg',
    aspectRatio: '1:1',
    description: 'MV-03 Chronographe Monopoussoir: Grade 5 titanium single-pusher chronograph with anthracite dial',
    prompt:
      'Square 1:1 luxury haute horlogerie studio portrait of a 42mm brushed-and-bevelled Grade 5 titanium single-pusher chronograph watch resting on dark basalt stone: matte anthracite grey two-register dial (clean index ticks only, zero text), polished steel hands, and a coaxial monopusher integrated into the crown, zero brand wordmarks.',
  },
  {
    slug: 'maison-verve',
    filename: 'maison-verve-8.jpg',
    aspectRatio: '16:9',
    description: 'Private Geneva horological salon on Quai des Bergues with slate presentation tray and brass loupe',
    prompt:
      'Quiet private horological client salon on Quai des Bergues in Geneva: dark oak panelling, tall window admitting soft overcast Lake Geneva daylight, and a honed grey slate presentation tray holding white chamois leather gloves, a brass watchmaker loupe, and a platinum mechanical timepiece, zero text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 6. MONOLITH (monolith) — Brutalist Zurich & Kyoto architectural practice
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'monolith',
    filename: 'monolith-hero.jpg',
    aspectRatio: '16:9',
    description: 'Brutalist courtyard pavilion uniting board-formed concrete, honed travertine, and still reflecting pool',
    prompt:
      'Museum-grade architectural photograph in the spirit of Peter Zumthor and Tadao Ando: a serene brutalist courtyard pavilion uniting monumental board-formed concrete walls, a honed pale Roman travertine plinth, dark charred cedar screens, and a mirror-still shallow reflecting pool under soft morning sky (#F4F1EA palette), zero text or people.',
  },
  {
    slug: 'monolith',
    filename: 'monolith-1.jpg',
    aspectRatio: '16:9',
    description: 'Monolithic board-formed concrete gallery lightwell with roof oculus beam over dark water basin',
    prompt:
      'Interior architectural photograph of a monolithic brutalist gallery lightwell: soaring 420mm rough board-formed concrete walls pierced by a sharp geometric ceiling oculus casting a diagonal shaft of natural daylight onto a tranquil dark indoor water basin, contemplative silence, zero text.',
  },
  {
    slug: 'monolith',
    filename: 'monolith-2.jpg',
    aspectRatio: '16:9',
    description: 'Work 01 · The Beton Monolith, Zurich: cantilevered Douglas fir board-formed concrete residence',
    prompt:
      'Close architectural elevation photograph of The Beton Monolith in Zurich: a bold three-story cantilevered brutalist private residence overlooking the Limmat valley, thick blast-furnace slag concrete walls richly imprinted with horizontal rough-sawn Douglas fir plank grain and deep shadow-carved window apertures, crisp daylight, zero text.',
  },
  {
    slug: 'monolith',
    filename: 'monolith-3.jpg',
    aspectRatio: '16:9',
    description: 'Work 02 · Kyoto Ravine Sanctuary: cedar-imprinted concrete bridge sanctuary over mossy Kyoto gorge',
    prompt:
      'Architectural photograph of Kyoto Ravine Sanctuary: a contemplative post-tensioned concrete sanctuary bridging a lush mossy forested mountain gorge above a clear stream in Kyoto morning mist, vertical Japanese Sugi cedar timber grain imprinted into silky grey concrete walls, serene natural light, zero text.',
  },
  {
    slug: 'monolith',
    filename: 'monolith-4.jpg',
    aspectRatio: '16:9',
    description: 'Work 03 · Alingard Alpine Archive, St. Moritz: oiled-steel-formed concrete vault in snowy Engadin slope',
    prompt:
      'Architectural photograph of an alpine preservation archive excavated deep into a snowy 2,100-meter St. Moritz Engadin mountain slope: ultra-smooth dark oiled-steel-formed concrete retaining walls slicing cleanly into pristine white winter snow under pale high-altitude alpine sky, zero text or signage.',
  },
  {
    slug: 'monolith',
    filename: 'monolith-5.jpg',
    aspectRatio: '4:3',
    description: 'Zurich studio material taxonomy table with milled brass architectural model and concrete core samples',
    prompt:
      'Editorial still life inside a Zurich architectural studio: a precision-milled solid brass and basswood architectural scale model resting on a pale limestone table beside cylindrical raw concrete aggregate core specimens, charred cedar timber blocks, and unlabelled linen structural portfolios in soft northern daylight, zero text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 7. NOCTURNE AUDIO (nocturne-audio) — Geneva reference acoustic instruments
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'nocturne-audio',
    filename: 'nocturne-audio-hero.jpg',
    aspectRatio: '16:9',
    description: 'Low-key Geneva studio pairing of the glowing Mono-A billet triode amplifier and N-1 planar headphones',
    prompt:
      'Atmospheric low-key luxury audio studio photograph (#070708 dark ground): a monolithic CNC-milled matte black anodized billet aluminum Class-A vacuum-tube amplifier with glowing amber glass 6SN7GT triodes paired beside bespoke open-back planar magnetic reference headphones on a honed black basalt plinth, medium-format chiaroscuro, zero text or brand engravings.',
  },
  {
    slug: 'nocturne-audio',
    filename: 'nocturne-audio-1.jpg',
    aspectRatio: '4:3',
    description: 'Nocturne N-1 Planar: CNC-milled black anodized open-back planar magnetic reference headphones',
    prompt:
      'Studio product portrait of bespoke open-back planar magnetic reference headphones CNC-milled from matte black anodized billet aluminum, precision micro-slotted open acoustic grille subtly revealing shimmering gold-and-silver planar diaphragm traces, supple black lambskin earpads resting on dark slate, zero text or logos.',
  },
  {
    slug: 'nocturne-audio',
    filename: 'nocturne-audio-2.jpg',
    aspectRatio: '4:3',
    description: 'Nocturne Mono-A Reference: CNC-milled billet pure Class-A triode monoblock amplifier glowing warmly',
    prompt:
      'Studio product portrait of a heavy pure Class-A triode reference amplifier carved from solid bead-blasted black anodized aluminum billet, featuring a matched pair of tall glass 6SN7GT vacuum tubes radiating a soft warm amber filament glow (#d9c3a0) in a dark studio, zero text or faceplate lettering.',
  },
  {
    slug: 'nocturne-audio',
    filename: 'nocturne-audio-3.jpg',
    aspectRatio: '16:9',
    description: 'Acoustically isolated Geneva listening room with sculpted walnut diffusers and reference speakers',
    prompt:
      'Architectural interior photograph of an acoustically isolated private listening sanctuary in Geneva: floor-to-ceiling sculpted vertical solid American walnut acoustic timber diffusers, a pair of monolithic matte-black reference electrostatic and horn loudspeakers, and a single low linen-and-leather lounge chair in warm pools of intimate light, zero text.',
  },
  {
    slug: 'nocturne-audio',
    filename: 'nocturne-audio-4.jpg',
    aspectRatio: '4:3',
    description: 'Macro of CNC-machined titanium tonearm and diamond stylus tracking a heavy black vinyl platter',
    prompt:
      'Extreme macro electro-acoustic photograph of a precision CNC-machined matte titanium turntable tonearm and bare diamond stylus riding the silky black micro-grooves of a heavy 180-gram vinyl platter, illuminated by warm golden-amber rim light against deep shadow, zero text.',
  },
  {
    slug: 'nocturne-audio',
    filename: 'nocturne-audio-5.jpg',
    aspectRatio: '16:9',
    description: 'Geneva acoustic measurement bench showing point-to-point silver-wired chassis and matched triodes',
    prompt:
      'Overhead three-quarter photograph of a Swiss electro-acoustic bench in Geneva: precision point-to-point silver-wired internal amplifier circuitry, machined aluminum shielding chambers, and glowing matched vacuum tubes beside sleek dark laboratory audio analyzer probes, zero legible text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 8. SOLSTICE BIO (solstice-bio) — Swiss-Boston cellular reprogramming biotech
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'solstice-bio',
    filename: 'solstice-bio-hero.jpg',
    aspectRatio: '16:9',
    description: 'Sunlit Swiss modernist biotechnology research atrium in Zurich in warm alabaster daylight',
    prompt:
      'Architectural photograph of a sunlit Swiss modernist biotechnology research hub atrium in Zurich: warm honed pale limestone columns (#f3efe7 alabaster tone), frameless glass laboratory enclosures, brushed stainless bioreactors, and serene natural morning daylight, calm institutional restraint, zero text or signage.',
  },
  {
    slug: 'solstice-bio',
    filename: 'solstice-bio-1.jpg',
    aspectRatio: '4:5',
    description: 'Zurich Epigenetic Hub: borosilicate optical visualization of single-cell chromatin methylation',
    prompt:
      'Vertical 4:5 fine-art scientific optical macro photograph looking through layered borosilicate glass lenses at luminous translucent single-cell chromatin and epigenetic methylation structures glowing softly in warm ivory and pale gold against a calm stone-grey background, natural laboratory aesthetic, zero text.',
  },
  {
    slug: 'solstice-bio',
    filename: 'solstice-bio-2.jpg',
    aspectRatio: '4:5',
    description: 'Boston Alabaster Shell Lab: quartz microfluidic lipid-nanoparticle chip in warm optical light',
    prompt:
      'Vertical 4:5 macro scientific photograph of an etched transparent quartz microfluidic lipid-nanoparticle formulation chip on a precision microscope stage, delicate opalescent pearl-like micro-droplets converging through hair-thin glass channels in clean warm-white illumination, zero text.',
  },
  {
    slug: 'solstice-bio',
    filename: 'solstice-bio-3.jpg',
    aspectRatio: '4:5',
    description: 'Geneva Translational Lab: precision multi-channel glass pipette tips above quartz biomarker plate',
    prompt:
      'Vertical 4:5 macro laboratory photograph of precision glass multi-channel pipette tips poised millimetres above a crystal-clear quartz 384-well clinical biomarker assay plate, tiny translucent droplets catching soft warm directional daylight against an alabaster lab backdrop, zero text.',
  },
  {
    slug: 'solstice-bio',
    filename: 'solstice-bio-4.jpg',
    aspectRatio: '16:9',
    description: 'Cryo-electron microscopy structural biology suite in Zurich with brushed steel column and dewar mist',
    prompt:
      'Clean architectural photograph of a structural biology cryo-electron microscopy (cryo-EM) suite in Zurich: sculptural brushed stainless steel microscope column and faint wisps of white liquid-nitrogen vapor inside a serene warm-toned Swiss cleanroom, zero text or brand logos.',
  },
  {
    slug: 'solstice-bio',
    filename: 'solstice-bio-5.jpg',
    aspectRatio: '4:3',
    description: 'Stereomicroscope darkfield study of living cellular organoid spheres in glass perfusion chamber',
    prompt:
      'Optical stereomicroscope macro study of living translucent cellular organoid spheres suspended inside a precision borosilicate glass microfluidic perfusion chamber, softly lit by warm ivory and pale amber darkfield light, zero text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 9. VELOUR CAPITAL (velour-capital) — London & Zurich private credit & wealth
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'velour-capital',
    filename: 'velour-capital-hero.jpg',
    aspectRatio: '16:9',
    description: 'Discreet Mayfair Georgian townhouse partner library in London with walnut bookcases and limestone sash windows',
    prompt:
      'Editorial architectural interior photograph of a discreet private investment office library inside a Georgian townhouse in Mayfair London at dusk: tall Portland limestone sash windows, floor-to-ceiling dark oiled walnut bookcases filled with unlabelled cloth-bound volumes, warm aged-brass desk lamp glow (#161412 palette), and a quiet leather-inlaid table, zero text.',
  },
  {
    slug: 'velour-capital',
    filename: 'velour-capital-1.jpg',
    aspectRatio: '16:9',
    description: 'Zurich lakefront modernist investment committee boardroom in honed travertine and smoked oak',
    prompt:
      'Architectural interior photograph of a quiet Zurich investment committee boardroom overlooking misty Lake Zurich at dawn: a monumental honed Roman travertine and smoked-oak table, tailored dark charcoal wool chairs, dark bronze window mullions, understated Swiss institutional calm, zero text.',
  },
  {
    slug: 'velour-capital',
    filename: 'velour-capital-2.jpg',
    aspectRatio: '4:3',
    description: 'Archival cotton-rag partner letter folios, ebonite fountain pen, and brass paperweight on walnut desk',
    prompt:
      'Chiaroscuro editorial still life on an oiled dark American walnut partner desk: blank cream cotton-rag archival folios tied with linen ribbon, a classic black ebonite-and-gold fountain pen, and a solid brushed-brass rectangular paperweight in soft directional afternoon window light, zero printed words or text.',
  },
  {
    slug: 'velour-capital',
    filename: 'velour-capital-3.jpg',
    aspectRatio: '4:3',
    description: 'Unbranded Mayfair Portland limestone Georgian townhouse entrance in London twilight after rain',
    prompt:
      'Quiet architectural exterior photograph of an unbranded Georgian Portland limestone townhouse in Mayfair London on a misty evening after rain: wet stone steps leading to a glossy black-lacquered panelled oak door with a single understated polished brass knocker, warm interior glow through upper sash window, zero street numbers or signage.',
  },
  {
    slug: 'velour-capital',
    filename: 'velour-capital-4.jpg',
    aspectRatio: '16:9',
    description: 'Zurich quantitative risk sanctuary after hours with minimal monochrome yield-curve glass displays',
    prompt:
      'Moody architectural photograph of a quantitative risk room in Zurich after hours: dark walnut-slatted acoustic walls and a minimalist desk where frameless smoked-glass monitors display abstract ultra-fine geometric hairlines of sovereign yield curves and volatility bands in warm bone-white and muted brass, zero legible text or numbers.',
  },
  {
    slug: 'velour-capital',
    filename: 'velour-capital-5.jpg',
    aspectRatio: '4:3',
    description: 'Private Mayfair client reading room with carved limestone hearth and cloth-bound regulatory ledgers',
    prompt:
      'Editorial interior vignette of a private family-office consultation room in London: carved pale limestone fireplace mantel, two tailored dark wool armchairs, and a low bronze side table holding unlabelled archival leather-and-linen bound ledgers in calm northern daylight, zero text.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 10. VESPERA (vespera) — Sovereign stratospheric & suborbital aerospace
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'vespera',
    filename: 'vespera-hero.jpg',
    aspectRatio: '16:9',
    description: 'Upper-stratospheric Earth limb at 25 km with cobalt-amber dawn horizon and solar stratollite silhouette',
    prompt:
      'High-altitude aerospace photograph taken from 25 kilometres in the upper stratosphere: the gently curved limb of Earth glowing with a razor-thin cobalt-blue and warm golden-amber dawn atmospheric band beneath pitch-black space (#0a0b10), with a slender autonomous solar-electric flying-wing stratollite holding station in crisp silhouette, zero text.',
  },
  {
    slug: 'vespera',
    filename: 'vespera-sentinel.jpg',
    aspectRatio: '16:9',
    description: 'V-9 Sentinel: low-observable faceted carbon-composite autonomous stratollite at 20.7 km altitude',
    prompt:
      'Sober aerospace air-to-air photograph of the V-9 Sentinel: a sleek low-observable faceted matte-black carbon-composite autonomous stratospheric observation aircraft gliding silently at 20.7 km altitude above a distant silver cloud deck against the deep midnight-indigo stratosphere, zero tail numbers or markings.',
  },
  {
    slug: 'vespera',
    filename: 'vespera-helios-wing.jpg',
    aspectRatio: '16:9',
    description: 'V-14 Helios Wing: 52-metre high-aspect-ratio solar-electric stratospheric wing above cloud sea',
    prompt:
      'High-altitude aerospace photograph of a 52-metre ultra-slender high-aspect-ratio solar-electric flying wing pseudo-satellite banking gently at 23.2 km above an unbroken silver-white troposphere cloud deck, dark photovoltaic solar cells across the upper wing glinting in crisp stratospheric sunlight beneath a dark indigo sky, zero markings.',
  },
  {
    slug: 'vespera',
    filename: 'vespera-4.jpg',
    aspectRatio: '16:9',
    description: 'V-22 Apex: uncrewed Mach-6 hypersonic wedge-body suborbital vehicle in stratospheric twilight transit',
    prompt:
      'Dramatic high-altitude aerospace photograph of an uncrewed Mach-6 hypersonic sharp wedge-body suborbital vehicle streaking horizontally through the upper stratosphere at twilight, brushed Grade-5 titanium leading edges catching warm amber horizon light with subtle aerodynamic shock-wave condensation, zero markings or text.',
  },
  {
    slug: 'vespera',
    filename: 'vespera-1.jpg',
    aspectRatio: '4:3',
    description: 'Brushed Grade-5 titanium spacecraft & stratollite avionics bus in ISO-5 aerospace cleanroom',
    prompt:
      'Aerospace engineering photograph of a sovereign spacecraft and stratollite avionics bus fabricated from CNC-milled brushed Grade-5 titanium, carbon-composite struts, and gold multi-layer thermal insulation blankets mounted on a precision rotary fixture inside a dark-accented ISO-5 cleanroom, crisp linear lighting, zero text.',
  },
  {
    slug: 'vespera',
    filename: 'vespera-2.jpg',
    aspectRatio: '16:9',
    description: 'Colorado Springs stratospheric station-keeping & telemetry operations floor',
    prompt:
      'Sober architectural photograph of an autonomous stratospheric flight operations and telemetry control room in Colorado Springs: dark minimalist consoles and wide wall displays showing abstract geometric stratospheric wind-band vectors and optical relay arcs in muted amber (#d9a066) and bone-white, zero legible text or UI labels.',
  },
  {
    slug: 'vespera',
    filename: 'vespera-3.jpg',
    aspectRatio: '4:3',
    description: 'Vacuum propulsion test fire of brushed Inconel thruster bell with violet-amber Mach diamonds',
    prompt:
      'Aerospace propulsion vacuum test-cell photograph: close-up of a brushed Inconel attitude-control thruster bell hot-firing in darkness, projecting a razor-sharp translucent supersonic exhaust plume with luminous violet-and-amber Mach diamonds, crisp industrial photography, zero text.',
  },
  {
    slug: 'vespera',
    filename: 'vespera-5.jpg',
    aspectRatio: '4:3',
    description: 'Optical inter-platform laser communications terminal gimbal with gold-coated beryllium mirror in Geneva',
    prompt:
      'Macro aerospace cleanroom photograph in Geneva of an optical inter-platform laser communications terminal: a mirror-polished gold-coated beryllium steering mirror housed inside a precision CNC-machined titanium and matte-black anodized aluminum gimbal assembly, zero text.',
  },
];

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const raw = fs.readFileSync(envFilePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

function convertToJpeg(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  execFileSync('sips', [
    '-s',
    'format',
    'jpeg',
    '-s',
    'formatOptions',
    JPEG_QUALITY,
    sourcePath,
    '--out',
    targetPath,
  ], { stdio: 'pipe' });
}

function inspectImage(filePath) {
  const buf = fs.readFileSync(filePath);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const sipsOut = execFileSync(
    'sips',
    ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'format', filePath],
    { encoding: 'utf8' }
  );
  const width = Number(sipsOut.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
  const height = Number(sipsOut.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
  const format = sipsOut.match(/format:\s*(\S+)/)?.[1] || 'unknown';
  return {
    bytes: buf.length,
    sha256,
    width,
    height,
    format,
  };
}

async function generateWithGenAI({ overwrite = false, siteFilter = null } = {}) {
  loadEnvFile(ENV_PATH);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment or .env.local');
  }

  const model = process.env.STUDIO_IMAGE_MODEL || 'gemini-3-pro-image';
  const ai = new GoogleGenAI({ apiKey });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const entries = siteFilter
    ? STUDIO_IMAGE_MANIFEST.filter((item) => item.slug === siteFilter)
    : STUDIO_IMAGE_MANIFEST;

  for (const entry of entries) {
    const outPath = path.join(OUTPUT_DIR, entry.filename);
    if (!overwrite && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      console.log(`[skip] ${entry.filename} already exists`);
      continue;
    }

    console.log(`[gen]  ${entry.filename} (${entry.slug}, ${entry.aspectRatio}) via ${model}...`);
    const response = await ai.models.generateContent({
      model,
      contents: entry.prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: entry.aspectRatio,
          imageSize: '2K',
        },
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data
    );
    if (!imagePart?.inlineData?.data) {
      throw new Error(`No image inlineData returned for ${entry.filename}`);
    }

    const rawBytes = Buffer.from(imagePart.inlineData.data, 'base64');
    fs.writeFileSync(outPath, rawBytes);
    convertToJpeg(outPath, outPath);

    const meta = inspectImage(outPath);
    console.log(
      `[done] ${entry.filename} -> ${meta.width}x${meta.height} ${meta.format} (${(meta.bytes / 1024).toFixed(1)} KB)`
    );
  }
}

function ingestFromMap(mapFilePath) {
  const mapping = JSON.parse(fs.readFileSync(mapFilePath, 'utf8'));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const [filename, sourcePath] of Object.entries(mapping)) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing staged source image for ${filename}: ${sourcePath}`);
    }
    const targetPath = path.join(OUTPUT_DIR, filename);
    convertToJpeg(sourcePath, targetPath);
    const meta = inspectImage(targetPath);
    console.log(
      `[ingest] ${filename} -> ${meta.width}x${meta.height} ${meta.format} (${(meta.bytes / 1024).toFixed(1)} KB)`
    );
  }
}

export function verifyStudioImages() {
  const hashOwners = new Map();
  const report = [];
  const errors = [];

  for (const entry of STUDIO_IMAGE_MANIFEST) {
    const filePath = path.join(OUTPUT_DIR, entry.filename);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing manifest file: ${entry.filename}`);
      continue;
    }
    const meta = inspectImage(filePath);
    if (meta.bytes === 0) {
      errors.push(`Empty file: ${entry.filename}`);
    }
    if (meta.format !== 'jpeg') {
      errors.push(`Invalid format for ${entry.filename}: expected jpeg, got ${meta.format}`);
    }
    if (meta.width === 0 || meta.height === 0) {
      errors.push(`Invalid dimensions for ${entry.filename}: ${meta.width}x${meta.height}`);
    }
    if (hashOwners.has(meta.sha256)) {
      errors.push(
        `Duplicate SHA-256 hash between ${entry.filename} and ${hashOwners.get(meta.sha256)}`
      );
    } else {
      hashOwners.set(meta.sha256, entry.filename);
    }

    report.push({
      ...entry,
      ...meta,
    });
  }

  // Also check any stray files in OUTPUT_DIR not in manifest for hash collisions
  if (fs.existsSync(OUTPUT_DIR)) {
    for (const file of fs.readdirSync(OUTPUT_DIR).sort()) {
      if (file.startsWith('.')) continue;
      if (STUDIO_IMAGE_MANIFEST.some((m) => m.filename === file)) continue;
      const meta = inspectImage(path.join(OUTPUT_DIR, file));
      if (hashOwners.has(meta.sha256)) {
        errors.push(`Duplicate SHA-256 hash between extra file ${file} and ${hashOwners.get(meta.sha256)}`);
      } else {
        hashOwners.set(meta.sha256, file);
      }
    }
  }

  const requiredSlugs = [
    'aether-motors',
    'aurelle',
    'helios-grid',
    'kuroshio',
    'maison-verve',
    'monolith',
    'nocturne-audio',
    'solstice-bio',
    'velour-capital',
    'vespera',
  ];
  for (const slug of requiredSlugs) {
    const heroName = `${slug}-hero.jpg`;
    if (!fs.existsSync(path.join(OUTPUT_DIR, heroName))) {
      errors.push(`Missing canonical hero image: ${heroName}`);
    }
  }

  console.log(`\nVerified ${report.length}/${STUDIO_IMAGE_MANIFEST.length} manifest images in ${OUTPUT_DIR}`);
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`  [ERROR] ${err}`);
    }
    throw new Error(`Verification failed with ${errors.length} issue(s)`);
  }
  console.log('  [OK] Zero missing files, zero invalid JPEGs, zero duplicate SHA-256 hashes.\n');
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify');
  const overwrite = args.includes('--overwrite');
  const siteIdx = args.indexOf('--site');
  const siteFilter = siteIdx !== -1 ? args[siteIdx + 1] : null;
  const ingestIdx = args.indexOf('--ingest');
  const ingestMapPath = ingestIdx !== -1 ? args[ingestIdx + 1] : null;

  if (verifyOnly) {
    verifyStudioImages();
    return;
  }

  if (ingestMapPath) {
    ingestFromMap(ingestMapPath);
    verifyStudioImages();
    return;
  }

  await generateWithGenAI({ overwrite, siteFilter });
  verifyStudioImages();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
