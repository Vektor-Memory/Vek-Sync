#!/usr/bin/env node
/**
 * vek-sync v0.3.0 — CLI entry point
 * Commands: init, sync, export, status, diff, add, ping, share, profile, search, vault
 */

import { readFileSync, watch, existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join }                                   from 'path';
import { homedir }                                         from 'os';
import { createInterface }                                 from 'readline/promises';
import * as mcpfile                                        from './utils/mcpfile.js';
import * as vault                                          from './utils/vault.js';
import { backup }                                          from './utils/backup.js';
import { pingStdio, pingHttp }                             from './utils/ping.js';
import { searchCurated, searchNpm }                        from './utils/registry.js';
import {
  claudeDesktop, cursor, vscode, windsurf, claudeCode,
  cline, rooCode, gemini, copilot, continue_, codex,
} from './connectors/index.js';
import { resolveObject } from './utils/vault.js';

const CONNECTORS = {
  claudeDesktop, cursor, vscode, windsurf, claudeCode,
  cline, rooCode, gemini, copilot, continue: continue_, codex,
};
const CONNECTOR_NAMES = Object.keys(CONNECTORS);
const VERSION         = '0.3.1';

const _ = {
  reset:  '\x1b[0m',  bold:   '\x1b[1m',
  white:  '\x1b[97m', silver: '\x1b[37m', grey:   '\x1b[90m',
  cobalt: '\x1b[38;5;26m',  steel: '\x1b[38;5;67m',
  sky:    '\x1b[38;5;117m', ice:   '\x1b[38;5;153m',
  green:  '\x1b[38;5;78m',  red:   '\x1b[38;5;203m', amber: '\x1b[38;5;221m',
};

const p  = (col, s) => `${col}${s}${_.reset}`;
const W  = s => p(_.white + _.bold, s);
const Si = s => p(_.silver, s);
const Gr = s => p(_.grey, s);
const Sk = s => p(_.sky, s);
const Ic = s => p(_.ice, s);
const St = s => p(_.steel, s);
const G  = s => p(_.green, s);
const R  = s => p(_.red, s);
const Y  = s => p(_.amber, s);
const Co = s => p(_.cobalt, s);

function banner() {
  console.log('');
  console.log(' ' + Co('\u2588\u2588\u2557   \u2588\u2588\u2557') + St(' \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557') + Sk(' \u2588\u2588\u2557  \u2588\u2588\u2557'));
  console.log(' ' + Co('\u2588\u2588\u2551   \u2588\u2588\u2551') + St(' \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d') + Sk(' \u2588\u2588\u2551 \u2588\u2588\u2554\u255d'));
  console.log(' ' + Co('\u2588\u2588\u2551   \u2588\u2588\u2551') + St(' \u2588\u2588\u2588\u2588\u2588\u2557  ') + Sk(' \u2588\u2588\u2588\u2588\u2588\u2554\u255d '));
  console.log(' ' + Co('\u255a\u2588\u2588\u2557 \u2588\u2588\u2554\u255d') + St(' \u2588\u2588\u2554\u2550\u2550\u255d  ') + Sk(' \u2588\u2588\u2554\u2550\u2588\u2588\u2557 '));
  console.log(' ' + Co(' \u255a\u2588\u2588\u2588\u2588\u2554\u255d ') + St(' \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557') + Sk(' \u2588\u2588\u2551  \u2588\u2588\u2557') + '  ' + W('\u2500 sync') + '  ' + Gr(`v${VERSION}`));
  console.log(' ' + Co('  \u255a\u2550\u2550\u2550\u255d  ') + St(' \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d') + Sk(' \u255a\u2550\u255d  \u255a\u2550\u255d'));
  console.log('');
  console.log('  ' + Si('sync MCP server configs across editors') + '  ' + Gr('\u00b7 Apache 2.0 \u00b7 github.com/Vektor-Memory/vek-sync'));
  console.log('');
}

const BAR = St('\u2502');
const TL  = St('\u250c\u2500');
const BL  = St('\u2514');
const HR  = St('\u2500');

function box(label) {
  const raw = label.replace(/\x1b\[[0-9;]*m/g, '');
  console.log('  ' + TL + ' ' + Ic(label) + ' ' + HR.repeat(Math.max(2, 44 - raw.length)));
}
function boxEnd() { console.log('  ' + BL + HR.repeat(47)); console.log(''); }
function row(label, value) {
  const raw = label.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = ' '.repeat(Math.max(1, 20 - raw.length));
  console.log('  ' + BAR + ' ' + label + pad + value);
}
function blank() { console.log('  ' + BAR); }

const [,, cmd, ...args] = process.argv;

function flag(name)    { return args.includes(`--${name}`); }
function opt(name)     { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i + 1] : null; }
function positional(i) { return args.filter(a => !a.startsWith('--'))[i]; }

