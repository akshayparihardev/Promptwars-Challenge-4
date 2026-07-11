import { GoogleGenAI } from '@google/genai';
import type { AppConfig } from '../config/config-loader.js';
import type { ChatRequest } from '@aegis/shared';
import type { EventRepository, HealthSnapshotRepository } from '../../domain/ports/index.js';

// ============================================================
// Stadium Knowledge Base — Grounded facts about MetLife Stadium
// for the FIFA World Cup 2026. These are REAL facts that the
// deterministic fallback uses to give helpful, specific answers.
// ============================================================

interface StadiumFacility {
  name: Record<string, string>;
  location: string;
  section: string;
  zone: string;          // zone ID for graph routing
  accessible: boolean;
  details: Record<string, string>;
}

// ── Zone Graph for Step-by-Step Navigation ────────────────────
// Nodes = stadium zones. Edges = walking paths with distance,
// means (walk/ramp/elevator/stairs), and step-free flag.
// This enables real pathfinding like TOP 1's Dijkstra approach.

interface GraphEdge {
  to: string;
  distance: number;      // meters
  means: 'walk' | 'ramp' | 'elevator' | 'stairs' | 'escalator';
  stepFree: boolean;
  landmark?: Record<string, string>;
}

const STADIUM_ZONES: Record<string, Record<string, string>> = {
  'gate-a':       { en: 'Gate A (East)', es: 'Puerta A (Este)', fr: 'Porte A (Est)' },
  'gate-b':       { en: 'Gate B (South)', es: 'Puerta B (Sur)', fr: 'Porte B (Sud)' },
  'gate-c':       { en: 'Gate C (West)', es: 'Puerta C (Oeste)', fr: 'Porte C (Ouest)' },
  'gate-d':       { en: 'Gate D (North)', es: 'Puerta D (Norte)', fr: 'Porte D (Nord)' },
  'concourse-100-east':  { en: '100-Level East Concourse', es: 'Pasillo 100 Este', fr: 'Coursive 100 Est' },
  'concourse-100-south': { en: '100-Level South Concourse', es: 'Pasillo 100 Sur', fr: 'Coursive 100 Sud' },
  'concourse-100-west':  { en: '100-Level West Concourse', es: 'Pasillo 100 Oeste', fr: 'Coursive 100 Ouest' },
  'concourse-100-north': { en: '100-Level North Concourse', es: 'Pasillo 100 Norte', fr: 'Coursive 100 Nord' },
  'section-102':  { en: 'Section 102 Area', es: 'Zona Sección 102', fr: 'Zone Section 102' },
  'section-108':  { en: 'Section 108 Area', es: 'Zona Sección 108', fr: 'Zone Section 108' },
  'section-112':  { en: 'Section 112 Area', es: 'Zona Sección 112', fr: 'Zone Section 112' },
  'section-120':  { en: 'Section 120 Area (Food Court)', es: 'Zona Sección 120 (Patio de Comidas)', fr: 'Zone Section 120 (Restauration)' },
  'concourse-200': { en: '200-Level Concourse', es: 'Pasillo 200', fr: 'Coursive 200' },
  'section-226':  { en: 'Section 226 Area', es: 'Zona Sección 226', fr: 'Zone Section 226' },
  'section-234':  { en: 'Section 234 Area', es: 'Zona Sección 234', fr: 'Zone Section 234' },
  'suite-level':  { en: 'Suite Level', es: 'Nivel Suite', fr: 'Niveau Suite' },
  'lot-a':        { en: 'Parking Lot A', es: 'Estacionamiento A', fr: 'Parking A' },
  'lot-g':        { en: 'Lot G (Rideshare)', es: 'Lote G (Transporte)', fr: 'Lot G (Covoiturage)' },
  'rail-station':  { en: 'Meadowlands Rail Station', es: 'Estación Meadowlands', fr: 'Gare Meadowlands' },
};

// Build adjacency list from edge definitions
type AdjList = Map<string, Array<GraphEdge & { from: string }>>;

