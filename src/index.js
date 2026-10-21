export const palettes = { reef: ['#f58ba7', '#63dbc2', '#ffc67e', '#a998ec'], sunset: ['#ff9d74', '#ed729b', '#ffd68a', '#d8a4ee'], lagoon: ['#77dfcc', '#72b8f4', '#a6e4a2', '#b8b4f5'] };
function random(world) { world.randomState = (Math.imul(world.randomState, 1664525) + 1013904223) >>> 0; return world.randomState / 4294967296; }
export function createWorld({ seed = 42, width = 80, height = 36, colonies = 4, depth = 5, spread = 0.38, palette = 'reef' } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be unsigned 32-bit');
  if (!Number.isInteger(width) || width < 24 || width > 120 || !Number.isInteger(height) || height < 12 || height > 60) throw new Error('width must be 24–120 and height 12–60');
  if (!Number.isInteger(colonies) || colonies < 1 || colonies > 7 || !Number.isInteger(depth) || depth < 2 || depth > 7) throw new Error('colonies must be 1–7 and depth 2–7');
  if (!Number.isFinite(spread) || spread < 0.15 || spread > 0.75) throw new Error('spread must be between 0.15 and 0.75');
  if (!Object.hasOwn(palettes, palette)) throw new Error('palette must be reef, sunset, or lagoon');
  const world = { seed, randomState: seed, width, height, colonies, depth, spread, palette, frame: 0, complete: false, segments: [], tips: [], roots: [] };
  for (let colony = 0; colony < colonies; colony++) {
    const x = (colony + 1) * 1.6 / (colonies + 1) + (random(world) - 0.5) * 0.03;
    world.roots.push({ x, y: 0.96 });
    world.tips.push({ x, y: 0.96, angle: -Math.PI / 2 + (random(world) - 0.5) * 0.2, colony, depth: 0, age: 0, budget: 6 + Math.floor(random(world) * 4), parent: -1 });
  }
  return world;
}
export function step(world, count = 1) {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error('step count must be 0–10000');
  for (let tick = 0; tick < count && !world.complete; tick++) {
    const next = [];
    for (const tip of world.tips) {
      const angle = Math.max(-2.62, Math.min(-0.52, tip.angle + (random(world) - 0.5) * 0.065)), length = 0.024 * 0.93 ** tip.depth;
      const x = tip.x + Math.cos(angle) * length, y = tip.y + Math.sin(angle) * length;
      if (x < 0.025 || x > 1.575 || y < 0.04) continue;
      const parent = world.segments.length;
      world.segments.push({ x1: tip.x, y1: tip.y, x2: x, y2: y, depth: tip.depth, colony: tip.colony, parent: tip.parent });
      if (tip.age + 1 < tip.budget) next.push({ ...tip, x, y, angle, age: tip.age + 1, parent });
      else if (tip.depth < world.depth) {
        for (const direction of [-1, 1]) next.push({ x, y, angle: Math.max(-2.62, Math.min(-0.52, angle + direction * world.spread * (0.75 + random(world) * 0.5))), colony: tip.colony, depth: tip.depth + 1, age: 0, budget: 6 + Math.floor(random(world) * 4), parent });
      }
    }
    world.tips = next; world.frame++; world.complete = next.length === 0;
  }
  return world;
}
export function analyze(world) {
  const byColony = Array(world.colonies).fill(0); let deepest = 0, highest = 0;
  for (const s of world.segments) { byColony[s.colony]++; deepest = Math.max(deepest, s.depth); highest = Math.max(highest, 0.96 - s.y2); }
  return { seed: world.seed, width: world.width, height: world.height, colonies: world.colonies, depth: world.depth, spread: world.spread, palette: world.palette, frame: world.frame, complete: world.complete, segments: world.segments.length, activeTips: world.tips.length, deepestBranch: deepest, growthHeight: highest, segmentsByColony: byColony };
}
export function render(world, { color = false, tips = true } = {}) {
  const { width: w, height: h } = world, grid = Array.from({ length: h }, () => Array(w).fill(' '));
  const ground = Math.round(0.96 * (h - 1)); grid[ground].fill('_');
  const put = (x, y, char, colony) => { const cx = Math.round(x / 1.6 * (w - 1)), cy = Math.round(y * (h - 1)); if (grid[cy]?.[cx] !== undefined) grid[cy][cx] = color ? `\x1b[${(world.palette === 'sunset' ? [91, 95, 93, 35] : world.palette === 'lagoon' ? [96, 94, 92, 95] : [95, 96, 93, 94])[colony % 4]}m${char}\x1b[0m` : char; };
  for (const s of world.segments) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, char = Math.abs(dx) < Math.abs(dy) * 0.35 ? '|' : dx > 0 ? '/' : '\\';
    const samples = Math.max(1, Math.ceil(Math.max(Math.abs(dx) / 1.6 * w, Math.abs(dy) * h) * 2));
    for (let n = 0; n <= samples; n++) put(s.x1 + dx * n / samples, s.y1 + dy * n / samples, char, s.colony);
  }
  if (tips) for (const t of world.tips) put(t.x, t.y, '*', t.colony);
  return grid.map(row => row.join('')).join('\n');
}
export function renderSVG(world) {
  const paths = world.segments.map(s => `<path d="M${(32 + s.x1 * 460).toFixed(2)} ${(96 + s.y1 * 460).toFixed(2)}L${(32 + s.x2 * 460).toFixed(2)} ${(96 + s.y2 * 460).toFixed(2)}" stroke="${palettes[world.palette][s.colony % 4]}" stroke-width="${Math.max(1, 5 - s.depth * 0.65).toFixed(2)}"/>`).join('');
  const tips = world.tips.map(t => `<circle cx="${(32 + t.x * 460).toFixed(2)}" cy="${(96 + t.y * 460).toFixed(2)}" r="2.5" fill="#e9fff7"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="620" viewBox="0 0 800 620"><rect width="800" height="620" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="38" font-size="24" fill="#eff5ff">TERMINAL CORAL GARDEN</text><text x="32" y="66" fill="#93a4bc">seed ${world.seed} / ${world.colonies} colonies / ${world.segments.length} segments / ${world.complete ? 'grown' : 'growing'}</text><path d="M32 538H768" stroke="#30475b"/><g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</g>${tips}<text x="32" y="594" font-size="12" fill="#93a4bc">1 reef 2 sunset 3 lagoon / t tips / p pause . grow n seed r replay q quit</text></g></svg>\n`;
}