function getMcpFile() {
  const f = opt('file') ?? mcpfile.findMcpFile();
  if (!f) { console.error('\n  ' + R('\u2717') + Gr('  No .mcp.json found \u2014 run: ') + Sk('vek-sync init') + '\n'); process.exit(1); }
  return f;
}

function getConnectors() {
  const only = opt('only');
  if (only) {
    const names = only.split(',').map(s => s.trim());
    const bad   = names.filter(n => !CONNECTORS[n]);
    if (bad.length) {
      console.error('\n  ' + R(`\u2717  Unknown connector(s): ${bad.join(', ')}`));
      console.error('     ' + Gr(`Valid: ${CONNECTOR_NAMES.join(', ')}`) + '\n');
      process.exit(1);
    }
    return Object.fromEntries(names.map(n => [n, CONNECTORS[n]]));
  }
  return CONNECTORS;
}

function existsSilent(p) { try { readFileSync(p); return true; } catch { return false; } }

function shortenPath(p) {
  const home = homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

const CONN_LABELS = {
  claudeDesktop: 'Claude Desktop',
  cursor:        'Cursor',
  vscode:        'VS Code',
  windsurf:      'Windsurf',
  claudeCode:    'Claude Code',
  cline:         'Cline',
  rooCode:       'Roo Code',
  gemini:        'Gemini CLI',
  copilot:       'GitHub Copilot CLI',
  continue:      'Continue',
  codex:         'Codex (OpenAI)',
};

// ── Original commands (unchanged) ─────────────────────────────────────────────

async function cmdInit() {
  const filePath    = opt('file') ?? resolve(process.cwd(), '.mcp.json');
  const description = opt('description') ?? '';
  const fromEditor  = opt('from');
  const fromUrl     = opt('from-url');
  try {
    mcpfile.init(filePath, description);
    console.log('\n  ' + G('\u2713') + Gr('  Created ') + Sk(filePath));
  } catch (err) {
    console.error('\n  ' + R(`\u2717  ${err.message}`) + '\n'); process.exit(1);
  }
  if (fromEditor) {
    if (!CONNECTORS[fromEditor]) {
      console.error('\n  ' + R(`\u2717  Unknown connector: ${fromEditor}`) + '\n  ' + Gr(`Valid: ${CONNECTOR_NAMES.join(', ')}`) + '\n');
      process.exit(1);
    }
    try {
      const partial = CONNECTORS[fromEditor].export();
      const base    = mcpfile.read(filePath);
      mcpfile.write(filePath, mcpfile.merge(base, partial));
      console.log('  ' + G('\u2713') + Gr('  Imported ') + W(String(Object.keys(partial.servers ?? {}).length)) + Gr(' server(s) from ') + Ic(fromEditor));
      if (partial.credentials && Object.keys(partial.credentials).length) {
        console.log('\n  ' + Y('\u26a0') + Gr(`  ${Object.keys(partial.credentials).length} credential(s) detected \u2014 store them:`));
        for (const k of Object.keys(partial.credentials)) console.log('     ' + Gr(`vek-sync vault set ${k} <value>`));
      }
    } catch (err) {
      console.error('\n  ' + R(`\u2717  Failed to import from ${fromEditor}: ${err.message}`) + '\n'); process.exit(1);
    }
  }
  if (fromUrl) {
    try {
      console.log('  ' + Gr('Fetching ') + Sk(fromUrl) + Gr('\u2026'));
      const res    = await fetch(fromUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text   = await res.text();
      const remote = JSON.parse(text);
      const base   = mcpfile.read(filePath);
      mcpfile.write(filePath, mcpfile.merge(base, remote));
      console.log('  ' + G('\u2713') + Gr('  Imported ') + W(String(Object.keys(remote.servers ?? {}).length)) + Gr(' server(s) from URL'));
    } catch (err) {
      console.error('\n  ' + R(`\u2717  Failed to fetch URL: ${err.message}`) + '\n'); process.exit(1);
    }
  }
  console.log('');
}

function cmdSync() {
  const filePath = getMcpFile();
  const conns    = getConnectors();
  const dry      = flag('dry-run');
  const watchMode = flag('watch');
  banner();
  function doSync() {
    const mcp = mcpfile.read(filePath);
    const resolved = resolveObject(mcp);
    box(dry ? 'SYNC PREVIEW' : 'SYNC');
    let changed = 0;
    for (const [name, conn] of Object.entries(conns)) {
      try {
        const label = CONN_LABELS[name] ?? name;
        if (dry) {
          if (typeof conn.diff === 'function') {
            const result = conn.diff(resolved);
            if (result.changed) { changed++; row(Y('\u25b2') + ' ' + W(label), Gr('would change')); }
            else { row(Gr('\u2013') + ' ' + Si(label), Gr('in sync')); }
          } else {
            const st = conn.status();
            row(Gr('\u2013') + ' ' + Si(label), st.exists ? Sk(shortenPath(st.path ?? '')) + Gr(' (no diff)') : Gr('not configured'));
          }
        } else {
          const servers = resolved.servers ?? {};
          const result = conn.sync(servers, (k) => resolved.credentials?.[k] ?? k);
          changed++; row(G('\u2713') + ' ' + W(label), Gr(`synced ${result?.synced ?? '?'} server(s)`));
        }
      } catch (err) { row(R('\u2717') + ' ' + W(CONN_LABELS[name] ?? name), R(err.message)); }
    }
    blank();
    if (dry) console.log('  ' + BAR + '  ' + Y(`\u26a0  dry run \u2014 ${changed} connector(s) would change. Run without --dry-run to apply.`));
    else     console.log('  ' + BAR + '  ' + G(`\u2713  synced ${changed} connector(s)`));
    boxEnd();
  }
  doSync();
  if (watchMode) {
    console.log('  ' + Gr('Watching ') + Sk(filePath) + Gr(' for changes\u2026\n'));
    watch(filePath, () => { console.log('  ' + Sk('\u2192') + Gr('  change detected, re-syncing\u2026')); doSync(); });
  }
}

function cmdExport() {
  const filePath = getMcpFile();
  banner();
  const mcp = mcpfile.read(filePath);
  box('EXPORT');
  row(Si('file'), Sk(shortenPath(filePath)));
  row(Si('servers'), W(String(Object.keys(mcp.servers ?? {}).length)));
  boxEnd();
  console.log(JSON.stringify(mcp, null, 2));
}

function cmdStatus() {
  const filePath = getMcpFile();
  const conns    = getConnectors();
  banner();
  const mcp = mcpfile.read(filePath);
  box('STATUS');
  row(Si('source'), Sk(shortenPath(filePath)));
  row(Si('servers'), W(String(Object.keys(mcp.servers ?? {}).length)));
  blank();
  for (const [name, conn] of Object.entries(conns)) {
    try {
      const st    = conn.status();
      const label = CONN_LABELS[name] ?? name;
      const icon  = st.exists ? (st.inSync ? G('\u2713') : Y('\u25cb')) : Gr('\u2013');
      row(icon + ' ' + (st.exists ? W(label) : Si(label)), st.exists ? Sk(shortenPath(st.path)) + (st.inSync ? Gr(' (in sync)') : Y(' (out of sync)')) : Gr('not configured'));
    } catch (err) { row(R('\u2717') + ' ' + W(CONN_LABELS[name] ?? name), R(err.message)); }
  }
  boxEnd();
}

function cmdDiff() {
  const filePath = getMcpFile();
  const conns    = getConnectors();
  banner();
  const mcp      = mcpfile.read(filePath);
  const resolved = resolveObject(mcp);
  box('DIFF');
  for (const [name, conn] of Object.entries(conns)) {
    try {
      const label = CONN_LABELS[name] ?? name;
      if (typeof conn.diff === 'function') {
        const result = conn.diff(resolved);
        if (result.changed) {
          row(Y('\u25b2') + ' ' + W(label), Sk(shortenPath(result.path ?? '')));
          if (result.added)   console.log('  ' + BAR + '    ' + G(`  +${result.added} server(s) to add`));
          if (result.removed) console.log('  ' + BAR + '    ' + R(`  -${result.removed} server(s) to remove`));
        } else { row(Gr('\u2013') + ' ' + Si(label), Gr('in sync')); }
      } else {
        const st = conn.status();
        row(Gr('\u2013') + ' ' + Si(label), st.exists ? Sk(shortenPath(st.path ?? '')) + Gr(' (diff N/A)') : Gr('not configured'));
      }
    } catch (err) { row(R('\u2717') + ' ' + W(CONN_LABELS[name] ?? name), R(err.message)); }
  }
  boxEnd();
}

async function cmdAdd() {
  const name     = positional(0);
  const urlArg   = opt('url');
  if (!name && !urlArg) {
    banner();
    console.error('  ' + R('\u2717  Usage: vek-sync add <name|npm-package> [--url <mcp-url>]') + '\n'); process.exit(1);
  }
  const filePath = getMcpFile();
  banner();
  const mcp = mcpfile.read(filePath);
  if (urlArg) {
    mcp.servers = mcp.servers ?? {};
    mcp.servers[name ?? urlArg] = { url: urlArg };
    mcpfile.write(filePath, mcp);
    console.log('  ' + G('\u2713') + Gr('  Added HTTP server ') + W(name ?? urlArg) + Gr(' \u2192 ') + Sk(urlArg) + '\n');
    return;
  }
  try {
    const results = await searchNpm(name);
    if (!results.length) { console.log('  ' + Y('\u26a0') + Gr(`  No npm package found for "${name}"`) + '\n'); return; }
    const pkg = results[0];
    mcp.servers = mcp.servers ?? {};
    mcp.servers[pkg.name] = { command: 'npx', args: ['-y', pkg.name] };
    mcpfile.write(filePath, mcp);
    console.log('  ' + G('\u2713') + Gr('  Added ') + W(pkg.name) + Gr(' via npx') + '\n');
  } catch (err) {
    console.error('  ' + R(`\u2717  ${err.message}`) + '\n'); process.exit(1);
  }
}

async function cmdPing() {
  const filePath = getMcpFile();
  banner();
  const mcp = mcpfile.read(filePath);
  box('PING');
  for (const [name, cfg] of Object.entries(mcp.servers ?? {})) {
    try {
      const result = cfg.url ? await pingHttp(cfg.url) : await pingStdio(cfg.command, cfg.args ?? [], cfg.env ?? {});
      const ok = typeof result === 'boolean' ? result : result?.ok;
      const ms = result?.ms ? Gr(` ${result.ms}ms`) : '';
      row((ok ? G('\u2713') : R('\u2717')) + ' ' + W(name), (ok ? G('online') : R('offline')) + ms);
    } catch (err) { row(R('\u2717') + ' ' + W(name), R(err.message)); }
  }
  boxEnd();
}

async function cmdShare() {
  const filePath = getMcpFile();
  banner();
  const mcp = mcpfile.read(filePath);
  const sanitised = JSON.parse(JSON.stringify(mcp));
  for (const cfg of Object.values(sanitised.servers ?? {})) {
    if (cfg.env) for (const k of Object.keys(cfg.env)) cfg.env[k] = `<${k}>`;
  }
  delete sanitised.credentials;
  box('SHARE');
  console.log(JSON.stringify(sanitised, null, 2));
  boxEnd();
}

async function cmdProfile() {
  const sub      = positional(0);
  const name     = positional(1);
  const filePath = opt('file') ?? mcpfile.findMcpFile() ?? resolve(process.cwd(), '.mcp.json');
  const profileDir = join(homedir(), '.vek-sync', 'profiles');
  banner();
  if (sub === 'save') {
    if (!name) { console.error('  ' + R('\u2717  Usage: vek-sync profile save <name>') + '\n'); process.exit(1); }
    const src = existsSilent(filePath) ? readFileSync(filePath, 'utf8') : '{}';
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(join(profileDir, `${name}.json`), src);
    console.log('  ' + G('\u2713') + Gr('  Profile saved: ') + W(name) + '\n');
  } else if (sub === 'use') {
    if (!name) { console.error('  ' + R('\u2717  Usage: vek-sync profile use <name>') + '\n'); process.exit(1); }
    const src = join(profileDir, `${name}.json`);
    if (!existsSilent(src)) { console.error('  ' + R(`\u2717  Profile not found: ${name}`) + '\n'); process.exit(1); }
    writeFileSync(filePath, readFileSync(src, 'utf8'));
    console.log('  ' + G('\u2713') + Gr('  Switched to profile: ') + W(name) + '\n');
  } else if (sub === 'list') {
    try {
      const files = readdirSync(profileDir).filter(f => f.endsWith('.json'));
      box('PROFILES');
      for (const f of files) row(Si(f.replace('.json', '')), Gr(join(profileDir, f)));
      boxEnd();
    } catch { console.log('  ' + Gr('No profiles saved yet.') + '\n'); }
  } else {
    console.error('  ' + R('\u2717  Usage: vek-sync profile save|use|list <name>') + '\n'); process.exit(1);
  }
}

async function cmdSearch() {
  const query = positional(0);
  banner();
  if (!query) { console.error('  ' + R('\u2717  Usage: vek-sync search <query>') + '\n'); process.exit(1); }
  box(`SEARCH: ${query}`);
  try {
    const curated = searchCurated(query);
    const npm     = await searchNpm(query);
    const results = [...curated, ...npm].slice(0, 10);
    if (!results.length) { console.log('  ' + BAR + '  ' + Gr('No results found.')); }
    for (const r of results) {
      row(W(r.name), Gr(r.description ?? ''));
      if (r.url)      console.log('  ' + BAR + '    ' + Sk(r.url));
      if (r.install)  console.log('  ' + BAR + '    ' + Ic(r.install));
    }
    boxEnd();
    if (results.length) console.log('  ' + Gr('Run ') + Sk(`vek-sync add ${results[0].name}`) + Gr(' to add.\n'));
  } catch (err) {
    console.error('  ' + R(`\u2717  ${err.message}`) + '\n'); process.exit(1);
  }
}

function cmdVault() {
  const sub   = positional(0);
  const key   = positional(1);
  const value = positional(2);
  banner();
  if (sub === 'set') {
    if (!key || !value) { console.error('  ' + R('\u2717  Usage: vek-sync vault set <key> <value>') + '\n'); process.exit(1); }
    vault.set(key, value);
    console.log('  ' + G('\u2713') + Gr(`  Vault: set ${key}`) + '\n');
  } else if (sub === 'get') {
    if (!key) { console.error('  ' + R('\u2717  Usage: vek-sync vault get <key>') + '\n'); process.exit(1); }
    const val = vault.get(key);
    if (val == null) { console.log('  ' + Y(`\u26a0  ${key} not found in vault`) + '\n'); }
    else console.log('  ' + W(key) + ': ' + Sk(val) + '\n');
  } else if (sub === 'delete') {
    if (!key) { console.error('  ' + R('\u2717  Usage: vek-sync vault delete <key>') + '\n'); process.exit(1); }
    vault.remove(key);
    console.log('  ' + G('\u2713') + Gr(`  Vault: deleted ${key}`) + '\n');
  } else if (sub === 'list') {
    const keys = vault.list();
    box('VAULT KEYS');
    if (!keys.length) console.log('  ' + BAR + '  ' + Gr('(empty)'));
    for (const k of keys) row(Si(k), Gr('***'));
    boxEnd();
  } else {
    console.error('  ' + R('\u2717  Usage: vek-sync vault set|get|delete|list') + '\n'); process.exit(1);
  }
}

function cmdHelp() {
  banner();
  box('COMMANDS');
  row(W('init'),    Sk('vek-sync init')    + Gr('  [--from <connector>] [--from-url <url>]'));
  row(W('sync'),    Sk('vek-sync sync')    + Gr('  [--dry-run] [--watch] [--only <name,...>]'));
  row(W('status'),  Sk('vek-sync status')  + Gr('  show sync state across all editors'));
  row(W('diff'),    Sk('vek-sync diff')    + Gr('  show what sync would change'));
  row(W('export'),  Sk('vek-sync export')  + Gr('  print .mcp.json as JSON'));
  row(W('add'),     Sk('vek-sync add')     + Gr('  <name|package> [--url <mcp-url>]'));
  row(W('ping'),    Sk('vek-sync ping')    + Gr('  health-check all configured servers'));
  row(W('share'),   Sk('vek-sync share')   + Gr('  print sanitised config (safe to share)'));
  row(W('profile'), Sk('vek-sync profile') + Gr('  save|use|list  named config snapshots'));
  row(W('search'),  Sk('vek-sync search')  + Gr('  <query>  find MCP servers'));
  row(W('vault'),   Sk('vek-sync vault')   + Gr('  set|get|delete|list  manage secrets'));
  boxEnd();

  box('OPTIONS');
  row(Sk('--file') +        Gr(' <path>'),      Si('path to .mcp.json'));
  row(Sk('--only') +        Gr(' <name,...>'),  Si('limit to specific connector(s)'));
  row(Sk('--from') +        Gr(' <connector>'), Si('init: seed from an editor config'));
  row(Sk('--from-url') +    Gr(' <url>'),       Si('init: seed from a shared URL'));
  row(Sk('--dry-run'),                           Si('sync: preview changes without writing'));
  row(Sk('--watch'),                             Si('sync: re-sync on .mcp.json change'));
  row(Sk('--description') + Gr(' <text>'),      Si('init: description field'));
  boxEnd();

  box('CONNECTORS');
  const desc = {
    claudeDesktop: 'Claude Desktop app',
    cursor:        'Cursor editor',
    vscode:        'VS Code  (.vscode/mcp.json)',
    windsurf:      'Windsurf by Codeium',
    claudeCode:    'Claude Code CLI',
    cline:         'Cline  (saoudrizwan.claude-dev)',
    rooCode:       'Roo Code  (rooveterinaryinc.roo-cline)',
    gemini:        'Gemini CLI',
    copilot:       'GitHub Copilot CLI',
    continue:      'Continue  (continue.continue) \u2014 array format',
    codex:         'Codex CLI  \u2014 TOML format',
  };
  for (const name of CONNECTOR_NAMES) row(G('\u2713') + ' ' + W(name), Si(desc[name] ?? ''));
  boxEnd();

  box('EXAMPLES');
  blank();
  console.log('  ' + BAR + '  ' + Gr('# Bootstrap from Cursor, push everywhere'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync init --from cursor && vek-sync sync'));
  blank();
  console.log('  ' + BAR + '  ' + Gr('# Preview what sync would change'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync sync --dry-run'));
  blank();
  console.log('  ' + BAR + '  ' + Gr('# Watch mode \u2014 auto-sync on save'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync sync --watch'));
  blank();
  console.log('  ' + BAR + '  ' + Gr('# Find and add a server from the registry'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync search filesystem'));
  blank();
  console.log('  ' + BAR + '  ' + Gr('# Health-check all configured servers'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync ping'));
  blank();
  console.log('  ' + BAR + '  ' + Gr('# Save a named profile, switch later'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync profile save work'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync profile use personal'));
  blank();
  console.log('  ' + BAR + '  ' + Gr('# Share config with a teammate'));
  console.log('  ' + BAR + '  ' + Sk('vek-sync share'));
  blank();
  boxEnd();
}

// ── Ink TUI ──────────────────────────────────────────────────────────────────
async function launchTUI() {
  const ink                      = await import('ink');
  const { render, Box, Text, useApp, useInput } = ink;
  const { default: SelectInput } = await import('ink-select-input');
  const { default: TextInput }   = await import('ink-text-input');
  const React                    = await import('react');
  const { useState }             = React;
  const h = React.createElement;

  const COMMANDS = {
    init:    'Create .mcp.json and optionally seed from an editor',
    sync:    'Push .mcp.json to all configured editors',
    status:  'Show sync state across all editors',
    diff:    'Preview what sync would change',
    export:  'Print .mcp.json as JSON',
    add:     'Add an MCP server by name or URL',
    ping:    'Health-check all configured servers',
    share:   'Print sanitised config safe to share',
    profile: 'Save, switch, or list named config snapshots',
    search:  'Find MCP servers in the registry',
    vault:   'Manage secrets (set/get/delete/list)',
  };

  const Header = ({ cmd }) => h(Box, { flexDirection:'column', paddingLeft:2, paddingBottom:1 },
    h(Text, { color:'cyan', bold:true }, 'vek-sync ' + cmd),
    h(Text, { color:'gray', dimColor:true }, COMMANDS[cmd] || '')
  );

  const Footer = () => h(Text, { color:'gray', dimColor:true, marginLeft:2 }, 'esc to go back');

  const Ask = ({ prompt, placeholder, hint, onSubmit, onBack }) => {
    const [val, setVal] = useState('');
    useInput((_, key) => { if (key.escape) onBack(); });
    return h(Box, { flexDirection:'column', paddingLeft:2 },
      h(Text, { color:'cyan' }, prompt),
      hint && h(Text, { color:'gray', dimColor:true }, hint),
      h(Box, { marginTop:1 },
        h(Text, { color:'cyan' }, '> '),
        h(TextInput, { value:val, placeholder, onChange:setVal,
          onSubmit: v => { if(v.trim()) onSubmit(v.trim()); }
        })
      ),
      h(Text, { color:'gray', dimColor:true }, 'enter to confirm   esc to go back')
    );
  };

  const WIZARDS = {

    init: ({ onRun, onBack }) => {
      const [step, setStep] = useState('action');
      useInput((_, key) => { if (key.escape) step === 'action' ? onBack() : setStep('action'); });
      const seedItems = [
        { label:'No seed — start blank',                     value:[] },
        { label:'Seed from Claude Desktop',                  value:['--from','claudeDesktop'] },
        { label:'Seed from Cursor',                          value:['--from','cursor'] },
        { label:'Seed from VS Code',                         value:['--from','vscode'] },
        { label:'Seed from Windsurf',                        value:['--from','windsurf'] },
        { label:'Seed from Claude Code',                     value:['--from','claudeCode'] },
        { label:'Seed from a URL →',                         value:'__url' },
      ];
      if (step === 'action') return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'init' }),
        h(Text, { color:'cyan', marginLeft:2, marginBottom:1 }, 'Seed config from which editor?'),
        h(SelectInput, { items: seedItems, onSelect: item => {
          if (item.value === '__url') setStep('url');
          else onRun(item.value);
        }}),
        h(Footer, null)
      );
      return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'init' }),
        h(Ask, { prompt:'URL to seed from?',
          placeholder:'https://example.com/mcp.json',
          onSubmit: v => onRun(['--from-url', v]),
          onBack: () => setStep('action') })
      );
    },

    sync: ({ onRun, onBack }) => {
      useInput((_, key) => { if (key.escape) onBack(); });
      return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'sync' }),
        h(Text, { color:'cyan', marginLeft:2, marginBottom:1 }, 'How do you want to sync?'),
        h(SelectInput, { items:[
          { label:'Sync to all editors  (recommended)', value:[] },
          { label:'Dry run — preview changes only',      value:['--dry-run'] },
          { label:'Watch mode — auto-sync on save',      value:['--watch'] },
          { label:'Sync specific editor only →',         value:'__only' },
        ], onSelect: item => item.value === '__only' ? null : onRun(item.value) }),
        h(Footer, null)
      );
    },

    add: ({ onRun, onBack }) => {
      const [step, setStep] = useState('method');
      useInput((_, key) => { if (key.escape) step === 'method' ? onBack() : setStep('method'); });
      if (step === 'method') return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'add' }),
        h(SelectInput, { items:[
          { label:'Add by npm package name', value:'npm' },
          { label:'Add by HTTP URL',          value:'url' },
        ], onSelect: item => setStep(item.value) }),
        h(Footer, null)
      );
      if (step === 'npm') return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'add' }),
        h(Ask, { prompt:'npm package name?',
          placeholder:'e.g. @modelcontextprotocol/server-filesystem',
          onSubmit: v => onRun([v]),
          onBack: () => setStep('method') })
      );
      return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'add' }),
        h(Ask, { prompt:'Server name?', placeholder:'my-server',
          onSubmit: v => setStep('url_' + v),
          onBack: () => setStep('method') })
      );
    },

    search: ({ onRun, onBack }) => {
      useInput((_, key) => { if (key.escape) onBack(); });
      return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'search' }),
        h(Ask, { prompt:'Search for an MCP server:',
          placeholder:'e.g. filesystem  or  github  or  postgres',
          hint:'searches curated registry + npm',
          onSubmit: v => onRun([v]),
          onBack })
      );
    },

    vault: ({ onRun, onBack }) => {
      const [step, setStep]   = useState('action');
      const [action, setAct]  = useState('');
      const [key, setKey]     = useState('');
      useInput((_, key) => { if (key.escape) step === 'action' ? onBack() : setStep('action'); });
      if (step === 'action') return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'vault' }),
        h(SelectInput, { items:[
          { label:'List all vault keys',  value:'list' },
          { label:'Get a secret',         value:'get' },
          { label:'Set a secret',         value:'set' },
          { label:'Delete a secret',      value:'delete' },
        ], onSelect: item => {
          setAct(item.value);
          if (item.value === 'list') onRun(['list']);
          else setStep('key');
        }}),
        h(Footer, null)
      );
      if (step === 'key') return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'vault' }),
        h(Ask, { prompt:'Key name?', placeholder:'e.g. OPENAI_API_KEY',
          onSubmit: v => { setKey(v); action === 'get' || action === 'delete' ? onRun([action, v]) : setStep('value'); },
          onBack: () => setStep('action') })
      );
      return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'vault' }),
        h(Ask, { prompt:`Value for "${key}"?`, placeholder:'paste secret here',
          hint:'stored encrypted in ~/.vek-sync/vault',
          onSubmit: v => onRun(['set', key, v]),
          onBack: () => setStep('key') })
      );
    },

    profile: ({ onRun, onBack }) => {
      const [step, setStep] = useState('action');
      const [action, setAct] = useState('');
      useInput((_, key) => { if (key.escape) step === 'action' ? onBack() : setStep('action'); });
      if (step === 'action') return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'profile' }),
        h(SelectInput, { items:[
          { label:'List saved profiles',   value:'list' },
          { label:'Save current config →', value:'save' },
          { label:'Switch to a profile →', value:'use' },
        ], onSelect: item => {
          setAct(item.value);
          if (item.value === 'list') onRun(['list']);
          else setStep('name');
        }}),
        h(Footer, null)
      );
      return h(Box, { flexDirection:'column' },
        h(Header, { cmd:'profile' }),
        h(Ask, { prompt: action === 'save' ? 'Profile name to save as?' : 'Profile name to switch to?',
          placeholder:'e.g. work  or  personal',
          onSubmit: v => onRun([action, v]),
          onBack: () => setStep('action') })
      );
    },

    ping:   ({ onRun, onBack }) => { const { useEffect } = React; useInput((_, k) => { if (k.escape) onBack(); }); useEffect(() => { onRun([]); }, []); return h(Box, { padding:1 }, h(Text, { color:'cyan' }, '  pinging servers...')); },
    status: ({ onRun, onBack }) => { const { useEffect } = React; useInput((_, k) => { if (k.escape) onBack(); }); useEffect(() => { onRun([]); }, []); return h(Box, { padding:1 }, h(Text, { color:'cyan' }, '  checking status...')); },
    diff:   ({ onRun, onBack }) => { const { useEffect } = React; useInput((_, k) => { if (k.escape) onBack(); }); useEffect(() => { onRun([]); }, []); return h(Box, { padding:1 }, h(Text, { color:'cyan' }, '  computing diff...')); },
    export: ({ onRun, onBack }) => { const { useEffect } = React; useInput((_, k) => { if (k.escape) onBack(); }); useEffect(() => { onRun([]); }, []); return h(Box, { padding:1 }, h(Text, { color:'cyan' }, '  exporting...')); },
    share:  ({ onRun, onBack }) => { const { useEffect } = React; useInput((_, k) => { if (k.escape) onBack(); }); useEffect(() => { onRun([]); }, []); return h(Box, { padding:1 }, h(Text, { color:'cyan' }, '  preparing share...')); },
  };

  const VekSyncApp = () => {
    const { exit }            = useApp();
    const [screen, setScreen] = useState('palette');
    const [selectedCmd, setSel] = useState(null);
    useInput(input => { if (input === 'q' && screen === 'palette') exit(); });

    const items = Object.entries(COMMANDS).map(([k, v]) => ({
      label: k.padEnd(12) + ' ' + v, value: k
    }));

    const runCmd = async (selectedCmd, args) => {
      exit();
      await new Promise(r => setTimeout(r, 80));
      const { default: child } = await import('child_process');
      child.spawnSync(process.execPath, [process.argv[1], selectedCmd, ...args],
        { stdio:'inherit', shell: false });
    };

    if (screen === 'palette') return h(Box, { flexDirection:'column', paddingTop:1 },
      h(Text, { color:'gray', dimColor:true, marginLeft:2 }, 'up/down  enter=select  q=quit'),
      h(Box, { marginTop:1 },
        h(SelectInput, { items,
          onSelect: item => { setSel(item.value); setScreen('wizard'); }
        })
      )
    );

    if (screen === 'wizard' && selectedCmd && WIZARDS[selectedCmd]) {
      const Wizard = WIZARDS[selectedCmd];
      return h(Wizard, {
        onRun:  (args) => { setScreen('done'); runCmd(selectedCmd, args); },
        onBack: () => setScreen('palette'),
      });
    }
    return h(Box, { padding:1 }, h(Text, { color:'cyan' }, '  running vek-sync ' + selectedCmd + '...'));
  };

  banner();
  render(h(VekSyncApp, null));
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
if (!cmd && process.stdout.isTTY && !process.env.CI) {
  await launchTUI();
} else {
  switch (cmd) {
    case 'init':    await cmdInit();    break;
    case 'sync':          cmdSync();    break;
    case 'export':        cmdExport();  break;
    case 'status':        cmdStatus();  break;
    case 'diff':          cmdDiff();    break;
    case 'add':     await cmdAdd();     break;
    case 'ping':    await cmdPing();    break;
    case 'share':   await cmdShare();   break;
    case 'profile':       cmdProfile(); break;
    case 'search':  await cmdSearch();  break;
    case 'vault':         cmdVault();   break;
    case '--version':
    case '-v':            console.log(`vek-sync v${VERSION}`); break;
    case 'help':
    case '--help':
    case '-h':            cmdHelp();    break;
    default:
      banner();
      console.error('  ' + R(`\u2717  Unknown command: ${cmd ?? '(none)'}`) + '  ' + Gr('\u00b7 run vek-sync help') + '\n');
      process.exit(1);
  }
}