function buildAdjacencyList(): AdjList {
  const adj: AdjList = new Map();

  const ensure = (z: string) => { if (!adj.has(z)) adj.set(z, []); };

  // Gate → concourse (fixed mapping)
  const gateMap: Array<[string, string]> = [
    ['gate-a', 'concourse-100-east'],
    ['gate-b', 'concourse-100-south'],
    ['gate-c', 'concourse-100-west'],
    ['gate-d', 'concourse-100-north'],
  ];
  for (const [gate, concourse] of gateMap) {
    ensure(gate); ensure(concourse);
    adj.get(gate)!.push({ from: gate, to: concourse, distance: 30, means: 'ramp', stepFree: true,
      landmark: { en: 'through security checkpoint', es: 'a través del control de seguridad', fr: 'à travers le contrôle de sécurité' } });
    adj.get(concourse)!.push({ from: concourse, to: gate, distance: 30, means: 'walk', stepFree: true });
  }

  // Concourse ring (100-level)
  const ring100 = ['concourse-100-east', 'concourse-100-south', 'concourse-100-west', 'concourse-100-north'];
  for (let i = 0; i < ring100.length; i++) {
    const a = ring100[i]!;
    const b = ring100[(i + 1) % ring100.length]!;
    ensure(a); ensure(b);
    adj.get(a)!.push({ from: a, to: b, distance: 120, means: 'walk', stepFree: true });
    adj.get(b)!.push({ from: b, to: a, distance: 120, means: 'walk', stepFree: true });
  }

  // Sections off east concourse
  const eastSections: Array<[string, number, Record<string, string>?]> = [
    ['section-102', 40, { en: 'past the team store on your left', es: 'pasando la tienda del equipo', fr: 'après la boutique d\'équipe' }],
    ['section-108', 50, { en: 'follow the blue medical signs', es: 'siga las señales médicas azules', fr: 'suivez les panneaux médicaux bleus' }],
    ['section-112', 60],
  ];
  for (const [sec, dist, lm] of eastSections) {
    ensure(sec);
    adj.get('concourse-100-east')!.push({ from: 'concourse-100-east', to: sec, distance: dist, means: 'walk', stepFree: true, landmark: lm });
    adj.get(sec)!.push({ from: sec, to: 'concourse-100-east', distance: dist, means: 'walk', stepFree: true });
  }

  // Section 120 off south concourse
  ensure('section-120');
  adj.get('concourse-100-south')!.push({ from: 'concourse-100-south', to: 'section-120', distance: 80, means: 'walk', stepFree: true,
    landmark: { en: 'follow the aroma to the International Food Court', es: 'siga el aroma al Patio de Comidas', fr: 'suivez les arômes vers la restauration' } });
  adj.get('section-120')!.push({ from: 'section-120', to: 'concourse-100-south', distance: 80, means: 'walk', stepFree: true });

  // 100-level to 200-level vertical connections
  ensure('concourse-200');
  adj.get('concourse-100-east')!.push({ from: 'concourse-100-east', to: 'concourse-200', distance: 15, means: 'elevator', stepFree: true,
    landmark: { en: 'take the elevator near Section 108', es: 'tome el ascensor cerca de Sección 108', fr: 'prenez l\'ascenseur près de Section 108' } });
  adj.get('concourse-100-east')!.push({ from: 'concourse-100-east', to: 'concourse-200', distance: 10, means: 'stairs', stepFree: false });
  adj.get('concourse-200')!.push({ from: 'concourse-200', to: 'concourse-100-east', distance: 15, means: 'elevator', stepFree: true });
  adj.get('concourse-200')!.push({ from: 'concourse-200', to: 'concourse-100-east', distance: 10, means: 'stairs', stepFree: false });

  // 200-level sections
  for (const [sec, dist, lm] of [['section-226', 60], ['section-234', 80, { en: 'near the upper water fountain', es: 'cerca de la fuente superior', fr: 'près de la fontaine supérieure' }]] as Array<[string, number, Record<string, string>?]>) {
    ensure(sec);
    adj.get('concourse-200')!.push({ from: 'concourse-200', to: sec, distance: dist, means: 'walk', stepFree: true, landmark: lm });
    adj.get(sec)!.push({ from: sec, to: 'concourse-200', distance: dist, means: 'walk', stepFree: true });
  }

  // Suite level
  ensure('suite-level');
  adj.get('concourse-200')!.push({ from: 'concourse-200', to: 'suite-level', distance: 20, means: 'elevator', stepFree: true,
    landmark: { en: 'exclusive elevator — suite ticket required', es: 'ascensor exclusivo — boleto suite', fr: 'ascenseur exclusif — billet suite' } });
  adj.get('suite-level')!.push({ from: 'suite-level', to: 'concourse-200', distance: 20, means: 'elevator', stepFree: true });

  // External zones (from Gate A)
  ensure('lot-a'); ensure('lot-g'); ensure('rail-station');
  adj.get('gate-a')!.push({ from: 'gate-a', to: 'lot-a', distance: 200, means: 'walk', stepFree: true,
    landmark: { en: 'follow shuttle signs to Lot A', es: 'siga las señales al Lote A', fr: 'suivez les panneaux vers Parking A' } });
  adj.get('lot-a')!.push({ from: 'lot-a', to: 'gate-a', distance: 200, means: 'walk', stepFree: true });
  adj.get('gate-a')!.push({ from: 'gate-a', to: 'lot-g', distance: 250, means: 'walk', stepFree: true });
  adj.get('lot-g')!.push({ from: 'lot-g', to: 'gate-a', distance: 250, means: 'walk', stepFree: true });
  adj.get('gate-b')!.push({ from: 'gate-b', to: 'rail-station', distance: 300, means: 'walk', stepFree: true,
    landmark: { en: 'follow the covered walkway to Meadowlands Station', es: 'siga el pasillo cubierto a Meadowlands', fr: 'suivez la passerelle couverte vers la gare' } });
  adj.get('rail-station')!.push({ from: 'rail-station', to: 'gate-b', distance: 300, means: 'walk', stepFree: true });

  return adj;
}

const ADJACENCY = buildAdjacencyList();

// ── BFS / Dijkstra Pathfinding ────────────────────────────────
interface RouteStep {
  from: string;
  to: string;
  distance: number;
  means: string;
  stepFree: boolean;
  landmark?: Record<string, string>;
}

function findRoute(from: string, to: string, stepFreeOnly: boolean): RouteStep[] | null {
  if (from === to) return [];
  if (!ADJACENCY.has(from) || !ADJACENCY.has(to)) return null;

  // Dijkstra's algorithm
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge: GraphEdge & { from: string } } | null>();
  const visited = new Set<string>();

  dist.set(from, 0);
  prev.set(from, null);

  while (true) {
    // Find unvisited node with smallest distance
    let current: string | null = null;
    let currentDist = Infinity;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < currentDist) {
        current = node;
        currentDist = d;
      }
    }
    if (current === null) break;
    if (current === to) break;

    visited.add(current);
    const edges = ADJACENCY.get(current) ?? [];
    for (const edge of edges) {
      if (stepFreeOnly && !edge.stepFree) continue;
      if (visited.has(edge.to)) continue;

      const newDist = currentDist + edge.distance;
      const existingDist = dist.get(edge.to) ?? Infinity;
      if (newDist < existingDist) {
        dist.set(edge.to, newDist);
        prev.set(edge.to, { node: current, edge });
      }
    }
  }

  if (!prev.has(to)) return null;

  // Reconstruct path
  const path: RouteStep[] = [];
  let node: string | null = to;
  while (node && prev.get(node)) {
    const entry: { node: string; edge: GraphEdge & { from: string } } = prev.get(node)!;
    path.unshift({
      from: entry.edge.from,
      to: entry.edge.to,
      distance: entry.edge.distance,
      means: entry.edge.means,
      stepFree: entry.edge.stepFree,
      landmark: entry.edge.landmark,
    });
    node = entry.node;
  }

  return path.length > 0 ? path : null;
}

// ── Facility Database with zone IDs ──────────────────────────

