#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createWorld, step, analyze, render, renderSVG } from './index.js';
import { parse, integer, decimal, terminal } from './terminal.js';
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: terminal-coral-garden [--seed N] [--colonies N] [--depth N] [--spread N] [--palette reef|sunset|lagoon] [--width N] [--height N] [--steps N] [--frames N] [--json] [--svg FILE] [--no-color]\nControls: p pause, . grow, 1/2/3 palettes, t tips, n seed, r replay, +/- speed, q quit'); process.exit(0); }
try {
  const options = parse(args, ['--seed', '--colonies', '--depth', '--spread', '--palette', '--width', '--height', '--steps', '--frames', '--svg']);
  const live = !!(process.stdout.isTTY && process.stdin.isTTY && !options['--json'] && !options['--svg']);
  const width = integer(options, '--width', live ? Math.max(24, Math.min(100, (process.stdout.columns || 80) - 1)) : 80, 120);
  const height = integer(options, '--height', live ? Math.max(12, Math.min(40, (process.stdout.rows || 32) - 4)) : 36, 60);
  const colonies = integer(options, '--colonies', 4, 7), depth = integer(options, '--depth', 5, 7), spread = decimal(options, '--spread', 0.38), palette = options['--palette'] || 'reef';
  let seed = integer(options, '--seed', 42, 0xffffffff), paused = false, tips = true, delay = 90;
  const make = () => createWorld({ seed, width, height, colonies, depth, spread, palette }); let world = make();
  const frames = integer(options, '--frames', live ? Infinity : 1, 100000);
  if ((options['--json'] || options['--svg']) && options['--frames'] !== undefined) throw new Error('--frames is only for terminal output');
  step(world, integer(options, '--steps', live ? 0 : 100, 10000));
  if (options['--json'] || options['--svg']) {
    if (options['--svg']) await writeFile(options['--svg'], renderSVG(world));
    if (options['--json']) console.log(JSON.stringify(analyze(world), null, 2));
  } else await terminal({ live, frames, interval: () => delay,
    onKey: key => {
      if (key === 'p' || key === ' ') paused = !paused;
      else if (key === '.') { paused = true; step(world); }
      else if (key === 'n') { seed = (seed + 1) >>> 0; world = make(); }
      else if (key === 'r') world = make();
      else if (key === 't') tips = !tips;
      else if (['1', '2', '3'].includes(key)) world.palette = ['reef', 'sunset', 'lagoon'][Number(key) - 1];
      else if (key === '+' || key === '=') delay = Math.max(10, Math.floor(delay / 2));
      else if (key === '-') delay = Math.min(1000, delay * 2);
    }, onTick: () => { if (paused || world.complete) return false; step(world); return true; },
    draw: () => `CORAL GARDEN | seed ${seed} | frame ${world.frame} | ${world.segments.length} segments${world.complete ? ' GROWN' : ''}${paused ? ' PAUSED' : ''}\n${render(world, { tips, color: live && !options['--no-color'] && !process.env.NO_COLOR })}\n1/2/3 palette t tips p pause . grow n seed r replay q quit`
  });
} catch (error) { console.error(`terminal-coral-garden: ${error.message}`); process.exitCode = 2; }