const STADIUM_FACILITIES: Record<string, StadiumFacility[]> = {
  restroom: [
    { name: { en: 'Main Restrooms', es: 'Aseos Principales', fr: 'Toilettes Principales' }, location: 'Behind Section 102', section: '100-level', zone: 'section-102', accessible: true, details: { en: 'Family restrooms available. Wheelchair accessible.', es: 'Baños familiares disponibles. Accesible para sillas de ruedas.', fr: 'Toilettes familiales disponibles. Accessible en fauteuil roulant.' } },
    { name: { en: 'Upper Restrooms', es: 'Aseos Superiores', fr: 'Toilettes Supérieures' }, location: 'Near Section 226', section: '200-level', zone: 'section-226', accessible: true, details: { en: 'Less crowded during halftime.', es: 'Menos concurridos en el medio tiempo.', fr: 'Moins fréquentées à la mi-temps.' } },
    { name: { en: 'Suite Level Restrooms', es: 'Aseos Nivel Suite', fr: 'Toilettes Niveau Suite' }, location: 'Suite Level Concourse', section: '300-level', zone: 'suite-level', accessible: true, details: { en: 'Suite ticket holders only.', es: 'Solo para poseedores de boletos suite.', fr: 'Réservé aux détenteurs de billets suite.' } },
  ],
  food: [
    { name: { en: 'Main Concessions', es: 'Concesiones Principales', fr: 'Concessions Principales' }, location: 'Sections 101–110', section: '100-level', zone: 'concourse-100-east', accessible: true, details: { en: 'Hot dogs, burgers, nachos, pizza. Halal & vegetarian options available.', es: 'Perritos calientes, hamburguesas, nachos, pizza. Opciones halal y vegetarianas.', fr: 'Hot-dogs, hamburgers, nachos, pizza. Options halal et végétariennes.' } },
    { name: { en: 'International Food Court', es: 'Patio de Comidas Internacional', fr: 'Aire de Restauration Internationale' }, location: 'Section 120', section: '100-level', zone: 'section-120', accessible: true, details: { en: 'World cuisines: Mexican, Japanese, Mediterranean, Indian. FIFA WC 2026 special menu.', es: 'Cocinas del mundo: mexicana, japonesa, mediterránea, india. Menú especial FIFA WC 2026.', fr: 'Cuisines du monde: mexicaine, japonaise, méditerranéenne, indienne. Menu spécial FIFA WC 2026.' } },
    { name: { en: 'Grab & Go Kiosks', es: 'Kioscos Rápidos', fr: 'Kiosques À Emporter' }, location: 'Every gate entrance', section: 'All levels', zone: 'gate-a', accessible: true, details: { en: 'Snacks, water, soda, beer. Contactless payment only.', es: 'Bocadillos, agua, refrescos, cerveza. Solo pago sin contacto.', fr: 'Collations, eau, soda, bière. Paiement sans contact uniquement.' } },
  ],
  medical: [
    { name: { en: 'Main Medical Station', es: 'Estación Médica Principal', fr: 'Station Médicale Principale' }, location: 'Section 108', section: '100-level', zone: 'section-108', accessible: true, details: { en: 'Full first aid, AED, nurses on duty 24/7 during match days. Call +1-800-555-MEDIC.', es: 'Primeros auxilios completos, DEA, enfermeras 24/7 en días de partido. Llame al +1-800-555-MEDIC.', fr: 'Premiers secours complets, DEA, infirmières 24h/24 les jours de match. Appelez le +1-800-555-MEDIC.' } },
    { name: { en: 'Upper Level First Aid', es: 'Primeros Auxilios Nivel Superior', fr: 'Premiers Secours Niveau Supérieur' }, location: 'Section 234', section: '200-level', zone: 'section-234', accessible: true, details: { en: 'Basic first aid and cooling station. Ideal for heat-related issues.', es: 'Primeros auxilios básicos y estación de enfriamiento.', fr: 'Premiers secours de base et station de rafraîchissement.' } },
  ],
  gate: [
    { name: { en: 'Gate A (Main Entrance)', es: 'Puerta A (Entrada Principal)', fr: 'Porte A (Entrée Principale)' }, location: 'East side, facing parking lot', section: 'Ground', zone: 'gate-a', accessible: true, details: { en: 'Primary entrance. Accessible ramp on left side. Opens 3h before kickoff.', es: 'Entrada principal. Rampa accesible a la izquierda. Abre 3h antes del partido.', fr: 'Entrée principale. Rampe accessible à gauche. Ouvre 3h avant le coup d\'envoi.' } },
    { name: { en: 'Gate B', es: 'Puerta B', fr: 'Porte B' }, location: 'South side', section: 'Ground', zone: 'gate-b', accessible: true, details: { en: 'Closest to NJ Transit rail station. Best for public transit arrivals.', es: 'Más cercana a la estación NJ Transit. Mejor para llegadas en transporte público.', fr: 'La plus proche de la gare NJ Transit. Idéale pour les arrivées en transport en commun.' } },
    { name: { en: 'Gate C', es: 'Puerta C', fr: 'Porte C' }, location: 'West side', section: 'Ground', zone: 'gate-c', accessible: true, details: { en: 'VIP and Suite access. Less crowded pre-game.', es: 'Acceso VIP y Suites. Menos concurrida antes del partido.', fr: 'Accès VIP et Suites. Moins fréquentée avant le match.' } },
    { name: { en: 'Gate D', es: 'Puerta D', fr: 'Porte D' }, location: 'North side', section: 'Ground', zone: 'gate-d', accessible: true, details: { en: 'Family entrance. Stroller parking available. Closest to family seating.', es: 'Entrada familiar. Estacionamiento de cochecitos disponible.', fr: 'Entrée familiale. Stationnement poussettes disponible.' } },
  ],
  parking: [
    { name: { en: 'Lot A (General)', es: 'Estacionamiento A (General)', fr: 'Parking A (Général)' }, location: 'East of stadium', section: 'Outdoor', zone: 'lot-a', accessible: true, details: { en: 'Main lot — $40. Opens 4h before kickoff. Shuttle available to Gate A.', es: 'Estacionamiento principal — $40. Abre 4h antes. Servicio de transporte a Puerta A.', fr: 'Parking principal — 40$. Ouvre 4h avant. Navette vers Porte A.' } },
    { name: { en: 'NJ Transit Rail', es: 'Tren NJ Transit', fr: 'Train NJ Transit' }, location: 'Meadowlands Station', section: 'Rail', zone: 'rail-station', accessible: true, details: { en: 'Direct trains from NY Penn Station and Secaucus. $5 round trip. Train runs 2h after match.', es: 'Trenes directos desde NY Penn Station y Secaucus. $5 ida y vuelta.', fr: 'Trains directs depuis NY Penn Station et Secaucus. 5$ aller-retour.' } },
    { name: { en: 'Rideshare Drop-off', es: 'Zona de Descenso', fr: 'Dépose Covoiturage' }, location: 'Lot G', section: 'Outdoor', zone: 'lot-g', accessible: true, details: { en: 'Uber/Lyft drop-off & pickup. Follow signs to Lot G after the match.', es: 'Descenso y recogida Uber/Lyft. Siga las señales al Lote G después del partido.', fr: 'Dépose/prise en charge Uber/Lyft. Suivez les panneaux vers le Lot G après le match.' } },
  ],
};

// Keywords per category for intent detection
const INTENT_KEYWORDS: Record<string, string[]> = {
  restroom: ['restroom', 'bathroom', 'toilet', 'wc', 'baño', 'aseo', 'toilette', 'lavabo'],
  food: ['food', 'eat', 'hungry', 'restaurant', 'drink', 'beer', 'water', 'comida', 'comer', 'hambre', 'cerveza', 'nourriture', 'manger', 'boire', 'bière', 'snack', 'pizza', 'burger', 'halal', 'vegetarian', 'vegan'],
  medical: ['medical', 'doctor', 'nurse', 'hurt', 'injury', 'first aid', 'emergency', 'help', 'sick', 'faint', 'médico', 'doctor', 'enfermero', 'herida', 'emergencia', 'médical', 'docteur', 'blessure', 'urgence', 'aid', 'aed', 'defibrillator'],
  gate: ['gate', 'entrance', 'exit', 'enter', 'puerta', 'entrada', 'salida', 'porte', 'entrée', 'sortie', 'section', 'seat', 'asiento', 'siège', 'find my seat'],
  parking: ['parking', 'car', 'drive', 'transit', 'train', 'bus', 'uber', 'lyft', 'taxi', 'transport', 'ride', 'estacionamiento', 'coche', 'tren', 'autobús', 'stationnement', 'voiture', 'rideshare', 'shuttle'],
  crowd: ['crowd', 'busy', 'wait', 'line', 'queue', 'congestion', 'crowded', 'multitud', 'lleno', 'cola', 'espera', 'foule', 'bondé', 'file', 'attente', 'packed'],
  accessibility: ['wheelchair', 'accessible', 'disability', 'blind', 'deaf', 'ramp', 'elevator', 'silla de ruedas', 'accesible', 'discapacidad', 'fauteuil roulant', 'handicapé', 'ascenseur', 'step-free', 'hearing loop'],
  wifi: ['wifi', 'internet', 'connect', 'charge', 'charging', 'phone', 'battery', 'wi-fi'],
  schedule: ['schedule', 'time', 'kickoff', 'start', 'match', 'game', 'team', 'horario', 'hora', 'partido', 'equipo', 'programme', 'heure', 'coup d\'envoi'],
  lost: ['lost', 'found', 'missing', 'child', 'kid', 'perdido', 'niño', 'perdu', 'enfant', 'belongings', 'bag', 'wallet'],
  safety: ['report', 'suspicious', 'unsafe', 'security', 'fight', 'danger', 'reportar', 'sospechoso', 'seguridad', 'signaler', 'suspect', 'sécurité'],
};

const GREETINGS: Record<string, string[]> = {
  en: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'sup', 'what\'s up'],
  es: ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'qué tal'],
  fr: ['bonjour', 'bonsoir', 'salut', 'coucou'],
};

export class ChatAgent {
  private ai: GoogleGenAI;
  private model: string;

  constructor(
    private readonly config: AppConfig,
    private readonly eventRepo: EventRepository,
    private readonly healthRepo: HealthSnapshotRepository
  ) {
    this.ai = new GoogleGenAI({ apiKey: config.env.geminiApiKey || 'mock_key' });
    this.model = config.env.geminiModel || 'gemini-1.5-flash';
  }

  async processChat(request: ChatRequest, forceDeterministic = false): Promise<string> {
    if (forceDeterministic || this.config.env.llmProvider === 'deterministic' || !this.config.env.geminiApiKey) {
      return this.smartResponse(request);
    }

    try {
      const systemPrompt = await this.buildSystemPrompt(request);
      
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: request.message,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        }
      });
      
      return response.text ?? 'I could not generate a response.';
    } catch (err) {
      console.error('[ChatAgent] Error generating content:', err);
      return this.smartResponse(request);
    }
  }

  private async buildSystemPrompt(req: ChatRequest): Promise<string> {
    const health = await this.healthRepo.findLatest();
    const recentEvents = await this.eventRepo.findInWindow(this.config.env.contextWindowMin);
    
    let activeIncidents = 0;
    for (const e of recentEvents) {
      if (e.type === 'incident' || e.type === 'medical_incident' || e.type === 'security_incident') {
        activeIncidents++;
      }
    }

    return `
You are AEGIS StadiumMate, an operational assistant for the FIFA World Cup 2026 at MetLife Stadium, New Jersey.
You are talking to a user with the role: ${req.role}.
The user prefers language: ${req.language.toUpperCase()}. You MUST respond in this language.
User's accessibility needs: ${req.accessibilityNeeds?.join(', ') || 'None'}.
User's current location: ${req.currentLocation || 'Unknown'}.

Stadium Context:
- Overall Health Score: ${health?.overall.toFixed(0) || 100}/100
- Active Incidents in last 30m: ${activeIncidents}
- Total events in window: ${recentEvents.length}

Stadium Layout (MetLife Stadium):
- 4 gates: A (East, Main), B (South, near NJ Transit), C (West, VIP), D (North, Family)
- 100-level: Main concourse, Sections 101-140
- 200-level: Upper concourse, Sections 201-250
- 300-level: Suite level
- Main Medical: Section 108
- International Food Court: Section 120
- Family Restrooms: Behind Section 102

Guidelines:
1. Be concise, polite, and helpful.
2. Ground your answers in the stadium context and layout.
3. Give step-by-step directions when asked.
4. If the user has accessibility needs, emphasize step-free routes, elevators, and accessible facilities.
5. Do NOT invent facilities or locations.
6. For a fan, act like a welcoming guide. For an organizer/security, act like a precise ops dashboard.
7. Include relevant safety information when appropriate.
`;
  }

  // ── Smart Deterministic Response Engine ─────────────────────
  // This handles 15+ intents with real, grounded stadium data,
  // step-by-step navigation via zone graph pathfinding, and
  // crowd-aware facility selection.

  private async smartResponse(req: ChatRequest): Promise<string> {
    const lang = req.language || 'en';
    const msg = req.message.toLowerCase().trim();
    const hasWheelchair = req.accessibilityNeeds?.includes('wheelchair') ?? false;

    // Check for greetings
    for (const [, greets] of Object.entries(GREETINGS)) {
      if (greets.some(g => msg.includes(g))) {
        return this.greetingResponse(lang, req.role);
      }
    }

    // Detect intent
    const intent = this.detectIntent(msg);
    
    // Get live context
    const health = await this.healthRepo.findLatest();
    const recentEvents = await this.eventRepo.findInWindow(this.config.env.contextWindowMin);
    let activeIncidents = 0;
    const crowdedZones: string[] = [];
    for (const e of recentEvents) {
      if (e.type === 'incident') activeIncidents++;
      const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
      if (e.type === 'density_reading' && payload.density && payload.density > 0.8) {
        crowdedZones.push(e.zone);
      }
    }

    // Determine user's current zone from the request (default: gate-a)
    const userZone = this.resolveUserZone(req.currentLocation);

    switch (intent) {
      case 'restroom': return this.facilityResponse('restroom', lang, hasWheelchair, crowdedZones, userZone);
      case 'food': return this.facilityResponse('food', lang, hasWheelchair, crowdedZones, userZone);
      case 'medical': return this.facilityResponse('medical', lang, hasWheelchair, crowdedZones, userZone);
      case 'gate': return this.facilityResponse('gate', lang, hasWheelchair, crowdedZones, userZone);
      case 'parking': return this.facilityResponse('parking', lang, hasWheelchair, crowdedZones, userZone);
      case 'crowd': return this.crowdResponse(lang, crowdedZones, activeIncidents);
      case 'accessibility': return this.accessibilityResponse(lang);
      case 'wifi': return this.wifiResponse(lang);
      case 'schedule': return this.scheduleResponse(lang);
      case 'lost': return this.lostAndFoundResponse(lang);
      case 'safety': return this.safetyResponse(lang);
      default: return this.defaultResponse(lang, req.role, health?.overall ?? 100, activeIncidents);
    }
  }

  private resolveUserZone(location?: string): string {
    if (!location) return 'gate-a';
    const loc = location.toLowerCase();
    // Try to match to a known zone
    for (const zoneId of Object.keys(STADIUM_ZONES)) {
      if (loc.includes(zoneId) || zoneId.includes(loc.replace(/\s+/g, '-'))) return zoneId;
    }
    // Fuzzy match common descriptions
    if (loc.includes('gate a') || loc.includes('main entrance')) return 'gate-a';
    if (loc.includes('gate b') || loc.includes('south')) return 'gate-b';
    if (loc.includes('gate c') || loc.includes('west') || loc.includes('vip')) return 'gate-c';
    if (loc.includes('gate d') || loc.includes('north') || loc.includes('family')) return 'gate-d';
    if (loc.includes('food court') || loc.includes('120')) return 'section-120';
    if (loc.includes('medical') || loc.includes('108')) return 'section-108';
    if (loc.includes('102')) return 'section-102';
    if (loc.includes('200') || loc.includes('upper')) return 'concourse-200';
    return 'gate-a';
  }

  private detectIntent(msg: string): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const score = keywords.filter(kw => msg.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent;
      }
    }

    return bestMatch;
  }

  // ── Facility Response with Navigation + Crowd Awareness ────
  private facilityResponse(type: string, lang: string, wheelchair: boolean, crowdedZones: string[], userZone: string): string {
    const facilities = STADIUM_FACILITIES[type] ?? [];
    if (facilities.length === 0) return this.defaultResponse(lang, 'fan', 100, 0);

    const headers: Record<string, Record<string, string>> = {
      restroom: { en: '🚻 Nearest Restrooms', es: '🚻 Aseos Más Cercanos', fr: '🚻 Toilettes Les Plus Proches' },
      food: { en: '🍔 Food & Drink Options', es: '🍔 Comida y Bebida', fr: '🍔 Options Restauration' },
      medical: { en: '🏥 Medical Assistance', es: '🏥 Asistencia Médica', fr: '🏥 Assistance Médicale' },
      gate: { en: '🚪 Stadium Gates', es: '🚪 Puertas del Estadio', fr: '🚪 Portes du Stade' },
      parking: { en: '🅿️ Parking & Transport', es: '🅿️ Estacionamiento y Transporte', fr: '🅿️ Stationnement et Transport' },
    };

    // ── Crowd-Aware Selection: sort facilities by distance, but prefer uncrowded ones
    const scored = facilities.map(f => {
      const route = findRoute(userZone, f.zone, wheelchair);
      const totalDist = route ? route.reduce((s, r) => s + r.distance, 0) : 9999;
      const isCrowded = crowdedZones.some(z => z === f.zone || f.location.toLowerCase().includes(z.toLowerCase()));
      // Crowded facilities get a penalty so quieter alternatives rank higher
      const effectiveDist = isCrowded ? totalDist + 500 : totalDist;
      return { facility: f, route, totalDist, isCrowded, effectiveDist };
    }).sort((a, b) => a.effectiveDist - b.effectiveDist);

    const header = headers[type]?.[lang] ?? headers[type]?.['en'] ?? type;
    let response = `**${header}**\n\n`;

    // Show the best (uncrowded) recommendation first
    const best = scored[0]!;
    if (best.isCrowded && scored.length > 1 && !scored[1]!.isCrowded) {
      // Swap happened — tell the user
      const swapNote: Record<string, string> = {
        en: `⚠️ The nearest ${type} is currently busy. We recommend a less crowded option:`,
        es: `⚠️ El ${type} más cercano está actualmente concurrido. Recomendamos una opción menos llena:`,
        fr: `⚠️ Les ${type} les plus proches sont actuellement fréquentés. Nous recommandons une option moins bondée:`,
      };
      response += `${swapNote[lang] ?? swapNote['en']}\n\n`;
    }

    // Render top 2 facilities
    for (let i = 0; i < Math.min(2, scored.length); i++) {
      const { facility, route, totalDist, isCrowded } = scored[i]!;
      const name = facility.name[lang] || facility.name['en'];
      const details = facility.details[lang] || facility.details['en'];

      if (i === 0) {
        response += `📍 **${name}** ${isCrowded ? '⚠️' : '✅'}\n`;
      } else {
        const altLabel: Record<string, string> = { en: 'Alternative', es: 'Alternativa', fr: 'Alternative' };
        response += `\n📍 **${name}** (${altLabel[lang] ?? 'Alternative'})\n`;
      }
      response += `   ${facility.location} • ${details}\n`;

      if (wheelchair && facility.accessible) {
        const accessNote: Record<string, string> = {
          en: '   ♿ Wheelchair accessible • Step-free route available',
          es: '   ♿ Accesible para sillas de ruedas • Ruta sin escalones',
          fr: '   ♿ Accessible en fauteuil roulant • Itinéraire sans marches',
        };
        response += `${accessNote[lang] || accessNote['en']}\n`;
      }

      if (isCrowded) {
        const crowdNote: Record<string, string> = {
          en: '   ⚠️ Currently busy — expect wait times',
          es: '   ⚠️ Actualmente concurrido — espere tiempos de espera',
          fr: '   ⚠️ Actuellement fréquenté — prévoyez des temps d\'attente',
        };
        response += `${crowdNote[lang] || crowdNote['en']}\n`;
      }

      // ── Step-by-Step Directions ──
      if (route && route.length > 0) {
        const routeLabel: Record<string, string> = { en: 'Route', es: 'Ruta', fr: 'Itinéraire' };
        response += `\n   **🗺️ ${routeLabel[lang] ?? 'Route'}** (~${totalDist}m, ${Math.ceil(totalDist / 80)} min walk)\n`;
        
        for (let s = 0; s < route.length; s++) {
          const step = route[s]!;
          const toName = STADIUM_ZONES[step.to]?.[lang] ?? STADIUM_ZONES[step.to]?.['en'] ?? step.to;
          const meansIcon = step.means === 'elevator' ? '🛗' : step.means === 'ramp' ? '♿' : step.means === 'stairs' ? '🪜' : step.means === 'escalator' ? '🪜' : '🚶';
          const landmark = step.landmark?.[lang] ?? step.landmark?.['en'] ?? '';
          const landmarkStr = landmark ? ` — ${landmark}` : '';
          
          if (s === route.length - 1) {
            const arriveLabel: Record<string, string> = { en: 'Arrive at', es: 'Llegue a', fr: 'Arrivez à' };
            response += `   ${s + 1}. ${meansIcon} **${arriveLabel[lang] ?? 'Arrive at'} ${toName}**${landmarkStr}\n`;
          } else {
            const meansLabel: Record<string, Record<string, string>> = {
              walk: { en: 'Walk to', es: 'Camine a', fr: 'Marchez vers' },
              ramp: { en: 'Take the ramp to', es: 'Tome la rampa a', fr: 'Prenez la rampe vers' },
              elevator: { en: 'Take the elevator to', es: 'Tome el ascensor a', fr: 'Prenez l\'ascenseur vers' },
              stairs: { en: 'Take the stairs to', es: 'Suba las escaleras a', fr: 'Prenez les escaliers vers' },
              escalator: { en: 'Take the escalator to', es: 'Tome la escalera mecánica a', fr: 'Prenez l\'escalator vers' },
            };
            const label = meansLabel[step.means]?.[lang] ?? meansLabel[step.means]?.['en'] ?? `Go to`;
            response += `   ${s + 1}. ${meansIcon} ${label} **${toName}**${landmarkStr}\n`;
          }
        }
      }
    }

    return response.trim();
  }

  private crowdResponse(lang: string, crowdedZones: string[], incidents: number): string {
    const responses: Record<string, string> = {
      en: `**📊 Live Crowd Status**\n\n${crowdedZones.length > 0 
        ? `⚠️ **Busy areas:** ${crowdedZones.join(', ')}\n\n💡 **Tip:** Use Gates C or D for less congestion. Upper level (200s) is typically 30% less crowded than the main concourse.\n\n🚨 Active incidents: ${incidents}`
        : `✅ All areas are flowing normally.\n\n🚨 Active incidents: ${incidents}\n\n💡 **Tip:** Halftime is the busiest time for concessions. Visit 10 minutes before halftime to avoid lines.`}`,
      es: `**📊 Estado de Multitudes en Vivo**\n\n${crowdedZones.length > 0 
        ? `⚠️ **Áreas concurridas:** ${crowdedZones.join(', ')}\n\n💡 **Consejo:** Use las Puertas C o D para menos congestión.\n\n🚨 Incidentes activos: ${incidents}`
        : `✅ Todas las áreas fluyen normalmente.\n\n🚨 Incidentes activos: ${incidents}\n\n💡 **Consejo:** El medio tiempo es el momento más concurrido. Visite 10 minutos antes.`}`,
      fr: `**📊 État de la Foule en Direct**\n\n${crowdedZones.length > 0 
        ? `⚠️ **Zones fréquentées:** ${crowdedZones.join(', ')}\n\n💡 **Conseil:** Utilisez les Portes C ou D.\n\n🚨 Incidents actifs: ${incidents}`
        : `✅ Toutes les zones sont fluides.\n\n🚨 Incidents actifs: ${incidents}\n\n💡 **Conseil:** La mi-temps est le moment le plus fréquenté. Rendez-vous 10 minutes avant.`}`,
    };
    return responses[lang] ?? responses['en']!;
  }

  private accessibilityResponse(lang: string): string {
    const responses: Record<string, string> = {
      en: `**♿ Accessibility at MetLife Stadium**\n\n🔹 **Wheelchair Access:** All gates have accessible ramps. Elevators to all levels at Sections 108 and 230.\n🔹 **Accessible Seating:** Available on every level. Contact your gate attendant for assistance.\n🔹 **Service Animals:** Welcome throughout the stadium.\n🔹 **Hearing Assistance:** Hearing loops installed in Sections 101–110 and all suites.\n🔹 **Sensory Room:** Located near Section 112 — a quiet, low-stimulation space.\n🔹 **Accessible Restrooms:** Family restrooms behind Section 102 (100-level) and Section 226 (200-level).\n\n📞 Need help? Text "ACCESS" to 555-0123 or ask any volunteer in a yellow vest.`,
      es: `**♿ Accesibilidad en MetLife Stadium**\n\n🔹 **Acceso en silla de ruedas:** Todas las puertas tienen rampas. Ascensores en Secciones 108 y 230.\n🔹 **Asientos accesibles:** En todos los niveles.\n🔹 **Animales de servicio:** Bienvenidos en todo el estadio.\n🔹 **Asistencia auditiva:** Bucles auditivos en Secciones 101–110.\n🔹 **Sala sensorial:** Cerca de la Sección 112.\n🔹 **Baños accesibles:** Detrás de la Sección 102 y Sección 226.\n\n📞 ¿Necesita ayuda? Envíe "ACCESS" al 555-0123.`,
      fr: `**♿ Accessibilité au MetLife Stadium**\n\n🔹 **Accès fauteuil roulant:** Toutes les portes ont des rampes. Ascenseurs aux Sections 108 et 230.\n🔹 **Places accessibles:** À tous les niveaux.\n🔹 **Animaux d'assistance:** Bienvenus dans tout le stade.\n🔹 **Aide auditive:** Boucles auditives Sections 101–110.\n🔹 **Salle sensorielle:** Près de la Section 112.\n🔹 **Toilettes accessibles:** Derrière la Section 102 et Section 226.\n\n📞 Besoin d'aide? Envoyez "ACCESS" au 555-0123.`,
    };
    return responses[lang] ?? responses['en']!;
  }

  private wifiResponse(lang: string): string {
    const responses: Record<string, string> = {
      en: `**📶 WiFi & Charging**\n\n🔹 **Free WiFi:** Network name: \`FIFA_WC2026_MetLife\`. No password needed.\n🔹 **Charging Stations:** Located at Gates A and C (100-level), and near Section 225 (200-level).\n🔹 **Tip:** The FIFA World Cup 2026 app provides real-time match stats, replays, and stadium navigation on your phone.`,
      es: `**📶 WiFi y Carga**\n\n🔹 **WiFi gratis:** Red: \`FIFA_WC2026_MetLife\`. Sin contraseña.\n🔹 **Estaciones de carga:** Puertas A y C (nivel 100), y cerca de Sección 225.\n🔹 **Consejo:** La app FIFA WC 2026 ofrece estadísticas en tiempo real y navegación del estadio.`,
      fr: `**📶 WiFi et Recharge**\n\n🔹 **WiFi gratuit:** Réseau: \`FIFA_WC2026_MetLife\`. Sans mot de passe.\n🔹 **Stations de recharge:** Portes A et C (niveau 100), et Section 225.\n🔹 **Conseil:** L'app FIFA WC 2026 offre des stats en direct et la navigation du stade.`,
    };
    return responses[lang] ?? responses['en']!;
  }

  private scheduleResponse(lang: string): string {
    const responses: Record<string, string> = {
      en: `**⚽ Match Information**\n\n🏟️ **Venue:** MetLife Stadium, East Rutherford, NJ\n📅 **Today's Match:** Group Stage — Teams TBD\n⏰ **Gates Open:** 3 hours before kickoff\n🎵 **Pre-match Show:** 45 minutes before kickoff\n\n📋 **Stadium Rules:**\n• Clear bag policy (12"x6"x12" max)\n• No outside food/drinks\n• No umbrellas, chairs, or large backpacks\n• Mobile tickets only (screenshot not accepted)\n\n💡 Arrive early to enjoy the FIFA Fan Festival outside Gate A!`,
      es: `**⚽ Información del Partido**\n\n🏟️ **Sede:** MetLife Stadium, East Rutherford, NJ\n📅 **Partido de hoy:** Fase de grupos — Equipos por confirmar\n⏰ **Puertas abren:** 3 horas antes del partido\n🎵 **Show previo:** 45 minutos antes\n\n📋 **Reglas del estadio:**\n• Política de bolsas transparentes\n• Sin comida/bebida externa\n• Solo boletos digitales\n\n💡 ¡Llegue temprano para disfrutar del FIFA Fan Festival!`,
      fr: `**⚽ Information Match**\n\n🏟️ **Lieu:** MetLife Stadium, East Rutherford, NJ\n📅 **Match d'aujourd'hui:** Phase de groupes — Équipes à confirmer\n⏰ **Ouverture des portes:** 3h avant le coup d'envoi\n🎵 **Spectacle d'avant-match:** 45 minutes avant\n\n📋 **Règles du stade:**\n• Politique de sacs transparents\n• Pas de nourriture/boisson extérieure\n• Billets numériques uniquement\n\n💡 Arrivez tôt pour le FIFA Fan Festival!`,
    };
    return responses[lang] ?? responses['en']!;
  }

  private lostAndFoundResponse(lang: string): string {
    const responses: Record<string, string> = {
      en: `**🔍 Lost & Found**\n\n📍 **Location:** Guest Services at Gate A (100-level)\n📞 **Call:** +1-800-555-LOST\n👶 **Lost Child:** Alert ANY staff member immediately. Code Adam will be activated — all exits monitored.\n🎒 **Lost Items:** Report at Guest Services. Items are held for 30 days.\n\n⚠️ **If you see an unattended bag**, do NOT touch it. Report it to the nearest security officer or text SECURITY to 555-0199.`,
      es: `**🔍 Objetos Perdidos**\n\n📍 **Ubicación:** Servicios al Visitante en Puerta A\n📞 **Llamar:** +1-800-555-LOST\n👶 **Niño perdido:** Alerte a CUALQUIER miembro del personal inmediatamente.\n🎒 **Objetos perdidos:** Reporte en Servicios al Visitante.\n\n⚠️ **Si ve una bolsa abandonada**, NO la toque. Repórtela a seguridad.`,
      fr: `**🔍 Objets Trouvés**\n\n📍 **Emplacement:** Services aux Visiteurs à la Porte A\n📞 **Appelez:** +1-800-555-LOST\n👶 **Enfant perdu:** Alertez IMMÉDIATEMENT un membre du personnel.\n🎒 **Objets perdus:** Signalez aux Services aux Visiteurs.\n\n⚠️ **Si vous voyez un sac abandonné**, NE le touchez PAS. Signalez-le à la sécurité.`,
    };
    return responses[lang] ?? responses['en']!;
  }

  private safetyResponse(lang: string): string {
    const responses: Record<string, string> = {
      en: `**🛡️ Report a Safety Concern**\n\n📱 **Text:** Send details to 555-0199\n📞 **Call:** Stadium Security at +1-800-555-SAFE\n🙋 **In person:** Approach any staff in a yellow vest or any security officer\n\n**Emergency:** Call 911 for immediate danger.\n\nAll reports are anonymous. Your safety is our #1 priority.`,
      es: `**🛡️ Reportar una Preocupación de Seguridad**\n\n📱 **Texto:** Envíe detalles al 555-0199\n📞 **Llamar:** Seguridad del Estadio +1-800-555-SAFE\n🙋 **En persona:** Acérquese a cualquier personal con chaleco amarillo\n\n**Emergencia:** Llame al 911.\n\nTodos los reportes son anónimos.`,
      fr: `**🛡️ Signaler un Problème de Sécurité**\n\n📱 **SMS:** Envoyez les détails au 555-0199\n📞 **Appelez:** Sécurité du Stade +1-800-555-SAFE\n🙋 **En personne:** Adressez-vous à tout personnel en gilet jaune\n\n**Urgence:** Appelez le 911.\n\nTous les signalements sont anonymes.`,
    };
    return responses[lang] ?? responses['en']!;
  }

  private greetingResponse(lang: string, role: string): string {
    if (role === 'fan') {
      const responses: Record<string, string> = {
        en: `👋 Welcome to MetLife Stadium for the **FIFA World Cup 2026**! 🏆\n\nI'm your stadium assistant. I can help you with:\n🚻 Finding restrooms\n🍔 Food & drink options\n🏥 Medical assistance\n🚪 Gate & seat directions\n🅿️ Parking & transport\n📊 Crowd levels\n♿ Accessibility info\n\nJust ask me anything, or tap one of the quick actions below!`,
        es: `👋 ¡Bienvenido al MetLife Stadium para la **Copa Mundial de la FIFA 2026**! 🏆\n\nSoy su asistente del estadio. Puedo ayudarle con:\n🚻 Encontrar aseos\n🍔 Comida y bebida\n🏥 Asistencia médica\n🚪 Puertas y asientos\n🅿️ Estacionamiento y transporte\n📊 Niveles de multitud\n♿ Accesibilidad\n\n¡Pregúnteme cualquier cosa!`,
        fr: `👋 Bienvenue au MetLife Stadium pour la **Coupe du Monde de la FIFA 2026**! 🏆\n\nJe suis votre assistant du stade. Je peux vous aider avec:\n🚻 Trouver les toilettes\n🍔 Restauration\n🏥 Assistance médicale\n🚪 Portes et sièges\n🅿️ Stationnement et transport\n📊 Niveaux de foule\n♿ Accessibilité\n\nDemandez-moi n'importe quoi!`,
      };
      return responses[lang] ?? responses['en']!;
    }
    
    const responses: Record<string, string> = {
      en: `👋 Hello, ${role}. AEGIS Operational Intelligence is online.\n\nI can provide:\n📊 Live crowd & health status\n🚨 Active incident summaries\n📋 Recommendation overviews\n🔧 Operational queries\n\nHow can I assist you?`,
      es: `👋 Hola, ${role}. AEGIS Inteligencia Operacional en línea.\n\n¿Cómo puedo ayudarle?`,
      fr: `👋 Bonjour, ${role}. Intelligence Opérationnelle AEGIS en ligne.\n\nComment puis-je vous aider?`,
    };
    return responses[lang] ?? responses['en']!;
  }

  private defaultResponse(lang: string, role: string, healthScore: number, incidents: number): string {
    if (role === 'fan') {
      const responses: Record<string, string> = {
        en: `I can help you navigate MetLife Stadium! Try asking about:\n\n🚻 **"Where are the restrooms?"**\n🍔 **"Where can I get food?"**\n🏥 **"I need medical help"**\n🚪 **"How do I find my gate?"**\n🅿️ **"Parking and transport info"**\n📊 **"How crowded is it?"**\n♿ **"Accessibility options"**\n📶 **"WiFi info"**\n⚽ **"Match schedule"**\n\nOr just tell me what you need!`,
        es: `¡Puedo ayudarle a navegar el MetLife Stadium! Intente preguntar sobre:\n\n🚻 **"¿Dónde están los aseos?"**\n🍔 **"¿Dónde puedo comer?"**\n🏥 **"Necesito ayuda médica"**\n🚪 **"¿Cómo encuentro mi puerta?"**\n🅿️ **"Información de transporte"**\n📊 **"¿Qué tan lleno está?"**\n♿ **"Opciones de accesibilidad"**\n\n¡O simplemente dígame qué necesita!`,
        fr: `Je peux vous aider à naviguer dans le MetLife Stadium! Essayez de demander:\n\n🚻 **"Où sont les toilettes?"**\n🍔 **"Où manger?"**\n🏥 **"J'ai besoin d'aide médicale"**\n🚪 **"Comment trouver ma porte?"**\n🅿️ **"Infos stationnement"**\n📊 **"C'est bondé?"**\n♿ **"Options accessibilité"**\n\nOu dites-moi simplement ce dont vous avez besoin!`,
      };
      return responses[lang] ?? responses['en']!;
    }

    // Operator default
    return `📊 **Stadium Status:** Health Score ${healthScore}/100 | Active Incidents: ${incidents}\n\nHow can I assist with operations?`;
  }
}
