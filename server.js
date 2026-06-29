import express from 'express';
import Docker from 'dockerode';
import si from 'systeminformation';
import cors from 'cors';
import { exec, spawn, execSync } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import expressWs from 'express-ws';
import pty from 'node-pty';
import yaml from 'js-yaml';
import multer from 'multer';
import axios from 'axios';
import session from 'express-session';
import * as cheerio from 'cheerio';
import { getProxyHandler, getImageProxyHandler, getActionHandler } from './server/proxyHandlers.js';
import * as userManager from './server/userManager.js';
import * as roleManager from './server/roleManager.js';
import { requireAuth, requirePermission, requireAnyPermission, attachUser } from './server/middleware.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import crypto from 'crypto';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Icon management
const CUSTOM_ICONS_DIR = join(__dirname, 'public', 'icons', 'custom');

// Ensure custom icons directory exists
if (!fs.existsSync(CUSTOM_ICONS_DIR)) fs.mkdirSync(CUSTOM_ICONS_DIR, { recursive: true });

// Extract base app name by removing common suffixes
function getBaseAppName(name) {
  const lower = name.toLowerCase();
  
  // Known base app names (apps that should never have suffixes removed)
  const knownApps = [
    'speedtest', 'plex', 'sonarr', 'radarr', 'lidarr', 'readarr', 'prowlarr',
    'qbittorrent', 'sabnzbd', 'nzbget', 'deluge', 'transmission',
    'overseerr', 'ombi', 'jellyseerr', 'tautulli',
    'jellyfin', 'emby', 'portainer', 'nzbhydra2', 'jackett', 'bazarr',
    'autoscan', 'pyload', 'rclone', 'syncthing', 'watchtower'
  ];
  
  // If it's a known app name, don't try to remove suffixes
  if (knownApps.includes(lower)) {
    return lower;
  }
  
  // Common suffixes to remove (order matters - try longer patterns first)
  // Only remove if the remaining part is at least 3 characters
  const suffixes = [
    '4k', '4khdr', 'uhd',
    'anime', 'animes',
    'mux', 'muxer',
    'tv', 'television',
    'movies', 'movie',
    'music', 'audio',
    'books', 'book',
    'downloads', 'download',
    'requests', 'request',
    'indexer', 'indexers',
    'proxy', 'proxies',
    'testing', 'dev', 'development', // Note: 'test' removed to avoid breaking 'speedtest'
    'staging', 'prod', 'production',
    'backup', 'backups',
    'old', 'new', 'v2', 'v3', 'legacy'
  ];
  
  // Try to find and remove suffix, but only if remaining part is valid
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) {
      const base = lower.slice(0, -suffix.length);
      // Only remove suffix if base is at least 3 chars and not empty
      if (base.length >= 3) {
        // Check if base matches a known app (for cases like sonarr-test -> sonarr)
        if (knownApps.some(app => app.startsWith(base) || base.startsWith(app))) {
          return base;
        }
        // Also allow if base ends with a known app name pattern
        for (const app of knownApps) {
          if (base.endsWith(app) || app.endsWith(base)) {
            return base;
          }
        }
      }
    }
  }
  
  return lower;
}

// Normalize app name for icon matching
function normalizeAppName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/sandbox-/g, '')
    .replace(/saltbox-/g, '')
    .replace(/sandbox/g, '')
    .replace(/saltbox/g, '')
    .trim();
}

// Helper function to check for custom icon with both hyphen and underscore variants
function findCustomIcon(normalizedName) {
  const customExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.svg'];
  for (const ext of customExtensions) {
    // Try hyphen version first
    const customPath = join(CUSTOM_ICONS_DIR, `${normalizedName}${ext}`);
    if (fs.existsSync(customPath)) {
      return `/icons/custom/${normalizedName}${ext}`;
    }
    // Also try with underscores instead of hyphens (for files like fireflyiii_importer.svg)
    const underscoreVersion = normalizedName.replace(/-/g, '_');
    if (underscoreVersion !== normalizedName) {
      const customPathUnderscore = join(CUSTOM_ICONS_DIR, `${underscoreVersion}${ext}`);
      if (fs.existsSync(customPathUnderscore)) {
        return `/icons/custom/${underscoreVersion}${ext}`;
      }
    }
  }
  return null;
}

// Get icon path for an app
function getAppIconPath(appName) {
  const normalized = normalizeAppName(appName);
  
  // Check custom icons first (try webp, then png, jpg, jpeg, svg)
  const customIcon = findCustomIcon(normalized);
  if (customIcon) {
    return customIcon;
  }
  
  // If no custom icon found, try base app name (for variants like sonarr4k, sonarranime)
  const baseName = getBaseAppName(appName);
  const baseNormalized = normalizeAppName(baseName);
  if (baseNormalized !== normalized) {
    // Try custom icon with base name
    const baseCustomIcon = findCustomIcon(baseNormalized);
    if (baseCustomIcon) {
      return baseCustomIcon;
    }
    // Use base name for CDN URL
    return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${baseNormalized}.webp`;
  }
  
  // If no match found and name contains hyphens, try matching with name before first hyphen
  if (appName.includes('-')) {
    const beforeHyphen = appName.split('-')[0];
    const beforeHyphenNormalized = normalizeAppName(beforeHyphen);
    
    // Try custom icons with name before hyphen
    const beforeHyphenCustomIcon = findCustomIcon(beforeHyphenNormalized);
    if (beforeHyphenCustomIcon) {
      return beforeHyphenCustomIcon;
    }
    
    // Try base app name for name before hyphen
    const beforeHyphenBaseName = getBaseAppName(beforeHyphen);
    const beforeHyphenBaseNormalized = normalizeAppName(beforeHyphenBaseName);
    if (beforeHyphenBaseNormalized !== beforeHyphenNormalized) {
      // Try custom icon with base name
      const beforeHyphenBaseCustomIcon = findCustomIcon(beforeHyphenBaseNormalized);
      if (beforeHyphenBaseCustomIcon) {
        return beforeHyphenBaseCustomIcon;
      }
      // Use base name for CDN URL
      return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${beforeHyphenBaseNormalized}.webp`;
    }
    
    // Return CDN URL for name before hyphen
    return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${beforeHyphenNormalized}.webp`;
  }
  
  // If no match found and name ends with a number, try matching with name before the number
  const numberMatch = normalized.match(/^(.+?)(\d+)$/);
  if (numberMatch) {
    const beforeNumber = numberMatch[1];
    const beforeNumberNormalized = normalizeAppName(beforeNumber);
    
    // Try custom icons with name before number
    const beforeNumberCustomIcon = findCustomIcon(beforeNumberNormalized);
    if (beforeNumberCustomIcon) {
      return beforeNumberCustomIcon;
    }
    
    // Try base app name for name before number
    const beforeNumberBaseName = getBaseAppName(beforeNumber);
    const beforeNumberBaseNormalized = normalizeAppName(beforeNumberBaseName);
    if (beforeNumberBaseNormalized !== beforeNumberNormalized) {
      // Try custom icon with base name
      const beforeNumberBaseCustomIcon = findCustomIcon(beforeNumberBaseNormalized);
      if (beforeNumberBaseCustomIcon) {
        return beforeNumberBaseCustomIcon;
      }
      // Use base name for CDN URL
      return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${beforeNumberBaseNormalized}.webp`;
    }
    
    // Return CDN URL for name before number
    return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${beforeNumberNormalized}.webp`;
  }
  
  // If no match found and name ends with known suffixes (4k, anime, mux, etc.), try matching with name before suffix
  const knownSuffixes = ['4k', '4khdr', 'uhd', 'anime', 'animes', 'mux', 'muxer', 'tv', 'television', 
    'movies', 'movie', 'music', 'audio', 'books', 'book', 'downloads', 'download', 'requests', 'request',
    'indexer', 'indexers', 'proxy', 'proxies', 'testing', 'dev', 'development', 'staging', 'prod', 
    'production', 'backup', 'backups', 'old', 'new', 'v2', 'v3', 'legacy'];
  
  // Try to match by removing suffixes from the end (check longer suffixes first)
  const sortedSuffixes = [...knownSuffixes].sort((a, b) => b.length - a.length);
  for (const suffix of sortedSuffixes) {
    // Check if normalized name ends with the suffix (with optional hyphen before it)
    // Handle both cases: "radarr4k" and "radarr-4k" after normalization
    const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixPattern = new RegExp(`(-|)${escapedSuffix}$`, 'i');
    if (suffixPattern.test(normalized)) {
      const beforeSuffix = normalized.replace(suffixPattern, '').replace(/-+$/, '');
      if (beforeSuffix.length >= 3) {
        const beforeSuffixNormalized = normalizeAppName(beforeSuffix);
        
        // Try custom icons with name before suffix
        const beforeSuffixCustomIcon = findCustomIcon(beforeSuffixNormalized);
        if (beforeSuffixCustomIcon) {
          return beforeSuffixCustomIcon;
        }
        
        // Try base app name for name before suffix
        const beforeSuffixBaseName = getBaseAppName(beforeSuffix);
        const beforeSuffixBaseNormalized = normalizeAppName(beforeSuffixBaseName);
        if (beforeSuffixBaseNormalized !== beforeSuffixNormalized) {
          // Try custom icon with base name
          const beforeSuffixBaseCustomIcon = findCustomIcon(beforeSuffixBaseNormalized);
          if (beforeSuffixBaseCustomIcon) {
            return beforeSuffixBaseCustomIcon;
          }
          // Use base name for CDN URL
          return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${beforeSuffixBaseNormalized}.webp`;
        }
        
        // Return CDN URL for name before suffix
        return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${beforeSuffixNormalized}.webp`;
      }
    }
  }
  
  // Return primary CDN URL from jsDelivr (homarr-labs)
  return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/webp/${normalized}.webp`;
}

// Get fallback icon URL
function getFallbackIconUrl(appName) {
  const normalized = normalizeAppName(appName);
  // Try base app name for variants
  const baseName = getBaseAppName(appName);
  const baseNormalized = normalizeAppName(baseName);
  const iconName = (baseNormalized !== normalized) ? baseNormalized : normalized;
  return `https://cdn.jsdelivr.net/gh/selfhst/icons/webp/${iconName}.webp`;
}

// Extract base image name from Docker image string
// Handles formats like: "ghcr.io/hotio/sonarr", "postgres:latest", "library/postgres:14", "docker.io/library/postgres:latest"
function extractBaseImageName(imageName) {
  if (!imageName) return null;
  
  // Remove registry prefix (e.g., "ghcr.io/", "docker.io/", "registry.example.com/")
  let base = imageName.split('/').pop();
  
  // Remove tag (e.g., ":latest", ":14", ":v1.0.0")
  base = base.split(':')[0];
  
  // Remove digest (e.g., "@sha256:...")
  base = base.split('@')[0];
  
  return base;
}



// Helper to wrap a command to run via SSH on the host system
// Uses single quotes to pass the command verbatim to the remote shell
function buildSshCommand(command) {
  const sshUser = process.env.SSH_USER;
  const sshHost = process.env.SSH_HOST || 'host.docker.internal';
  if (!sshUser) throw new Error('SSH_USER not configured');
  // Escape single quotes in command: replace ' with '\''
  const escaped = command.replace(/'/g, "'\\''");
  return `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ${sshUser}@${sshHost} '${escaped}'`;
}

// Function to strip ANSI escape codes from text
// Based on ANSI escape sequence specifications and common patterns
function stripAnsi(text) {
  if (!text) return text;
  
  // Convert to string if it's a buffer
  if (Buffer.isBuffer(text)) {
    text = text.toString('utf8');
  }
  
  // Remove ANSI escape sequences using comprehensive patterns
  // Reference: ANSI escape codes - ESC[ followed by parameters and final character
  // Based on: sed 's/\x1b\[[0-9;]*[mGKH]//g' pattern
  let cleaned = text
    // Remove CSI sequences (Control Sequence Introducer) - most common format
    // ESC[ followed by [0-9;]* parameters and final character
    // m = Graphics Rendition Mode (colors), G = Horizontal cursor move, K = Horizontal deletion, H = New cursor position
    .replace(/\x1b\[[0-9;]*[mGKH]/g, '')
    // Remove other CSI sequences with different final characters (covers F and other control sequences)
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    // Remove OSC sequences (Operating System Command) - can end with \x07, \, or newline
    .replace(/\x1b\][0-9;?]*[^\x07\\\n]*(\x07|\\)?/g, '')
    // Remove broken/malformed OSC sequences
    .replace(/\]\d+;.*?\\/g, '')
    // Remove other escape sequences (ESC followed by =, >, <)
    .replace(/\x1b[=><]/g, '')
    // Remove any remaining ESC characters
    .replace(/\x1b/g, '')
    // Remove control characters except newline, tab, and carriage return
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]/g, '')
    // Remove Unicode replacement characters (often from encoding issues)
    .replace(/\uFFFD/g, '');
  
  // Handle Docker log format issues - remove corrupted prefixes
  // These are often ANSI escape sequence remnants that got corrupted during transmission
  cleaned = cleaned
    // Remove single special characters before INFO, ERROR, WARN, DEBUG, FATAL
    .replace(/^[%+\-()&|<>H,;:!@#$^&*=\[\]{}`~\\\/]\s*(INFO|ERROR|WARN|DEBUG|FATAL|SUCCESS)/gm, '$1')
    // Remove single special characters before common log patterns
    .replace(/^[%+\-()&|<>H,;:!@#$^&*=\[\]{}`~\\\/]\s*(\[INFO\]|\[ERROR\]|\[WARN\]|\[DEBUG\]|\[FATAL\])/gm, '$1')
    // Clean up corrupted "time=" patterns (common in structured logs like Authelia)
    .replace(/^[^t\s]time=/gm, 'time=')
    // Clean up corrupted timestamps - remove single character before YYYY-MM-DD pattern
    // This handles cases like "d2025-11-21", "y2025-11-21", "Z2025-11-21", "]2025-11-21"
    .replace(/^([^0-9\s])(\d{4}-\d{2}-\d{2})/gm, '$2')
    // Remove corrupted characters before common timestamp patterns
    .replace(/^([^0-9\s])(\d{4}\/\d{2}\/\d{2})/gm, '$2')
    .replace(/^([^0-9\s])(\d{2}\/\d{2}\/\d{4})/gm, '$2');

  // Clean up excessive whitespace while preserving structure
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
    .replace(/\n{3,}/g, '\n\n'); // Multiple newlines to max 2
  
  return cleaned;
}

const app = express();

// Trust reverse proxy (Traefik) for secure cookies and correct client IP
app.set('trust proxy', 1);

expressWs(app);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Let Traefik/reverse proxy handle CSP
  crossOriginEmbedderPolicy: false
}));

// CORS - restrict to configured origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : (process.env.DOMAIN ? [`https://${process.env.DOMAIN}`] : true),
  credentials: true
}));

app.use(express.json());

// Session - require SESSION_SECRET in production
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: SESSION_SECRET environment variable must be set in production');
  process.exit(1);
}
app.use(session({
  secret: SESSION_SECRET || 'spyglass-dev-only-secret-' + crypto.randomBytes(16).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Serve static files with caching for icons (1 week)
app.use('/icons', express.static(join(__dirname, 'public/icons'), {
  maxAge: '7d',
  immutable: true
}));
app.use(express.static(join(__dirname, 'public')));

// User management initialization will happen after getCredentialsFromAccounts is defined

// Initialize Docker connection
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// App icon mapping for common Saltbox apps
const appIcons = {
  plex: '🎬',
  sonarr: '📺',
  radarr: '🎥',
  lidarr: '🎵',
  readarr: '📚',
  qbittorrent: '⬇️',
  sabnzbd: '📥',
  overseerr: '🎭',
  tautulli: '📊',
  portainer: '🐳',
  nzbhydra2: '🔍',
  jackett: '🔎',
  bazarr: '💬',
  autoscan: '🔄',
  default: '📦',
};

const appCategories = {
  plex: 'Media Server',
  emby: 'Media Server',
  jellyfin: 'Media Server',
  sonarr: 'Media Management',
  radarr: 'Media Management',
  lidarr: 'Media Management',
  readarr: 'Media Management',
  qbittorrent: 'Downloading',
  sabnzbd: 'Downloading',
  deluge: 'Downloading',
  transmission: 'Downloading',
  overseerr: 'Requests',
  ombi: 'Requests',
  tautulli: 'Analytics',
  portainer: 'Management',
  nzbhydra2: 'Indexer',
  jackett: 'Indexer',
  prowlarr: 'Indexer',
  bazarr: 'Subtitles',
  autoscan: 'Automation',
  default: 'Application',
};

// Get app icon and category
function getAppInfo(name) {
  const lowerName = name.toLowerCase();
  
  // Try to get icon path (image)
  const iconPath = getAppIconPath(name);
  const icon = iconPath || appIcons.default;
  const iconType = iconPath ? 'image' : 'emoji';
  const fallback = iconPath && (iconPath.startsWith('http://') || iconPath.startsWith('https://')) ? getFallbackIconUrl(name) : null;
  
  // Get category from the docs taxonomy. Try the full name first (handles
  // slugs like "code-server"), then the suffix-stripped base name (handles
  // instances like "sonarr-4k" -> "sonarr").
  const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const meta = appCategoryTaxonomy.apps[norm(name)] || appCategoryTaxonomy.apps[norm(getBaseAppName(name))];
  const category = meta ? meta.category : appCategories.default;
  const subcategory = meta ? meta.subcategory : null;

  return {
    icon,
    iconType,
    category,
    subcategory,
    fallback,
  };
}

// Check if an icon URL actually exists
async function verifyIconExists(iconPath) {
  if (!iconPath) return false;
  
  // Custom icons - check if file exists
  if (iconPath.startsWith('/icons/custom/')) {
    const fileName = iconPath.replace('/icons/custom/', '');
    const filePath = join(CUSTOM_ICONS_DIR, fileName);
    return fs.existsSync(filePath);
  }
  
  // CDN URLs - check if they exist via HEAD request
  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
    try {
      const response = await axios.head(iconPath, { 
        timeout: 3000,
        validateStatus: (status) => status < 500 // Accept 404, but not 500+
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
  
  return false;
}

// Search for icons using multiple name variations in parallel, return first successful result
async function getAppInfoAsync(nameVariations) {
  if (!Array.isArray(nameVariations) || nameVariations.length === 0) {
    return getAppInfo('');
  }
  
  // Create promises for all name variations - verify icons actually exist
  // Each promise resolves with the result if icon exists, or null if it doesn't
  const iconPromises = nameVariations.map(async (name) => {
    if (!name) {
      return null;
    }
    
    try {
      const result = getAppInfo(name);
      
      // For emoji, return immediately (always valid)
      if (result.iconType !== 'image') {
        return result;
      }
      
      // For images, verify they exist before returning
      if (result.icon) {
        if (result.icon.startsWith('/icons/custom/')) {
          // Custom icon - verify it exists
          if (await verifyIconExists(result.icon)) {
            return result;
          }
        } else if (result.icon.startsWith('http://') || result.icon.startsWith('https://')) {
          // CDN icon - verify it exists
          if (await verifyIconExists(result.icon)) {
            return result;
          }
        }
      }
      
      // Icon doesn't exist - return null
      return null;
    } catch (error) {
      return null;
    }
  });
  
  // Use Promise.race to get the first result (even if null)
  // Then check all results to find the first non-null one
  const raceResult = await Promise.race(iconPromises);
  if (raceResult) {
    return raceResult;
  }
  
  // If race returned null, wait for all to complete and get first non-null
  const results = await Promise.all(iconPromises);
  for (const result of results) {
    if (result) {
      return result;
    }
  }
  
  // Fallback to default if nothing worked
  return getAppInfo(nameVariations[0] || '');
}

// Protect all API routes except auth endpoints
// IMPORTANT: This must be defined before all route handlers
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) {
    return next();
  }
  return requireAuth(req, res, next);
});

// Reboot the host machine
app.post('/api/server/reboot', requireAuth, requirePermission(userManager.PERMISSIONS.SERVER_CONTROL), async (req, res) => {
  try {
    // Reboot the host over the same SSH-to-host channel the sb commands use.
    // The SSH pipe dies as the host goes down, so a broken connection / timeout
    // here means the reboot was issued, not that it failed. Fire and report.
    execAsync(buildSshCommand('sudo reboot'), {
      env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
      maxBuffer: 1024,
      timeout: 15000,
    }).catch((err) => {
      // Expected: connection drops once the host starts rebooting.
      console.log('Reboot SSH connection closed (expected if reboot issued):', err.message);
    });
    console.log(`Host reboot requested by user ${req.session.userId}`);
    return res.json({ success: true, message: 'Reboot command issued. The server is going down now.' });
  } catch (err) {
    console.error('Failed to issue reboot:', err);
    return res.status(500).json({ error: 'Failed to issue reboot', details: err.message });
  }
});

// Get server statistics
app.get('/api/server/stats', async (req, res) => {
  try {
    const [cpu, cpuTemp, mem, fsSize, networkStats, cpuInfo, osInfo, time, processes, disksIO] = await Promise.all([
      si.currentLoad(),
      si.cpuTemperature().catch(() => ({ main: null, cores: [] })),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.cpu().catch(() => ({ physicalCores: 0, cores: 0, brand: '', speed: 0 })),
      si.osInfo().catch(() => ({ platform: '', distro: '', release: '', hostname: '', arch: '' })),
      si.time(),
      si.processes().catch(() => ({ all: 0, running: 0, blocked: 0, sleeping: 0, list: [] })),
      si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0, tIO_sec: 0, rWaitTime: 0, wWaitTime: 0 })),
    ]);

    const cpuUsage = cpu.currentLoad || 0;
    const memoryUsage = ((mem.total - mem.available) / mem.total) * 100;
    // diskUsage will be calculated after optFs is determined

    // Calculate network throughput - sum all physical interfaces (exclude loopback, docker, veth, br-)
    const physicalNetworkStats = networkStats.filter(iface => {
      const name = iface.iface || '';
      return !name.startsWith('lo') &&
             !name.startsWith('docker') &&
             !name.startsWith('veth') &&
             !name.startsWith('br-') &&
             !name.startsWith('virbr') &&
             name !== 'lo';
    });

    // Sum up all physical interface traffic
    const totalRxSec = physicalNetworkStats.reduce((sum, iface) => sum + (iface.rx_sec || 0), 0);
    const totalTxSec = physicalNetworkStats.reduce((sum, iface) => sum + (iface.tx_sec || 0), 0);
    const totalRxBytes = physicalNetworkStats.reduce((sum, iface) => sum + (iface.rx_bytes || 0), 0);
    const totalTxBytes = physicalNetworkStats.reduce((sum, iface) => sum + (iface.tx_bytes || 0), 0);

    const networkThroughput = (totalRxSec + totalTxSec) / 1024 / 1024;

    // Check if running with host filesystem mounted (SI_ROOTDIR=/hostfs)
    const hostfsPrefix = process.env.SI_ROOTDIR || '';

    // Helper to normalize mount paths (strip /hostfs prefix for display)
    const normalizeMountPath = (mount) => {
      if (hostfsPrefix && mount.startsWith(hostfsPrefix)) {
        const normalized = mount.slice(hostfsPrefix.length) || '/';
        return normalized;
      }
      return mount;
    };

    // Get /opt filesystem for main disk stat (with hostfs prefix if set)
    // If /opt isn't a separate mount, fall back to root filesystem (where /opt resides)
    const optFs = fsSize.find(fs => fs.mount === `${hostfsPrefix}/opt`)
      || fsSize.find(fs => fs.mount === '/opt')
      || fsSize.find(fs => fs.mount === hostfsPrefix || fs.mount === `${hostfsPrefix}/`)
      || fsSize.find(fs => fs.mount === '/')
      || fsSize[0];

    // Calculate disk usage from /opt or root filesystem
    const diskUsage = optFs ? ((optFs.used / optFs.size) * 100) : 0;

    // Get /opt and /mnt filesystems only for the Storage section
    const allDisks = fsSize
      .filter(fs => {
        const normalizedMount = normalizeMountPath(fs.mount);
        // Only show /opt and /mnt paths (and their subdirectories)
        return normalizedMount === '/opt' || normalizedMount.startsWith('/opt/') ||
               normalizedMount === '/mnt' || normalizedMount.startsWith('/mnt/');
      })
      .map(fs => ({
        mount: normalizeMountPath(fs.mount),
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        sizeGB: Math.round((fs.size / 1024 / 1024 / 1024) * 100) / 100,
        usedGB: Math.round((fs.used / 1024 / 1024 / 1024) * 100) / 100,
        availableGB: Math.round((fs.available / 1024 / 1024 / 1024) * 100) / 100,
      }));

    // Get top 5 processes by CPU usage
    const topCpuProcesses = (processes.list || [])
      .filter(p => p.name && p.cpu !== undefined)
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        pid: p.pid,
        cpu: Math.round((p.cpu || 0) * 10) / 10,
        mem: Math.round((p.mem || 0) * 10) / 10,
      }));

    // Get top 5 processes by memory usage
    const topMemProcesses = (processes.list || [])
      .filter(p => p.name && p.mem !== undefined)
      .sort((a, b) => (b.mem || 0) - (a.mem || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        pid: p.pid,
        cpu: Math.round((p.cpu || 0) * 10) / 10,
        mem: Math.round((p.mem || 0) * 10) / 10,
      }));

    // Format uptime
    const uptimeSeconds = time.uptime || 0;
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeFormatted = days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

    res.json({
      cpu: Math.round(cpuUsage * 10) / 10,
      memory: Math.round(memoryUsage * 10) / 10,
      disk: Math.round(diskUsage * 10) / 10,
      network: Math.round(networkThroughput * 100) / 100,
      details: {
        cpu: {
          cores: cpuInfo.cores || cpuInfo.physicalCores || 0,
          physicalCores: cpuInfo.physicalCores || cpuInfo.cores || 0,
          temperature: cpuTemp.main || (cpuTemp.cores && cpuTemp.cores.length > 0 ? cpuTemp.cores[0] : null),
          brand: cpuInfo.brand || '',
          speed: cpuInfo.speed || 0,
          loadUser: Math.round((cpu.currentLoadUser || 0) * 10) / 10,
          loadSystem: Math.round((cpu.currentLoadSystem || 0) * 10) / 10,
          loadIdle: Math.round((cpu.currentLoadIdle || 0) * 10) / 10,
        },
        memory: {
          total: mem.total,
          used: mem.total - mem.available,
          available: mem.available,
          totalGB: Math.round((mem.total / 1024 / 1024 / 1024) * 100) / 100,
          usedGB: Math.round(((mem.total - mem.available) / 1024 / 1024 / 1024) * 100) / 100,
          usedMB: Math.round(((mem.total - mem.available) / 1024 / 1024) * 100) / 100,
          swapTotal: mem.swaptotal,
          swapUsed: mem.swapused,
          swapTotalGB: Math.round((mem.swaptotal / 1024 / 1024 / 1024) * 100) / 100,
          swapUsedGB: Math.round((mem.swapused / 1024 / 1024 / 1024) * 100) / 100,
          cached: mem.cached,
          buffered: mem.buffers,
        },
        disk: {
          total: optFs ? optFs.size : 0,
          used: optFs ? optFs.used : 0,
          available: optFs ? optFs.available : 0,
          totalGB: optFs ? Math.round((optFs.size / 1024 / 1024 / 1024) * 100) / 100 : 0,
          usedGB: optFs ? Math.round((optFs.used / 1024 / 1024 / 1024) * 100) / 100 : 0,
          readSpeed: disksIO.rIO_sec || 0,
          writeSpeed: disksIO.wIO_sec || 0,
          allDisks: allDisks,
        },
        network: {
          rx_sec: totalRxSec,
          tx_sec: totalTxSec,
          rx_bytes: totalRxBytes,
          tx_bytes: totalTxBytes,
          interfaces: physicalNetworkStats.map(iface => iface.iface).join(', '),
          interfaceCount: physicalNetworkStats.length,
        },
        system: {
          hostname: osInfo.hostname || '',
          platform: osInfo.platform || '',
          distro: osInfo.distro || '',
          release: osInfo.release || '',
          arch: osInfo.arch || '',
          uptime: uptimeSeconds,
          uptimeFormatted,
        },
        load: {
          load1: Math.round((cpu.avgLoad || 0) * 100) / 100,
          load5: 0, // Will be calculated from avgLoad history if needed
          load15: 0,
        },
        processes: {
          total: processes.all || 0,
          running: processes.running || 0,
          sleeping: processes.sleeping || 0,
          topCpuProcesses,
          topMemProcesses,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching server stats:', error);
    res.status(500).json({ error: 'Failed to fetch server stats' });
  }
});

// Cache for sb list results
let sbListCache = null;

// App category taxonomy, generated from docs.saltbox.dev/apps/ by
// scripts/build-app-categories.js. Keyed by alnum-only normalized app name.
// Lives at the app root (NOT data/) so the image-baked copy isn't shadowed
// by a host bind-mount of data/.
const APP_CATEGORIES_FILE = join(__dirname, 'app-categories.json');
let appCategoryTaxonomy = { apps: {}, tree: {} };
function loadAppCategories() {
  try {
    appCategoryTaxonomy = JSON.parse(fs.readFileSync(APP_CATEGORIES_FILE, 'utf-8'));
  } catch (e) {
    console.warn('app-categories.json missing; run `node scripts/build-app-categories.js`. Categories will default to "Application".');
    appCategoryTaxonomy = { apps: {}, tree: {} };
  }
}
loadAppCategories();

// Cache for app descriptions (key: appName-isSandbox, value: { description, links, timestamp })
const descriptionCache = new Map();
const DESCRIPTION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// File cache path for app descriptions
const APP_DESCRIPTIONS_CACHE_FILE = join(__dirname, 'data', 'app-descriptions.json');

// Load app descriptions from file cache
function loadAppDescriptionsCache() {
  try {
    if (fs.existsSync(APP_DESCRIPTIONS_CACHE_FILE)) {
      const fileData = fs.readFileSync(APP_DESCRIPTIONS_CACHE_FILE, 'utf8');
      const cache = JSON.parse(fileData);
      return cache.descriptions || {};
    }
  } catch (error) {
    console.error('Error loading app descriptions cache:', error.message);
  }
  return {};
}

// Save app descriptions to file cache (only if sb update has been run)
function saveAppDescriptionsCache(cache) {
  if (!sbUpdateCompleted) {
    // Only save to in-memory cache, not file cache, until sb update is run
    return;
  }
  try {
    const data = { descriptions: cache };
    fs.writeFileSync(APP_DESCRIPTIONS_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving app descriptions cache:', error.message);
  }
}

// Load file cache on startup
let appDescriptionsFileCache = loadAppDescriptionsCache();

// Check if cache is empty (only has empty descriptions object)
function isCacheEmpty(cache) {
  return !cache || Object.keys(cache).length === 0;
}

// Track if sb update has been run (allows saving new descriptions to file cache)
// If cache is empty on startup, set to true to allow initial population
let sbUpdateCompleted = isCacheEmpty(appDescriptionsFileCache);

// Function to populate cache with descriptions for all apps
async function populateAppDescriptionsCache() {
  if (!sbUpdateCompleted) {
    return; // Don't populate if sb update hasn't been run and cache has content
  }
  
  try {
    console.log('Populating app descriptions cache...');
    
    // Get list of all apps
    if (!sbListCache) {
      sbListCache = await fetchSbList();
    }
    
    const allApps = [
      ...sbListCache.saltbox.map(name => ({ name, isSandbox: false })),
      ...sbListCache.sandbox.map(name => ({ name, isSandbox: true }))
    ];
    
    // Fetch descriptions for all apps (in batches to avoid overwhelming)
    const batchSize = 10;
    for (let i = 0; i < allApps.length; i += batchSize) {
      const batch = allApps.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (app) => {
          try {
            const data = await fetchAppDescription(app.name, app.isSandbox);
            // Data is already saved to appDescriptionsFileCache in fetchAppDescription
          } catch (error) {
            console.error(`Error fetching description for ${app.name}:`, error.message);
          }
        })
      );
      
      // Small delay between batches
      if (i + batchSize < allApps.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('App descriptions cache populated');
  } catch (error) {
    console.error('Error populating app descriptions cache:', error.message);
  }
}

// Function to fetch and parse sb list
async function fetchSbList() {
  try {
    // Read from cached file (updated by host cron job) instead of running command directly
    const sbListFile = join(__dirname, 'data', 'sb-list.txt');
    let stdout;
    try {
      stdout = await fs.promises.readFile(sbListFile, 'utf-8');
    } catch (fileError) {
      // Fallback to running command via SSH if file doesn't exist
      const result = await execAsync(buildSshCommand('sb list'));
      stdout = result.stdout;
    }
    
    const saltboxApps = [];
    const sandboxApps = [];
    let currentSection = null;
    
    const lines = stdout.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for section headers
      if (line.includes('Saltbox tags:')) {
        currentSection = 'saltbox';
        continue;
      }
      
      if (line.includes('Sandbox tags')) {
        currentSection = 'sandbox';
        continue;
      }
      
      // Skip empty lines and section markers
      const trimmed = line.trim();
      if (!trimmed || trimmed === '(cached)') continue;
      
      // Parse apps from the line - handle column format (apps separated by multiple spaces)
      // Split by multiple spaces (2+) to separate columns, then filter out empty strings
      const apps = trimmed.split(/\s{2,}/).flatMap(part => {
        // Each part might still have single spaces, split those too
        return part.split(/\s+/).filter(app => app && app.length > 0);
      }).filter(app => app && app.length > 0);
      
      if (currentSection === 'saltbox' && apps.length > 0) {
        saltboxApps.push(...apps);
      } else if (currentSection === 'sandbox' && apps.length > 0) {
        sandboxApps.push(...apps);
      }
    }
    
    // Remove duplicates and sort
    const uniqueSaltbox = [...new Set(saltboxApps)].sort();
    const uniqueSandbox = [...new Set(sandboxApps)].sort();
    
    return {
      saltbox: uniqueSaltbox,
      sandbox: uniqueSandbox,
    };
  } catch (error) {
    console.error('Error fetching Saltbox apps:', error);
    throw error;
  }
}

// Load sb list cache on startup
(async () => {
  try {
    console.log('Loading sb list cache on startup...');
    sbListCache = await fetchSbList();
    console.log('sb list cache loaded successfully');
    
    // If app descriptions cache is empty, populate it
    if (isCacheEmpty(appDescriptionsFileCache)) {
      console.log('App descriptions cache is empty, populating...');
      await populateAppDescriptionsCache();
    } else {
      console.log('App descriptions cache has content, will only update after sb update is run');
    }
  } catch (error) {
    console.error('Failed to load sb list cache on startup:', error);
  }
})();

// Get available Saltbox/Sandbox apps
app.get('/api/saltbox/apps', async (req, res) => {
  try {
    // Return cached result if available
    if (sbListCache) {
      return res.json(sbListCache);
    }
    
    // If cache is empty, fetch and cache
    sbListCache = await fetchSbList();
    res.json(sbListCache);
  } catch (error) {
    console.error('Error fetching Saltbox apps:', error);
    res.status(500).json({ error: 'Failed to fetch apps list', details: error.message });
  }
});

// Get the Saltbox app category taxonomy (from docs.saltbox.dev/apps/)
app.get('/api/saltbox/categories', (req, res) => {
  res.json({
    tree: appCategoryTaxonomy.tree || {},
    system: appCategoryTaxonomy.system || [],
  });
});

// Check if apps are installed in Docker
app.post('/api/saltbox/apps/check-installed', async (req, res) => {
  try {
    const { apps } = req.body; // Array of { name, isSandbox }
    if (!Array.isArray(apps)) {
      return res.status(400).json({ error: 'Apps must be an array' });
    }

    const containers = await docker.listContainers({ all: true });
    const containerNames = new Set(containers.map(c => c.Names[0].replace(/^\//, '').toLowerCase()));

    const installed = {};
    apps.forEach(({ name, isSandbox }) => {
      const fullName = isSandbox ? `sandbox-${name}` : name;
      const fullNameLower = fullName.toLowerCase();
      // Check if exact name matches or if container name starts with app name
      installed[name] = Array.from(containerNames).some(containerName => 
        containerName === fullNameLower || 
        containerName.startsWith(fullNameLower + '-') ||
        containerName === name.toLowerCase() ||
        containerName.startsWith(name.toLowerCase() + '-')
      );
    });

    res.json(installed);
  } catch (error) {
    console.error('Error checking installed apps:', error);
    res.status(500).json({ error: 'Failed to check installed apps', details: error.message });
  }
});

// Create instance entry in localhost file
app.post('/api/saltbox/create-instance', async (req, res) => {
  try {
    // Check permissions
    const user = userManager.getUserById(req.session.userId);
    if (!userManager.hasPermission(user, userManager.PERMISSIONS.CONFIG_EDIT)) {
      return res.status(403).json({ error: 'Insufficient permissions to edit config' });
    }

    const { appName, instanceName } = req.body;
    if (!appName || !instanceName) {
      return res.status(400).json({ error: 'App name and instance name are required' });
    }

    // Validate instance name (alphanumeric, hyphens, underscores only)
    if (!/^[\w-]+$/.test(instanceName)) {
      return res.status(400).json({ error: 'Instance name contains invalid characters' });
    }

    const inventoryPath = CONFIG_FILES.inventory;
    if (!fs.existsSync(inventoryPath)) {
      return res.status(404).json({ error: 'Inventory file not found' });
    }

    // Read current inventory
    const content = fs.readFileSync(inventoryPath, 'utf8');
    const data = yaml.load(content) || {};

    // Extract base app name (remove sandbox- prefix if present) for instances key
    // The instances key should be based on the base app name, not the full app name
    const baseAppName = appName.replace(/^sandbox-/, '');
    const instancesKey = `${baseAppName}_instances`;
    
    if (!Array.isArray(data[instancesKey])) {
      data[instancesKey] = [];
      // When creating a new instances array, include the base app name as the first instance
      if (!data[instancesKey].includes(baseAppName)) {
        data[instancesKey].push(baseAppName);
      }
    }

    // Check if instance already exists
    if (data[instancesKey].includes(instanceName)) {
      return res.status(400).json({ error: 'Instance name already exists' });
    }

    // Add instance to array
    data[instancesKey].push(instanceName);

    // Backup original file
    const backupPath = `${inventoryPath}.backup.${Date.now()}`;
    fs.copyFileSync(inventoryPath, backupPath);

    // Write updated inventory
    const yamlContent = yaml.dump(data, {
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
      indent: 2,
      styles: {
        '!!null': 'empty',
        '!!bool': 'lowercase',
      },
      sortKeys: false,
      noCompatMode: true,
    });

    fs.writeFileSync(inventoryPath, yamlContent, 'utf8');

    res.json({ success: true, message: `Instance ${instanceName} added to ${appName}` });
  } catch (error) {
    console.error('Error creating instance:', error);
    res.status(500).json({ error: 'Failed to create instance', details: error.message });
  }
});

// Helper function to fetch description from awweso.me as fallback
async function fetchDescriptionFromAwweso(appName) {
  try {
    const searchUrl = `https://www.awweso.me/?search=${encodeURIComponent(appName)}`;
    console.log(`[awweso.me] Searching for: ${appName} at ${searchUrl}`);
    const response = await axios.get(searchUrl, {
      validateStatus: (status) => status < 500,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.status !== 200) {
      console.log(`[awweso.me] Non-200 status for ${appName}: ${response.status}`);
      return { description: null, github: null };
    }
    
    const $ = cheerio.load(response.data);
    
    // Find the h2 tag with the app name
    const appNameH2 = $('h2.text-3xl.font-bold.break-all');
    console.log(`[awweso.me] Found ${appNameH2.length} h2 tags for ${appName}`);
    let matchingArticle = null;
    let githubLink = null;
    
    for (let i = 0; i < appNameH2.length; i++) {
      const $h2 = $(appNameH2[i]);
      const h2Text = $h2.text().trim();
      console.log(`[awweso.me] H2[${i}]: "${h2Text}"`);
      // Case-insensitive comparison, also handle variations with dashes/underscores
      const normalizedH2 = h2Text.toLowerCase().replace(/[-_\s]/g, '');
      const normalizedAppName = appName.toLowerCase().replace(/[-_\s]/g, '');
      
      console.log(`[awweso.me] Comparing: normalizedH2="${normalizedH2}" vs normalizedAppName="${normalizedAppName}"`);
      console.log(`[awweso.me] Direct comparison: "${h2Text.toLowerCase()}" === "${appName.toLowerCase()}" = ${h2Text.toLowerCase() === appName.toLowerCase()}`);
      
      // Try multiple matching strategies
      // Exact match (normalized)
      if (normalizedH2 === normalizedAppName || h2Text.toLowerCase() === appName.toLowerCase()) {
        console.log(`[awweso.me] Match found for ${appName}!`);
        // Find the parent article element
        matchingArticle = $h2.closest('article');
        console.log(`[awweso.me] Found article: ${matchingArticle.length > 0 ? 'yes' : 'no'}`);
        
        // Extract GitHub link from the <a> tag that contains the h2
        const $parentLink = $h2.closest('a[href*="github.com"]');
        if ($parentLink.length > 0) {
          githubLink = $parentLink.attr('href');
          console.log(`[awweso.me] Found GitHub link: ${githubLink}`);
        }
        
        break;
      }
    }
    
    if (!matchingArticle || matchingArticle.length === 0) {
      console.log(`[awweso.me] No matching article found for ${appName}`);
      return { description: null, github: githubLink };
    }
    
    // Extract description from the specified selector within the matching article
    // Try multiple selectors to handle different page structures
    let description = null;
    let descriptionElement = matchingArticle.find('div.break-words > div');
    console.log(`[awweso.me] Trying selector 'div.break-words > div': found ${descriptionElement.length} elements`);
    
    // If the first selector doesn't work, try the third div child (based on XPath structure)
    if (descriptionElement.length === 0 || !descriptionElement.text().trim()) {
      console.log(`[awweso.me] First selector failed, trying third div child`);
      const articleDivs = matchingArticle.children('div');
      console.log(`[awweso.me] Article has ${articleDivs.length} direct div children`);
      if (articleDivs.length >= 3) {
        const thirdDiv = $(articleDivs[2]);
        descriptionElement = thirdDiv.find('div').first();
        console.log(`[awweso.me] Third div selector found ${descriptionElement.length} elements`);
      }
    }
    
    // If still not found, try any div within the article that has text
    if (descriptionElement.length === 0 || !descriptionElement.text().trim()) {
      console.log(`[awweso.me] Trying fallback: any div > div with substantial text`);
      descriptionElement = matchingArticle.find('div > div').filter((i, elem) => {
        const text = $(elem).text().trim();
        return text && text.length > 20; // Only consider divs with substantial text
      }).first();
      console.log(`[awweso.me] Fallback selector found ${descriptionElement.length} elements`);
    }
    
    if (descriptionElement.length > 0) {
      const descriptionText = descriptionElement.text().trim();
      console.log(`[awweso.me] Description text length: ${descriptionText.length}`);
      if (descriptionText) {
        description = descriptionText.replace(/\s+/g, ' ');
        console.log(`[awweso.me] Successfully extracted description for ${appName}`);
      }
    } else {
      console.log(`[awweso.me] No description element found for ${appName}`);
    }
    
    return { description, github: githubLink };
  } catch (error) {
    console.error(`Error fetching description from awweso.me for ${appName}:`, error.message);
    return { description: null, github: null };
  }
}

// Helper function to fetch a single description (with caching) - defined before endpoints
async function fetchAppDescription(appName, isSandbox) {
  const cacheKey = `${appName}-${isSandbox}`;
  
  // Check file cache first (persistent cache that can be manually edited)
  if (appDescriptionsFileCache[cacheKey]) {
    const fileCached = appDescriptionsFileCache[cacheKey];
    // If file cache has a description (even if null), use it and don't fetch from URLs
    if (fileCached.description !== undefined || fileCached.links !== undefined) {
      return {
        description: fileCached.description || null,
        links: fileCached.links || null
      };
    }
  }
  
  // Check in-memory cache
  const cached = descriptionCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < DESCRIPTION_CACHE_TTL) {
    return cached.data;
  }
  
  try {
    let baseUrl;
    // Special cases for apps whose docs URL doesn't follow the standard pattern.
    if (appName === 'plex-db' && !isSandbox) {
      baseUrl = 'https://docs.saltbox.dev/reference/modules/plex_db/?h=plex';
    } else if ((appName === 'it-tools' || appName === 'it_tools') && isSandbox) {
      baseUrl = 'https://docs.saltbox.dev/sandbox/apps/it_tools/?h=tools';
    } else if ((appName === 'your-spotify' || appName === 'yourspotify') && isSandbox) {
      baseUrl = 'https://docs.saltbox.dev/sandbox/apps/your_spotify/';
    } else if (appName === 'unifi' && isSandbox) {
      baseUrl = 'https://docs.saltbox.dev/sandbox/apps/unifi_network_application/';
    } else {
      // Convert dashes to underscores for both sandbox and non-sandbox apps
      const urlAppName = appName.replace(/-/g, '_');
      baseUrl = isSandbox 
        ? `https://docs.saltbox.dev/sandbox/apps/${urlAppName}/`
        : `https://docs.saltbox.dev/apps/${urlAppName}/`;
    }
    
    let response = await axios.get(baseUrl, {
      validateStatus: (status) => status < 500,
      timeout: 10000,
    });
    
    // If 404, try the alternative variation (dash vs underscore)
    if (response.status === 404) {
      // Try the opposite: if we used underscores, try dashes; if we used dashes, try underscores
      const altAppName = appName.includes('-') 
        ? appName  // Original had dashes, try original (since we converted to underscore first)
        : appName.replace(/_/g, '-');  // Original had underscores, try with dashes
      const altBaseUrl = isSandbox 
        ? `https://docs.saltbox.dev/sandbox/apps/${altAppName}/`
        : `https://docs.saltbox.dev/apps/${altAppName}/`;
      response = await axios.get(altBaseUrl, {
        validateStatus: (status) => status < 500,
        timeout: 10000,
      });
      if (response.status === 200) {
        baseUrl = altBaseUrl;
      }
    }

    // Still 404? Many utility/system tags (plex-db, arr-db, download-clients,
    // media-server, etc.) are documented under /reference/modules/ instead of
    // /apps/. Try that before giving up. See docs.saltbox.dev/reference/modules/
    if (response.status === 404) {
      const moduleUrl = `https://docs.saltbox.dev/reference/modules/${appName.replace(/-/g, '_')}/`;
      const moduleResponse = await axios.get(moduleUrl, {
        validateStatus: (status) => status < 500,
        timeout: 10000,
      });
      if (moduleResponse.status === 200) {
        baseUrl = moduleUrl;
        response = moduleResponse;
      }
    }

    let description = null;
    let links = {
      projectHome: null,
      docs: null,
      github: null,
      docker: null
    };
    
    if (response.status === 404 || response.status !== 200) {
      // Try fallback from awweso.me
      const fallbackData = await fetchDescriptionFromAwweso(appName);
      description = fallbackData.description;
      if (fallbackData.github) {
        links.github = fallbackData.github;
      }
      const data = {
        description,
        links: Object.keys(links).some(key => links[key] !== null) ? links : null
      };
      // Save to file cache
      appDescriptionsFileCache[cacheKey] = data;
      saveAppDescriptionsCache(appDescriptionsFileCache);
      descriptionCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    }
    
    const $ = cheerio.load(response.data);
    
    const firstParagraph = $('p').first();
    if (firstParagraph.length) {
      description = firstParagraph.text().trim();
      description = description.replace(/\s+/g, ' ');
    }
    
    // Check if description matches exactly "{appname} is a..." (with literal ...) and discard it
    if (description) {
      const lowerDescription = description.toLowerCase().trim();
      const lowerAppName = appName.toLowerCase();
      // Handle variations: "appname is a", "app-name is a", "app_name is a", etc.
      const appNameVariations = [
        lowerAppName,
        lowerAppName.replace(/-/g, ' '),
        lowerAppName.replace(/_/g, ' '),
        lowerAppName.replace(/[-_]/g, '')
      ];
      
      for (const variation of appNameVariations) {
        const exactPattern = `${variation} is a...`;
        // Only discard if it matches exactly "{appname} is a..." (with three dots)
        if (lowerDescription === exactPattern) {
          description = null; // Discard this description, will use fallback
          break;
        }
      }
    }
    
    $('a.header-icons').each((i, elem) => {
      const $link = $(elem);
      const href = $link.attr('href');
      if (!href) return;
      
      const text = $link.text().toLowerCase().trim();
      
      if (text.includes('project home') || (text.includes('home') && !text.includes('github') && !text.includes('docker'))) {
        if (!links.projectHome) {
          links.projectHome = href;
        }
      } else if (text.includes('docs') || text.includes('documentation')) {
        if (!links.docs) {
          links.docs = href;
        }
      } else if (text.includes('github')) {
        if (!links.github) {
          links.github = href;
        }
      } else if (text.includes('docker')) {
        if (!links.docker) {
          links.docker = href;
        }
      }
    });
    
    if (!links.github) {
      const githubLink = $('a[href*="github.com"]').first();
      if (githubLink.length) {
        links.github = githubLink.attr('href');
      }
    }
    
    if (!links.docker) {
      const dockerLink = $('a[href*="hub.docker.com"], a[href*="docker.com/r/"]').first();
      if (dockerLink.length) {
        links.docker = dockerLink.attr('href');
      }
    }
    
    if (!links.projectHome) {
      const table = $('table').has('thead:contains("Details")');
      if (table.length) {
        table.find('tbody a').each((i, elem) => {
          const $link = $(elem);
          const href = $link.attr('href');
          if (href && !href.includes('github.com') && !href.includes('docker.com') && !href.includes('kb.')) {
            if (!links.projectHome) {
              links.projectHome = href;
            }
          }
        });
      }
    }
    
    // If no description found from saltbox, try fallback
    if (!description) {
      const fallbackData = await fetchDescriptionFromAwweso(appName);
      description = fallbackData.description;
      if (fallbackData.github && !links.github) {
        links.github = fallbackData.github;
      }
    }
    
    const data = {
      description: description || null,
      links: Object.keys(links).some(key => links[key] !== null) ? links : null
    };
    
    // Save to file cache
    appDescriptionsFileCache[cacheKey] = data;
    saveAppDescriptionsCache(appDescriptionsFileCache);
    descriptionCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Error fetching description for ${appName}:`, error.message);
    // Try fallback on error
    const fallbackData = await fetchDescriptionFromAwweso(appName);
    const fallbackLinks = fallbackData.github ? { github: fallbackData.github, projectHome: null, docs: null, docker: null } : null;
    const data = { 
      error: 'Failed to fetch app description',
      details: error.message,
      description: fallbackData.description,
      links: fallbackLinks
    };
    // Save to file cache
    appDescriptionsFileCache[cacheKey] = { description: fallbackData.description, links: fallbackLinks };
    saveAppDescriptionsCache(appDescriptionsFileCache);
    descriptionCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }
}

// Get app description from Saltbox docs (uses cached function)
app.get('/api/appstore/description/:appName', async (req, res) => {
  try {
    const { appName } = req.params;
    const isSandbox = req.query.isSandbox === 'true';
    const data = await fetchAppDescription(appName, isSandbox);
    res.json(data);
  } catch (error) {
    console.error(`Error in description endpoint for ${req.params.appName}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to fetch app description',
      details: error.message,
      description: null,
      links: null
    });
  }
});

// Batch fetch icons for multiple apps
app.post('/api/icons/batch', (req, res) => {
  try {
    const { appNames } = req.body;
    if (!Array.isArray(appNames)) {
      return res.status(400).json({ error: 'appNames must be an array' });
    }
    
    const icons = {};
    for (const appName of appNames) {
      try {
        const iconPath = getAppIconPath(appName);
        const fallbackUrl = getFallbackIconUrl(appName);
        
        if (iconPath.startsWith('/icons/custom/')) {
          icons[appName] = { 
            icon: iconPath,
            fallback: null,
            type: 'image'
          };
        } else if (iconPath.startsWith('http')) {
          icons[appName] = { 
            icon: iconPath,
            fallback: fallbackUrl,
            type: 'image'
          };
        } else {
          const lowerName = appName.toLowerCase();
          let defaultIcon = appIcons.default;
          for (const [key, icon] of Object.entries(appIcons)) {
            if (lowerName.includes(key)) {
              defaultIcon = icon;
              break;
            }
          }
          icons[appName] = { 
            icon: defaultIcon,
            fallback: null,
            type: 'emoji'
          };
        }
      } catch (error) {
        console.error(`Error getting icon for ${appName}:`, error);
        icons[appName] = { 
          icon: appIcons.default,
          fallback: null,
          type: 'emoji'
        };
      }
    }
    
    res.json(icons);
  } catch (error) {
    console.error('Error getting batch icons:', error);
    res.status(500).json({ error: 'Failed to get batch icons', details: error.message });
  }
});

// Batch fetch descriptions for multiple apps
app.post('/api/appstore/descriptions/batch', async (req, res) => {
  try {
    const { apps } = req.body;
    if (!Array.isArray(apps)) {
      return res.status(400).json({ error: 'apps must be an array of {name, isSandbox}' });
    }
    
    // Fetch descriptions in parallel (with concurrency limit to avoid overwhelming external API)
    const BATCH_SIZE = 10;
    const descriptions = {};
    
    for (let i = 0; i < apps.length; i += BATCH_SIZE) {
      const batch = apps.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (app) => {
        const data = await fetchAppDescription(app.name, app.isSandbox);
        return { name: app.name, data };
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ name, data }) => {
        descriptions[name] = data;
      });
      
      // Small delay between batches to be respectful to external API
      if (i + BATCH_SIZE < apps.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    res.json(descriptions);
  } catch (error) {
    console.error('Error fetching batch descriptions:', error);
    res.status(500).json({ error: 'Failed to fetch batch descriptions', details: error.message });
  }
});

// Extract URL from Traefik labels
function extractUrlFromLabels(labels) {
  if (!labels) return null;

  // Collect all router rules, prioritizing HTTPS (websecure) over HTTP
  const routerRules = [];
  
  for (const [key, value] of Object.entries(labels)) {
    if (key.includes('traefik.http.routers.') && key.endsWith('.rule')) {
      const routerName = key.replace('traefik.http.routers.', '').replace('.rule', '');
      const entrypoint = labels[`traefik.http.routers.${routerName}.entrypoints`];
      const isHttps = entrypoint && (entrypoint.includes('websecure') || !entrypoint.includes('web'));
      
      // Extract host from rule patterns like:
      // Host(`subdomain.domain.com`)
      // Host(`subdomain.domain.com`) || PathPrefix(`/path`)
      const hostMatch = value.match(/Host\(`([^`]+)`\)/);
      if (hostMatch) {
        routerRules.push({
          host: hostMatch[1],
          isHttps,
          priority: isHttps ? 1 : 2, // Prefer HTTPS
        });
      }
      
      // Try HostRegexp pattern
      const hostRegexpMatch = value.match(/HostRegexp\(`([^`]+)`\)/);
      if (hostRegexpMatch) {
        // For regexp, try to extract a simple subdomain if possible
        const regexpPattern = hostRegexpMatch[1];
        const simpleMatch = regexpPattern.match(/([a-z0-9-]+)\.([a-z0-9.-]+)/);
        if (simpleMatch) {
          routerRules.push({
            host: simpleMatch[0],
            isHttps,
            priority: isHttps ? 1 : 2,
          });
        }
      }
    }
    
    // Legacy Traefik v1 pattern
    if (key === 'traefik.frontend.rule' || key === 'traefik.http.routers.default.rule') {
      const hostMatch = value.match(/Host\(`?([^`)]+)`?\)/);
      if (hostMatch) {
        routerRules.push({
          host: hostMatch[1],
          isHttps: true,
          priority: 1,
        });
      }
      // Simple host pattern
      if (value.includes('Host:')) {
        const host = value.replace(/.*Host:\s*/, '').trim();
        routerRules.push({
          host,
          isHttps: true,
          priority: 1,
        });
      }
    }
  }

  // Sort by priority (HTTPS first) and return the first one
  if (routerRules.length > 0) {
    routerRules.sort((a, b) => a.priority - b.priority);
    return `https://${routerRules[0].host}`;
  }
  
  return null;
}

// Get Docker applications with detailed stats
app.get('/api/docker/apps', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    
    const apps = await Promise.all(containers.map(async (container) => {
      const name = container.Names[0].replace(/^\//, '');
      const status = container.State === 'running' ? 'running' : 
                     container.State === 'restarting' ? 'restarting' : 'stopped';
      
      const dockerContainer = docker.getContainer(container.Id);
      let url = null;
      let stats = null;
      let details = null;
      let appInfo = null;
      
      try {
        const containerInfo = await dockerContainer.inspect();
        const labels = containerInfo.Config.Labels || {};
        url = extractUrlFromLabels(labels);
        
        // Extract detailed information
        const imageName = containerInfo.Config.Image;
        
        // Collect all possible name variations to search for icons
        const nameVariations = [];
        const addedNames = new Set();
        
        // Helper to add name if not already added
        const addNameVariation = (newName) => {
          if (!newName) return;
          const newNameLower = newName.toLowerCase();
          if (!addedNames.has(newNameLower)) {
            nameVariations.push(newName);
            addedNames.add(newNameLower);
          }
        };
        
        // Add container name first
        addNameVariation(name);
        
        // Add name before hyphen if container name has hyphen
        if (name.includes('-')) {
          const beforeHyphen = name.split('-')[0];
          addNameVariation(beforeHyphen);
        }
        
        // Add base app name (removes suffixes like 4k, anime, etc.)
        const baseAppName = getBaseAppName(name);
        if (baseAppName && baseAppName !== name.toLowerCase()) {
          addNameVariation(baseAppName);
        }
        
        // Add Docker image name variations
        if (imageName) {
          const baseImageName = extractBaseImageName(imageName);
          if (baseImageName) {
            addNameVariation(baseImageName);
            
            // If image name has hyphen, also try name before hyphen
            if (baseImageName.includes('-')) {
              const imageBeforeHyphen = baseImageName.split('-')[0];
              addNameVariation(imageBeforeHyphen);
            }
            
            // Also try base app name of image name
            const baseImageAppName = getBaseAppName(baseImageName);
            if (baseImageAppName && baseImageAppName !== baseImageName.toLowerCase()) {
              addNameVariation(baseImageAppName);
            }
          }
        }
        
        // Search all possibilities in parallel and get first successful result
        appInfo = await getAppInfoAsync(nameVariations);
        let updateAvailable = false;
        
        // Check for image updates (async, non-blocking)
        try {
          const image = docker.getImage(imageName);
          const imageInspect = await image.inspect();
          const localDigest = imageInspect.RepoDigests?.[0]?.split('@sha256:')[1] || null;
          
          // Try to get remote manifest to compare (this is a lightweight check)
          // Note: This might fail for private registries or require auth
          try {
            // Use docker pull with --dry-run equivalent by checking if image needs update
            // We'll use a simpler approach: check if image tag is 'latest' or compare digests
            // For now, we'll mark as needing check - actual update check will be done on-demand
            updateAvailable = false; // Will be checked via separate endpoint
          } catch (manifestErr) {
            // Can't check remote, assume no update
            updateAvailable = false;
          }
        } catch (imgErr) {
          // Image not found locally or can't inspect
          updateAvailable = false;
        }
        
        details = {
          id: containerInfo.Id,
          shortId: containerInfo.Id.substring(0, 12),
          image: imageName,
          imageId: containerInfo.Image,
          created: containerInfo.Created,
          startedAt: containerInfo.State.StartedAt || null,
          finishedAt: containerInfo.State.FinishedAt || null,
          restartCount: containerInfo.RestartCount || 0,
          health: containerInfo.State.Health?.Status || null,
          ports: containerInfo.NetworkSettings?.Ports || {},
          volumes: (containerInfo.Mounts || []).map(mount => ({
            source: mount.Source || '',
            destination: mount.Destination || '',
            type: mount.Type || 'volume',
            mode: mount.Mode || 'rw',
          })),
          env: containerInfo.Config.Env || [],
          command: containerInfo.Config.Cmd || [],
          workingDir: containerInfo.Config.WorkingDir || '/',
          labels: labels,
          updateAvailable: null, // Will be checked on-demand
        };
        
        // Get container stats if running
        if (status === 'running') {
          try {
            const statsStream = await new Promise((resolve, reject) => {
              dockerContainer.stats({ stream: false }, (err, stats) => {
                if (err) reject(err);
                else resolve(stats);
              });
            });
            
            // Calculate CPU usage percentage
            const cpuDelta = statsStream.cpu_stats.cpu_usage.total_usage -
                           (statsStream.precpu_stats?.cpu_usage?.total_usage || 0);
            const systemDelta = statsStream.cpu_stats.system_cpu_usage -
                              (statsStream.precpu_stats?.system_cpu_usage || 0);
            const onlineCpus = statsStream.cpu_stats.online_cpus ||
                           (statsStream.cpu_stats.cpu_usage.percpu_usage?.length || 1);

            // Check for CPU limit from container config
            // NanoCpus: limit in nanoseconds (1e9 = 1 CPU)
            // CpuQuota/CpuPeriod: alternative method (quota/period = CPU limit)
            const hostConfig = containerInfo.HostConfig || {};
            let cpuLimit = onlineCpus; // Default to all available CPUs

            if (hostConfig.NanoCpus && hostConfig.NanoCpus > 0) {
              // NanoCpus is in units of 1e-9 CPUs
              cpuLimit = hostConfig.NanoCpus / 1e9;
            } else if (hostConfig.CpuQuota && hostConfig.CpuQuota > 0 && hostConfig.CpuPeriod > 0) {
              // CpuQuota/CpuPeriod gives the CPU limit
              cpuLimit = hostConfig.CpuQuota / hostConfig.CpuPeriod;
            }

            // Ensure limit doesn't exceed available CPUs
            const effectiveCpuLimit = Math.min(cpuLimit, onlineCpus);

            let cpuPercent = 0;
            if (systemDelta > 0 && onlineCpus > 0) {
              cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100;
            }
            
            // Memory usage (subtract cache/inactive_file to match docker stats behavior)
            const memoryRawUsage = statsStream.memory_stats.usage || 0;
            const memoryCache = statsStream.memory_stats.stats?.inactive_file || statsStream.memory_stats.stats?.cache || 0;
            const memoryUsage = memoryRawUsage - memoryCache;
            const memoryLimit = statsStream.memory_stats.limit || 0;
            const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
            
            // Network I/O
            const networks = statsStream.networks || {};
            let networkRx = 0;
            let networkTx = 0;
            for (const netName in networks) {
              networkRx += networks[netName].rx_bytes || 0;
              networkTx += networks[netName].tx_bytes || 0;
            }
            
            // Block I/O
            const blkioStats = statsStream.blkio_stats || {};
            let blockRead = 0;
            let blockWrite = 0;
            if (blkioStats.io_service_bytes_recursive) {
              for (const entry of blkioStats.io_service_bytes_recursive) {
                const op = (entry.op || '').toLowerCase();
                if (op === 'read') blockRead += entry.value || 0;
                if (op === 'write') blockWrite += entry.value || 0;
              }
            }
            
            stats = {
              cpu: Math.round(cpuPercent * 10) / 10,
              cpuCores: effectiveCpuLimit,
              memory: {
                usage: memoryUsage,
                limit: memoryLimit,
                percent: Math.round(memoryPercent * 10) / 10,
              },
              network: {
                rx: networkRx,
                tx: networkTx,
              },
              block: {
                read: blockRead,
                write: blockWrite,
              },
              pids: statsStream.pids_stats?.current || 0,
              timestamp: statsStream.read || new Date().toISOString(),
            };
          } catch (statsErr) {
            console.error(`Error fetching stats for ${name}:`, statsErr.message);
            // Continue without stats
          }
        }
      } catch (err) {
        console.error(`Error inspecting container ${name}:`, err.message);
        // Fallback to basic icon search if container inspection fails
        if (!appInfo) {
          appInfo = await getAppInfoAsync([name]);
        }
      }

      // Ensure appInfo is set (fallback if async search failed)
      if (!appInfo) {
        appInfo = getAppInfo(name);
      }

      return {
        id: container.Id.substring(0, 12),
        fullId: container.Id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        status,
        url,
        icon: appInfo.icon,
        iconType: appInfo.iconType,
        fallback: appInfo.fallback,
        category: appInfo.category,
        image: container.Image,
        stats,
        details,
      };
    }));

    res.json(apps);
  } catch (error) {
    console.error('Error fetching docker apps:', error);
    res.status(500).json({ error: 'Failed to fetch docker apps', details: error.message });
  }
});

// Check for Docker image update
app.get('/api/docker/:appId/update-check', async (req, res) => {
  try {
    const { appId } = req.params;
    
    // Find container by ID or name
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id.startsWith(appId) || c.Names.some(n => n.replace(/^\//, '').includes(appId))
    );

    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    const containerInfo = await dockerContainer.inspect();
    const imageName = containerInfo.Config.Image;
    
    try {
      // Get local image info
      const image = docker.getImage(imageName);
      const localImage = await image.inspect();
      const localDigest = localImage.RepoDigests?.[0]?.split('@sha256:')[1] || null;
      
      // Try to check for updates using docker manifest inspect
      // This is a lightweight check that doesn't download the image
      try {
        // Use docker pull to check for updates (this will download if available)
        // Better approach: use docker manifest inspect to check remote without pulling
        // For now, we'll check if the image tag is 'latest' and compare
        const imageTag = imageName.includes(':') ? imageName.split(':')[1] : 'latest';
        
        if (imageTag === 'latest' || !imageName.includes('@sha256:')) {
          // Check if there's a newer version by attempting to inspect remote manifest
          // This is a lightweight check that doesn't download
          const checkCommand = `docker manifest inspect ${imageName} 2>/dev/null || echo "not_available"`;
          const result = execSync(checkCommand, { encoding: 'utf8', timeout: 5000 }).trim();
          
          if (result && result !== 'not_available' && !result.includes('no such manifest')) {
            try {
              const manifest = JSON.parse(result);
              const remoteDigest = manifest.config?.digest?.split(':')[1] || 
                                 manifest.manifests?.[0]?.digest?.split(':')[1] || null;
              
              // Compare digests
              const updateAvailable = remoteDigest && localDigest && remoteDigest !== localDigest;
              return res.json({ updateAvailable: !!updateAvailable });
            } catch (parseErr) {
              // Can't parse manifest, assume no update
              return res.json({ updateAvailable: false });
            }
          }
        }
        
        // If we can't check, return false
        return res.json({ updateAvailable: false });
      } catch (checkErr) {
        // Can't check for updates (might be private registry, network issue, etc.)
        return res.json({ updateAvailable: false, error: 'Unable to check for updates' });
      }
    } catch (err) {
      console.error(`Error checking for updates for ${imageName}:`, err.message);
      return res.json({ updateAvailable: false, error: err.message });
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ error: 'Failed to check for updates', details: error.message });
  }
});

// Control Docker application
app.post('/api/docker/:appId/:action', async (req, res) => {
  try {
    const { appId, action } = req.params;
    const validActions = ['start', 'stop', 'restart', 'update', 'delete'];

    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Check permissions
    const user = userManager.getUserById(req.session.userId);
    if (action === 'start' && !userManager.hasPermission(user, userManager.PERMISSIONS.DOCKER_START)) {
      return res.status(403).json({ error: 'Insufficient permissions to start containers' });
    }
    if (action === 'stop' && !userManager.hasPermission(user, userManager.PERMISSIONS.DOCKER_STOP)) {
      return res.status(403).json({ error: 'Insufficient permissions to stop containers' });
    }
    if (action === 'restart' && !userManager.hasPermission(user, userManager.PERMISSIONS.DOCKER_RESTART)) {
      return res.status(403).json({ error: 'Insufficient permissions to restart containers' });
    }
    if (action === 'delete' && !userManager.hasPermission(user, userManager.PERMISSIONS.DOCKER_DELETE)) {
      return res.status(403).json({ error: 'Insufficient permissions to delete containers' });
    }
    if (action === 'update') {
      // Update requires either docker restart permission (for non-sb apps) or saltbox execute (for sb apps)
      // We'll check both and allow if either is present
      const hasDockerRestart = userManager.hasPermission(user, userManager.PERMISSIONS.DOCKER_RESTART);
      const hasSaltboxExecute = userManager.hasPermission(user, userManager.PERMISSIONS.SALTBOX_EXECUTE);
      if (!hasDockerRestart && !hasSaltboxExecute) {
        return res.status(403).json({ error: 'Insufficient permissions to update containers' });
      }
    }

    // Find container by ID or name
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id.startsWith(appId) || c.Names.some(n => n.replace(/^\//, '').includes(appId))
    );

    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);

    switch (action) {
      case 'start':
        await dockerContainer.start();
        break;
      case 'stop':
        await dockerContainer.stop();
        break;
      case 'restart':
        await dockerContainer.restart();
        break;
      case 'delete':
        // Only allow deleting stopped containers
        const deleteInfo = await dockerContainer.inspect();
        if (deleteInfo.State.Running) {
          return res.status(400).json({ error: 'Cannot delete a running container. Stop it first.' });
        }
        await dockerContainer.remove({ v: false });
        return res.json({ success: true, message: 'Container deleted' });
      case 'update':
        // Check if this is a Saltbox app
        const containerInfo = await dockerContainer.inspect();
        const containerName = container.Names[0].replace(/^\//, '');
        
        // Check if app is in sb list
        let isSbApp = false;
        let sbAppName = null;
        try {
          if (!sbListCache) {
            sbListCache = await fetchSbList();
          }
          
          // Check saltbox apps first
          for (const app of sbListCache.saltbox) {
            if (containerName === app || containerName.startsWith(app + '-')) {
              isSbApp = true;
              sbAppName = app;
              break;
            }
          }
          
          // Check sandbox apps
          if (!isSbApp) {
            for (const app of sbListCache.sandbox) {
              const sandboxAppName = `sandbox-${app}`;
              // Check if container name matches sandbox-{app} or just {app}
              if (containerName === sandboxAppName || containerName === app || 
                  containerName.startsWith(sandboxAppName + '-') || containerName.startsWith(app + '-')) {
                isSbApp = true;
                sbAppName = sandboxAppName;
                break;
              }
            }
          }
        } catch (err) {
          console.error('Error checking sb list:', err);
        }

        if (isSbApp && sbAppName) {
          // Use sb install to update
          const user = userManager.getUserById(req.session.userId);
          if (!userManager.hasPermission(user, userManager.PERMISSIONS.SALTBOX_EXECUTE)) {
            return res.status(403).json({ error: 'Insufficient permissions to execute Saltbox commands' });
          }

          const { stdout, stderr } = await execAsync(buildSshCommand(`sb install ${sbAppName}`), {
            env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
            maxBuffer: 10 * 1024 * 1024,
          });

          return res.json({ 
            success: true, 
            message: `Updated ${containerName} using sb install`,
            output: stdout,
            error: stderr
          });
        } else {
          // Regular docker update: pull and recreate
          const imageName = containerInfo.Config.Image;
          const image = docker.getImage(imageName);
          
          // Pull the latest image
          await new Promise((resolve, reject) => {
            docker.pull(imageName, (err, stream) => {
              if (err) return reject(err);
              
              docker.modem.followProgress(stream, (err, output) => {
                if (err) return reject(err);
                resolve(output);
              });
            });
          });
          
          // Try to find and use docker-compose if available
          // Check if there's a docker-compose file in common locations
          const composePaths = [
            `/opt/${containerName}/docker-compose.yml`,
            `/opt/${containerName}/compose.yml`,
            `/opt/containers/${containerName}/docker-compose.yml`,
            `/opt/containers/${containerName}/compose.yml`,
          ];
          
          let usedCompose = false;
          for (const composePath of composePaths) {
            if (fs.existsSync(composePath)) {
              const composeDir = dirname(composePath);
              await execAsync('docker-compose pull && docker-compose up -d', {
                cwd: composeDir,
                env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
              });
              usedCompose = true;
              break;
            }
          }
          
          if (!usedCompose) {
            // Fallback: stop container, user will need to restart manually or recreate
            await dockerContainer.stop();
            return res.json({ 
              success: true, 
              message: `Pulled latest image for ${containerName}. Please restart the container manually.`,
              note: 'Container stopped. Please restart it manually or recreate it with the new image.'
            });
          } else {
            return res.json({ 
              success: true, 
              message: `Updated ${containerName} using docker-compose`
            });
          }
        }
        break;
    }

    res.json({ success: true, message: `${action} ${container.Names[0]}` });
  } catch (error) {
    console.error(`Error ${req.params.action}ing container:`, error);
    res.status(500).json({ error: `Failed to ${req.params.action} container`, details: error.message });
  }
});

// Execute Saltbox CLI command
app.post('/api/saltbox/command', async (req, res) => {
  try {
    // Check permissions
    const user = userManager.getUserById(req.session.userId);
    if (!userManager.hasPermission(user, userManager.PERMISSIONS.SALTBOX_EXECUTE)) {
      return res.status(403).json({ error: 'Insufficient permissions to execute Saltbox commands' });
    }

    let { command } = req.body;
    
    // Validate command to prevent injection. Subcommands mirror the current
    // Saltbox CLI (`sb --help`). Backups/restores run as install tags
    // (`sb install backup`), not a standalone `sb backup` subcommand.
    // Allow: sb update [--flags], sb install <tags>, and read-only diagnostics.
    const commandPattern = /^sb\s+(update(\s+--[\w-]+)*|install\s+[\w,\s.-]+|list|diag|logs|version|validate-config)$/;
    if (!commandPattern.test(command)) {
      console.error('Command validation failed:', command);
      return res.status(400).json({ error: 'Command not allowed or invalid format', received: command });
    }

    // Additional safety: ensure install commands only contain safe characters
    if (command.startsWith('sb install')) {
      const installMatch = command.match(/^sb install (.+)$/);
      if (installMatch) {
        const apps = installMatch[1];
        // Only allow alphanumeric, commas, hyphens, underscores, and spaces
        if (!/^[\w,\s-]+$/.test(apps)) {
          return res.status(400).json({ error: 'Invalid characters in app name(s)' });
        }
      }
    }

    // Check if this is a command that needs streaming output
    const needsStreaming = command.startsWith('sb update');
    
    if (needsStreaming) {
      // For sb update, return a job ID and let client connect via WebSocket
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize job store if needed
      if (!global.jobStore) global.jobStore = {};
      
      // Log file paths: host path for SSH commands, container path for reading via /hostfs mount
      const hostLogFile = `/tmp/spyglass-${jobId}.log`;
      const containerLogFile = `/hostfs/tmp/spyglass-${jobId}.log`;

      // Use SSH to run the command on the host with script for pseudo-TTY
      // script writes output to hostLogFile on the host filesystem
      const scriptCommand = `script -fqe -c "${command}" ${hostLogFile}`;

      try {
        // Run via SSH: start script in background on the host and capture PID
        const sshCommand = buildSshCommand(`${scriptCommand} </dev/null & echo $!; disown`);

        const { stdout } = await execAsync(sshCommand, {
          env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
          maxBuffer: 1024,
          timeout: 30000,
        });

        // Parse the PID from SSH output
        const pid = stdout.trim().split('\n').pop().trim();

        // Verify PID is valid
        if (!pid || isNaN(parseInt(pid))) {
          throw new Error(`Invalid PID received: ${pid}`);
        }

        // Store job info - use container path for log reading, host path for reference
        global.jobStore[jobId] = {
          pid: parseInt(pid),
          logFile: containerLogFile,
          hostLogFile,
          command,
          status: 'running',
          startTime: Date.now(),
          scriptHeaderSkipped: false,
          sentInitialMessage: false
        };

        console.log(`Started job ${jobId} via SSH with host PID ${pid}, hostLogFile: ${hostLogFile}, containerLogFile: ${containerLogFile}`);

        // Wait a moment for the command to start writing to the log
        await new Promise(resolve => setTimeout(resolve, 1000));

        return res.json({
          success: true,
          message: 'Command started',
          jobId: jobId,
          command: command
        });
      } catch (err) {
        console.error('Error starting background job via SSH:', err);
        console.error('Error stack:', err.stack);

        return res.status(500).json({
          error: 'Failed to start command',
          details: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    }
    
    // Execute command with timeout and proper options for non-TTY environment
    // Use nohup and redirect to bypass TTY requirements for long-running commands
    const isLongRunningCommand = command.startsWith('sb install') ||
                                 command.startsWith('sb backup');
    
    if (isLongRunningCommand) {
      // Run via SSH on host with nohup in background, capture PID
      const hostLogFile = `/tmp/spyglass-${Date.now()}.log`;
      // Use disown and close all FDs so SSH exits immediately after backgrounding
      const fullCommand = buildSshCommand(`nohup ${command} > ${hostLogFile} 2>&1 </dev/null & echo $!; disown`);

      const { stdout } = await execAsync(fullCommand, {
        env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
        maxBuffer: 1024,
        timeout: 30000,
      });

      const pid = stdout.trim().split('\n').pop().trim();

      return res.json({
        success: true,
        message: 'Command started in background',
        pid: pid,
        command: command,
        logFile: `/hostfs${hostLogFile}`
      });
    } else {
      // For other commands (sb status, sb inventory, etc.), run via SSH
      const sshCommand = buildSshCommand(command);
      const { stdout, stderr } = await execAsync(sshCommand, {
        timeout: 600000,
        maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
      });

      res.json({ success: true, output: stdout, error: stderr });
    }
  } catch (error) {
    console.error('Error executing command:', error);
    
    // Check if error is due to TTY requirement
    if (error.stderr && error.stderr.includes('requires an interactive terminal')) {
      return res.status(400).json({ 
        error: 'Command requires interactive terminal. Some commands cannot be run via API.',
        details: error.stderr,
        suggestion: 'Try running this command directly in a terminal with TTY access.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to execute command', 
      details: error.message,
      output: error.stdout || '',
      stderr: error.stderr || ''
    });
  }
});

// WebSocket endpoint for command progress streaming
app.ws('/api/command/progress/:jobId', (ws, req) => {
  if (!req.session || !req.session.authenticated || !req.session.userId) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  const wsUser = userManager.getUserById(req.session.userId);
  if (!wsUser || !userManager.hasPermission(wsUser, userManager.PERMISSIONS.SALTBOX_VIEW)) {
    ws.close(1008, 'Forbidden: Insufficient permissions');
    return;
  }
  
  const { jobId } = req.params;
  
  console.log(`WebSocket connection for job ${jobId}`);
  
  if (!global.jobStore || !global.jobStore[jobId]) {
    console.error(`Job ${jobId} not found in jobStore`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Job not found'
    }));
    ws.close(1008, 'Job not found');
    return;
  }
  
  const job = global.jobStore[jobId];
  let lastPosition = 0;
  let interval = null;
  
  console.log(`Streaming job ${jobId}, logFile: ${job.logFile}, PID: ${job.pid}`);
  
  // Function to read log file and send updates
  const sendUpdates = () => {
    try {
      if (fs.existsSync(job.logFile)) {
        const content = fs.readFileSync(job.logFile, 'utf8');
        
        // Skip script header on first read (starts with "Script started on...")
        let headerOffset = 0;
        if (!job.scriptHeaderSkipped && content.includes('Script started on')) {
          const headerEnd = content.indexOf('\n', content.indexOf('Script started on'));
          if (headerEnd !== -1) {
            headerOffset = headerEnd + 1;
            job.scriptHeaderSkipped = true;
            // Adjust lastPosition to account for skipped header
            if (lastPosition < headerOffset) {
              lastPosition = headerOffset;
            }
          }
        }
        
        // Get new content after the last position we've read
        const newContent = content.slice(lastPosition);
        
        // Handle first read - skip script header and footer
        if (content.length > 0 && lastPosition === 0) {
          let actualContent = content;
          let skipFooter = false;
          
          // Skip script header if present
          if (content.includes('Script started on')) {
            const headerStart = content.indexOf('Script started on');
            const headerEnd = content.indexOf('\n', headerStart);
            if (headerEnd !== -1) {
              actualContent = content.slice(headerEnd + 1);
              job.scriptHeaderSkipped = true;
            }
          }
          
          // Skip script footer if present
          if (actualContent.includes('Script done on')) {
            const footerStart = actualContent.indexOf('Script done on');
            actualContent = actualContent.slice(0, footerStart);
            skipFooter = true;
          }
          
          // Send the actual content (without header/footer)
          if (actualContent.trim().length > 0 && ws.readyState === 1) {
            const cleanedContent = stripAnsi(actualContent);
            console.log(`Sending initial content (${actualContent.length} bytes, ${cleanedContent.length} after cleaning) for job ${jobId}`);
            ws.send(JSON.stringify({
              type: 'output',
              data: cleanedContent,
            }));
            lastPosition = skipFooter ? content.indexOf('Script done on') : content.length;
          } else if (actualContent.trim().length === 0 && ws.readyState === 1) {
            // Content is empty after removing header/footer, send a message
            ws.send(JSON.stringify({
              type: 'output',
              data: 'Command executed (no output)\n',
            }));
            lastPosition = content.length;
          }
        } else if (newContent && newContent.trim().length > 0) {
          // Subsequent reads - send new content
          const cleanedContent = stripAnsi(newContent);
          console.log(`Sending ${newContent.length} bytes of output (${cleanedContent.length} after cleaning) for job ${jobId}, WS state: ${ws.readyState}`);
          if (ws.readyState === 1) { // WebSocket.OPEN
            try {
              ws.send(JSON.stringify({
                type: 'output',
                data: cleanedContent,
              }));
              lastPosition = content.length;
              console.log(`Sent output, new lastPosition: ${lastPosition}`);
            } catch (sendErr) {
              console.error('Error sending WebSocket message:', sendErr);
            }
          } else {
            console.warn(`WebSocket not open for job ${jobId}, state: ${ws.readyState}`);
          }
        } else if (content.length === 0 && lastPosition === 0) {
          // File exists but is empty, send initial message only once
          if (ws.readyState === 1 && !job.sentInitialMessage) {
            ws.send(JSON.stringify({
              type: 'output',
              data: 'Command starting...\n',
            }));
            job.sentInitialMessage = true;
          }
        }
        
        // Check if host process is still running via /hostfs/proc mount
        let processRunning = false;
        try {
          processRunning = fs.existsSync(`/hostfs/proc/${job.pid}`);
        } catch (err) {
          processRunning = false;
        }
        
        if (!processRunning) {
          // Process has ended
          console.log(`Process ${job.pid} has ended`);
          
          // Read final content
          if (fs.existsSync(job.logFile)) {
            const finalContent = fs.readFileSync(job.logFile, 'utf8');
            const remaining = finalContent.slice(lastPosition);
            if (remaining) {
              const cleanedRemaining = stripAnsi(remaining);
              ws.send(JSON.stringify({
                type: 'output',
                data: cleanedRemaining,
              }));
            }
          }
          
          job.status = 'completed';
          
          // If this was an sb update command, invalidate the sb list cache and enable file cache updates
          if (job.command && job.command.startsWith('sb update')) {
            console.log('sb update completed, invalidating sb list cache and enabling description cache updates...');
            sbListCache = null;
            sbUpdateCompleted = true;
            // Save any pending descriptions to file cache now that sb update has completed
            saveAppDescriptionsCache(appDescriptionsFileCache);
          }
          
          ws.send(JSON.stringify({
            type: 'completed',
            jobId: jobId,
          }));
          
          if (interval) clearInterval(interval);
          setTimeout(() => ws.close(), 1000);
          return;
        }
      } else {
        // Log file doesn't exist yet, send a message
        if (lastPosition === 0) {
          ws.send(JSON.stringify({
            type: 'output',
            data: 'Waiting for command to start...\n',
          }));
        }
      }
    } catch (err) {
      console.error('Error reading log file:', err);
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'error',
          message: `Error reading log: ${err.message}`
        }));
      }
    }
  };
  
  // Send updates every 500ms
  interval = setInterval(sendUpdates, 500);
  
  ws.on('close', () => {
    console.log(`WebSocket closed for job ${jobId}`);
    if (interval) clearInterval(interval);
  });
  
  ws.on('error', (err) => {
    console.error(`WebSocket error for job ${jobId}:`, err);
    if (interval) clearInterval(interval);
  });
  
  // Send initial update
  sendUpdates();
});

// WebSocket endpoint for terminal
app.ws('/api/terminal', (ws, req) => {
  if (!req.session || !req.session.authenticated || !req.session.userId) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  const termUser = userManager.getUserById(req.session.userId);
  if (!termUser || !userManager.hasPermission(termUser, userManager.PERMISSIONS.TERMINAL_EXECUTE)) {
    ws.close(1008, 'Forbidden: Insufficient permissions');
    return;
  }

  // SSH to host for terminal access (SSH_USER must be set in environment)
  const sshUser = process.env.SSH_USER;
  const sshHost = process.env.SSH_HOST || 'host.docker.internal';

  if (!sshUser) {
    ws.send('\r\n\x1b[31mError: SSH_USER environment variable not set.\x1b[0m\r\n');
    ws.send('Please configure SSH_USER in your .env file.\r\n');
    ws.close();
    return;
  }

  const ptyProcess = pty.spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'LogLevel=ERROR',
    `${sshUser}@${sshHost}`
  ], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    env: process.env,
  });

  // Send terminal output to client
  ptyProcess.onData((data) => {
    ws.send(data);
  });

  // Handle client input
  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.type === 'input') {
      ptyProcess.write(data.data);
    } else if (data.type === 'resize') {
      ptyProcess.resize(data.cols || 80, data.rows || 24);
    }
  });

  // Handle cleanup
  ws.on('close', () => {
    ptyProcess.kill();
  });

  ptyProcess.onExit(() => {
    ws.close();
  });
});

// WebSocket endpoint for Docker container logs
app.ws('/api/docker/:containerId/logs', async (ws, req) => {
  if (!req.session || !req.session.authenticated || !req.session.userId) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  const logUser = userManager.getUserById(req.session.userId);
  if (!logUser || !userManager.hasPermission(logUser, userManager.PERMISSIONS.DOCKER_VIEW)) {
    ws.close(1008, 'Forbidden: Insufficient permissions');
    return;
  }
  
  const { containerId } = req.params;
  const { tail = '100', follow = 'true', timestamps = 'false' } = req.query;
  
  try {
    // Find container by ID or name
    const containers = await docker.listContainers({ all: true });
    
    const container = containers.find(c => 
      c.Id.startsWith(containerId) || c.Names.some(n => n.replace(/^\//, '').includes(containerId))
    );
    
    if (!container) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Container not found'
      }));
      ws.close(1008, 'Container not found');
      return;
    }
    
    const dockerContainer = docker.getContainer(container.Id);
    
    // Get container logs
    const logOptions = {
      stdout: true,
      stderr: true,
      tail: parseInt(tail) || 100,
      follow: follow === 'true',
      timestamps: timestamps === 'true'
    };
    
    const stream = await new Promise((resolve, reject) => {
      dockerContainer.logs(logOptions, (err, stream) => {
        if (err) {
          reject(err);
        } else {
          resolve(stream);
        }
      });
    });
    
    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connected',
      message: `Connected to logs for container: ${container.Names[0].replace(/^\//, '')}`
    }));

    // Check if container uses TTY (no multiplexing needed)
    const containerInfo = await dockerContainer.inspect();
    const isTty = containerInfo.Config.Tty;

    // Function to demultiplex Docker log stream
    // Docker log format: 8-byte header + payload
    // Header: [stream_type (1 byte), 0, 0, 0, size (4 bytes big-endian)]
    const demuxDockerLogs = (chunk) => {
      const results = [];
      let offset = 0;

      while (offset < chunk.length) {
        // Need at least 8 bytes for header
        if (offset + 8 > chunk.length) {
          // Remaining bytes are incomplete, just convert to string
          const remaining = chunk.slice(offset).toString('utf8');
          if (remaining.trim()) results.push(remaining);
          break;
        }

        // Read header
        const streamType = chunk[offset]; // 1=stdout, 2=stderr
        const size = chunk.readUInt32BE(offset + 4);

        // Validate - if stream type is not 0, 1, or 2, this might be raw text
        if (streamType > 2) {
          // Not a multiplexed stream, just convert the whole thing
          results.push(chunk.slice(offset).toString('utf8'));
          break;
        }

        // Extract payload
        const payloadStart = offset + 8;
        const payloadEnd = payloadStart + size;

        if (payloadEnd <= chunk.length) {
          const payload = chunk.slice(payloadStart, payloadEnd).toString('utf8');
          if (payload) results.push(payload);
          offset = payloadEnd;
        } else {
          // Incomplete payload, get what we can
          const payload = chunk.slice(payloadStart).toString('utf8');
          if (payload) results.push(payload);
          break;
        }
      }

      return results.join('');
    };

    // Stream logs to WebSocket
    stream.on('data', (chunk) => {
      let logLine;
      if (isTty) {
        // TTY containers send raw text without multiplexing
        logLine = chunk.toString('utf8');
      } else {
        // Non-TTY containers use multiplexed stream format
        logLine = demuxDockerLogs(chunk);
      }

      // Strip ANSI codes and send
      const cleanedLog = stripAnsi(logLine);
      if (cleanedLog && ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'log',
          data: cleanedLog
        }));
      }
    });
    
    stream.on('end', () => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'end',
          message: 'Log stream ended'
        }));
      }
      ws.close();
    });
    
    stream.on('error', (streamErr) => {
      console.error('Log stream error:', streamErr);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Log stream error: ${streamErr.message}`
        }));
      }
      ws.close(1008, 'Log stream error');
    });
    
    // Handle WebSocket close
    ws.on('close', () => {
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
    });
  } catch (err) {
    console.error('Error setting up Docker logs:', err);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to get logs: ${err.message}`
    }));
    ws.close(1008, 'Failed to get logs');
  }
});

// Serve static files in production
// YAML config file paths
const CONFIG_FILES = {
  inventory: '/srv/git/saltbox/inventories/host_vars/localhost.yml',
  settings: '/srv/git/saltbox/settings.yml',
  accounts: '/srv/git/saltbox/accounts.yml',
  adv_settings: '/srv/git/saltbox/adv_settings.yml',
  backup: '/srv/git/saltbox/backup_config.yml'
};

// Legacy authentication middleware (kept for backward compatibility)
// New middleware is imported from server/middleware.js

// Helper function to get credentials from accounts.yml
function getCredentialsFromAccounts() {
  try {
    const accountsPath = CONFIG_FILES.accounts;
    if (!fs.existsSync(accountsPath)) {
      return null;
    }
    const content = fs.readFileSync(accountsPath, 'utf8');
    const data = yaml.load(content) || {};
    return {
      username: data.user?.name || null,
      password: data.user?.pass || null
    };
  } catch (error) {
    console.error('Error reading accounts.yml:', error);
    return null;
  }
}

// Initialize user management system with admin from accounts.yml
(async () => {
  await userManager.initializeDefaultAdmin(getCredentialsFromAccounts);
})();

// Login endpoint
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Try new user management system first
    const user = userManager.getUserByUsername(username);
    
    if (user && user.active) {
      const isValid = await userManager.verifyPassword(password, user.password);
      if (isValid) {
        req.session.authenticated = true;
        req.session.userId = user.id;
        req.session.username = user.username;
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ 
          success: true, 
          message: 'Login successful',
          user: userWithoutPassword
        });
      }
    }
    
    // Legacy accounts.yml fallback removed for security (plaintext password comparison)
    // Users must be managed through the user management system

    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logout successful' });
  });
});

// Check authentication status
app.get('/api/auth/status', attachUser, (req, res) => {
  if (req.user) {
    const { password: _, ...userWithoutPassword } = req.user;
    userWithoutPassword.permissions = userManager.getEffectivePermissions(req.user);
    res.json({
      authenticated: true,
      username: req.user.username,
      user: userWithoutPassword
    });
  } else {
    res.json({ 
      authenticated: false,
      username: null,
      user: null
    });
  }
});

// User Management API endpoints
app.get('/api/users', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_VIEW), (req, res) => {
  try {
    const users = userManager.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_VIEW), (req, res) => {
  try {
    const user = userManager.getUserById(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.post('/api/users', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_CREATE), async (req, res) => {
  try {
    const user = await userManager.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_EDIT), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    // Prevent users from editing themselves to remove admin access
    if (userId === req.session.userId && req.body.role && req.body.role !== 'admin') {
      const currentUser = userManager.getUserById(req.session.userId);
      if (currentUser && currentUser.role === 'admin') {
        return res.status(400).json({ error: 'Cannot change your own admin role' });
      }
    }
    const user = await userManager.updateUser(userId, req.body);
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: error.message || 'Failed to update user' });
  }
});

app.delete('/api/users/:id', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_DELETE), (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    // Prevent users from deleting themselves
    if (userId === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    userManager.deleteUser(userId);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(400).json({ error: error.message || 'Failed to delete user' });
  }
});

app.get('/api/users/roles/list', requireAuth, (req, res) => {
  try {
    // Return roles from roleManager (custom + system)
    const roles = roleManager.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

app.get('/api/users/permissions/list', requireAuth, (req, res) => {
  try {
    res.json(userManager.PERMISSIONS);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Role Management API endpoints
app.get('/api/roles', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_VIEW), (req, res) => {
  try {
    const roles = roleManager.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

app.get('/api/roles/:id', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_VIEW), (req, res) => {
  try {
    const role = roleManager.getRoleById(parseInt(req.params.id));
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

app.post('/api/roles', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_CREATE), (req, res) => {
  try {
    const role = roleManager.createRole(req.body);
    res.status(201).json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(400).json({ error: error.message || 'Failed to create role' });
  }
});

app.put('/api/roles/:id', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_EDIT), (req, res) => {
  try {
    const role = roleManager.updateRole(parseInt(req.params.id), req.body);
    res.json(role);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(400).json({ error: error.message || 'Failed to update role' });
  }
});

app.delete('/api/roles/:id', requireAuth, requirePermission(userManager.PERMISSIONS.USERS_DELETE), async (req, res) => {
  try {
    await roleManager.deleteRole(parseInt(req.params.id));
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(400).json({ error: error.message || 'Failed to delete role' });
  }
});

// Note: Global API auth middleware is defined earlier (before first route handler)
// User management routes defined above already have their own auth/permission checks

// Get all config files (for precaching) - MUST be before /api/config/:file
app.get('/api/config/all', requirePermission(userManager.PERMISSIONS.CONFIG_VIEW), async (req, res) => {
  try {
    const configs = {};
    
    for (const [key, path] of Object.entries(CONFIG_FILES)) {
      if (fs.existsSync(path)) {
        try {
          const content = fs.readFileSync(path, 'utf8');
          const data = yaml.load(content) || {};
          configs[key] = {
            data: data,
            raw: content,
            exists: true
          };
        } catch (error) {
          configs[key] = {
            exists: true,
            error: error.message
          };
        }
      } else {
        configs[key] = {
          exists: false
        };
      }
    }
    
    res.json({ success: true, configs });
  } catch (error) {
    console.error('Error reading all config files:', error);
    res.status(500).json({ 
      error: 'Failed to read config files', 
      details: error.message 
    });
  }
});

// Read YAML config file
app.get('/api/config/:file', requirePermission(userManager.PERMISSIONS.CONFIG_VIEW), async (req, res) => {
  try {
    const { file } = req.params;
    
    // Reject "all" as a file name
    if (file === 'all') {
      return res.status(400).json({ error: 'Invalid config file name' });
    }
    
    const filePath = CONFIG_FILES[file];
    
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid config file name' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Config file not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content) || {};
    
    res.json({ 
      success: true, 
      data: data,
      raw: content
    });
  } catch (error) {
    console.error('Error reading config file:', error);
    res.status(500).json({ 
      error: 'Failed to read config file', 
      details: error.message 
    });
  }
});

// Write YAML config file
app.post('/api/config/:file', requirePermission(userManager.PERMISSIONS.CONFIG_EDIT), async (req, res) => {
  try {
    const { file } = req.params;
    const { data } = req.body;
    const filePath = CONFIG_FILES[file];
    
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid config file name' });
    }
    
    // Validate data is an object
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    // Convert to YAML and write
    // Use better options for Saltbox inventory format
    const yamlContent = yaml.dump(data, {
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
      indent: 2,
      styles: {
        '!!null': 'empty', // Use empty for null
        '!!bool': 'lowercase', // Use true/false lowercase
      },
      sortKeys: false, // Preserve key order
      noCompatMode: true,
    });
    
    // Backup original file
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }
    
    fs.writeFileSync(filePath, yamlContent, 'utf8');
    
    res.json({ 
      success: true, 
      message: 'Config file updated successfully' 
    });
  } catch (error) {
    console.error('Error writing config file:', error);
    res.status(500).json({ 
      error: 'Failed to write config file', 
      details: error.message 
    });
  }
});

// Icon management endpoints
const upload = multer({ 
  dest: CUSTOM_ICONS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/webp' || 
        file.mimetype === 'image/png' || 
        file.mimetype === 'image/jpeg' || 
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/svg+xml') {
      cb(null, true);
    } else {
      cb(new Error('Only webp, png, jpeg, and svg images are allowed'));
    }
  }
});

// Icon fetch endpoint (no-op since icons are served from CDN)
app.post('/api/icons/fetch', async (req, res) => {
  res.json({ success: true, message: 'Icons are served from CDN, no caching needed' });
});

// Upload custom icon
app.post('/api/icons/upload', requireAuth, requirePermission(userManager.PERMISSIONS.CONFIG_EDIT), upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { appName } = req.body;
    if (!appName) {
      fs.unlinkSync(req.file.path); // Clean up uploaded file
      return res.status(400).json({ error: 'App name is required' });
    }
    
    const normalized = normalizeAppName(appName);
    const finalPath = join(CUSTOM_ICONS_DIR, `${normalized}.webp`);
    
    // If file is not webp, we'd need to convert it, but for now just rename
    // In production, you might want to convert PNG/JPEG to WebP
    if (req.file.mimetype !== 'image/webp') {
      // For now, just move the file with original extension
      const ext = req.file.originalname.split('.').pop() || 'png';
      const finalPathWithExt = join(CUSTOM_ICONS_DIR, `${normalized}.${ext}`);
      fs.renameSync(req.file.path, finalPathWithExt);
      res.json({ 
        success: true, 
        message: `Custom icon uploaded for ${appName}`,
        path: `/icons/custom/${normalized}.${ext}`
      });
    } else {
      fs.renameSync(req.file.path, finalPath);
      res.json({ 
        success: true, 
        message: `Custom icon uploaded for ${appName}`,
        path: `/icons/custom/${normalized}.webp`
      });
    }
  } catch (error) {
    console.error('Error uploading icon:', error);
    if (req.file) {
      fs.unlinkSync(req.file.path); // Clean up on error
    }
    res.status(500).json({ error: 'Failed to upload icon', details: error.message });
  }
});

// Icon pre-import endpoint (no-op since icons are served from CDN)
app.post('/api/icons/pre-import', async (req, res) => {
  res.json({ success: true, message: 'Icons are served from CDN, no pre-import needed' });
});

// List all custom icons
app.get('/api/icons/custom/list', (req, res) => {
  try {
    const customIcons = [];
    if (fs.existsSync(CUSTOM_ICONS_DIR)) {
      const files = fs.readdirSync(CUSTOM_ICONS_DIR);
      files.forEach(file => {
        const filePath = join(CUSTOM_ICONS_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          const ext = file.split('.').pop();
          const nameWithoutExt = file.replace(`.${ext}`, '');
          customIcons.push({
            name: nameWithoutExt,
            filename: file,
            path: `/icons/custom/${file}`,
            size: stats.size,
            extension: ext,
            modified: stats.mtime
          });
        }
      });
    }
    res.json({ icons: customIcons });
  } catch (error) {
    console.error('Error listing custom icons:', error);
    res.status(500).json({ error: 'Failed to list custom icons', details: error.message });
  }
});

// Delete custom icon
app.delete('/api/icons/custom/:appName', requireAuth, requirePermission(userManager.PERMISSIONS.CONFIG_EDIT), (req, res) => {
  try {
    const { appName } = req.params;
    const normalized = normalizeAppName(appName);
    
    // Try to find and delete the icon with any extension
    const extensions = ['.webp', '.png', '.jpg', '.jpeg', '.svg'];
    let deleted = false;
    
    for (const ext of extensions) {
      const iconPath = join(CUSTOM_ICONS_DIR, `${normalized}${ext}`);
      if (fs.existsSync(iconPath)) {
        fs.unlinkSync(iconPath);
        deleted = true;
        break;
      }
    }
    
    if (deleted) {
      res.json({ success: true, message: `Custom icon deleted for ${appName}` });
    } else {
      res.status(404).json({ error: `No custom icon found for ${appName}` });
    }
  } catch (error) {
    console.error('Error deleting custom icon:', error);
    res.status(500).json({ error: 'Failed to delete custom icon', details: error.message });
  }
});

// Get icon info for an app
app.get('/api/icons/:appName', (req, res) => {
  try {
    const { appName } = req.params;
    const iconPath = getAppIconPath(appName);
    const fallbackUrl = getFallbackIconUrl(appName);
    
    // getAppIconPath always returns a path (CDN URL or custom icon path)
    // Check if it's a custom icon (starts with /icons/custom) or CDN URL
    if (iconPath.startsWith('/icons/custom/')) {
      res.json({ 
        icon: iconPath,
        fallback: null,
        type: 'image'
      });
    } else if (iconPath.startsWith('http')) {
      // CDN URL - include fallback
      res.json({ 
        icon: iconPath,
        fallback: fallbackUrl,
        type: 'image'
      });
    } else {
      // Fallback to default emoji (shouldn't happen with new implementation)
      const lowerName = appName.toLowerCase();
      let defaultIcon = appIcons.default;
      for (const [key, icon] of Object.entries(appIcons)) {
        if (lowerName.includes(key)) {
          defaultIcon = icon;
          break;
        }
      }
      res.json({ 
        icon: defaultIcon,
        fallback: null,
        type: 'emoji'
      });
    }
  } catch (error) {
    console.error('Error getting icon:', error);
    res.status(500).json({ error: 'Failed to get icon', details: error.message });
  }
});

const isProduction = process.env.NODE_ENV === 'production';
const distPath = join(__dirname, 'dist');
if (isProduction && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Note: SPA catch-all route is defined at the end of the file after all API routes
}

// Widget management
const WIDGETS_FILE = join(__dirname, 'data', 'widgets.json');
const WIDGET_CONFIG_FILE = join(__dirname, 'data', 'widget-config.json');

// Ensure data directory exists
const DATA_DIR = join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper function to read widgets
function readWidgets() {
  try {
    if (fs.existsSync(WIDGETS_FILE)) {
      const content = fs.readFileSync(WIDGETS_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error reading widgets:', error);
  }
  return [];
}

// Helper function to write widgets
function writeWidgets(widgets) {
  try {
    fs.writeFileSync(WIDGETS_FILE, JSON.stringify(widgets, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing widgets:', error);
    return false;
  }
}

// Generate a unique category ID
function generateCategoryId() {
  return `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Ensure the __uncategorized__ category exists in config
function ensureUncategorized(config) {
  if (!config.categories) {
    config.categories = [];
  }
  const hasUncat = config.categories.some(c => c.id === '__uncategorized__');
  if (!hasUncat) {
    config.categories.push({
      id: '__uncategorized__',
      name: 'Uncategorized',
      order: 999,
      widgetIds: []
    });
  }
  return config;
}

// Find which category a widget belongs to
function findWidgetCategory(config, widgetId) {
  if (!config.categories) return null;
  return config.categories.find(c => c.widgetIds && c.widgetIds.includes(widgetId)) || null;
}

// Helper function to read widget config with auto-migration
function readWidgetConfig() {
  try {
    if (fs.existsSync(WIDGET_CONFIG_FILE)) {
      const content = fs.readFileSync(WIDGET_CONFIG_FILE, 'utf8');
      let config = JSON.parse(content);

      // Auto-migrate from old { order: [] } format to new categories format
      if (config.order && !config.categories) {
        const widgets = readWidgets();
        const allWidgetIds = widgets.map(w => w.id);
        // Preserve order, include any widgets not in the order array
        const orderedIds = [...config.order];
        const missingIds = allWidgetIds.filter(id => !orderedIds.includes(id));
        const migratedConfig = {
          categories: [
            {
              id: '__uncategorized__',
              name: 'Uncategorized',
              order: 999,
              widgetIds: [...orderedIds, ...missingIds]
            }
          ]
        };
        // Write migrated format immediately
        writeWidgetConfig(migratedConfig);
        console.log('Migrated widget-config.json from order array to categories format');
        return migratedConfig;
      }

      // Ensure uncategorized always exists
      config = ensureUncategorized(config);
      return config;
    }
  } catch (error) {
    console.error('Error reading widget config:', error);
  }
  return ensureUncategorized({ categories: [] });
}

// Helper function to write widget config
function writeWidgetConfig(config) {
  try {
    fs.writeFileSync(WIDGET_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing widget config:', error);
    return false;
  }
}

// Helper function to extract config from Docker container
async function extractConfigFromContainer(containerId, appName) {
  try {
    const container = docker.getContainer(containerId);
    const containerInfo = await container.inspect();
    
    // Common config file locations
    const configPaths = [
      '/config/config.json',
      '/config/settings.json',
      '/app/config/config.json',
      '/app/config/settings.json',
      '/config/config.yml',
      '/config/settings.yml',
      '/app/config/config.yml',
      '/app/config/settings.yml',
      '/config/config.yaml',
      '/config/settings.yaml',
      '/app/config/config.yaml',
      '/app/config/settings.yaml',
      '/config/.env',
      '/app/.env',
      '/config/config.ini',
      '/app/config/config.ini',
      '~/.config/config.json',
      '~/.config/settings.json',
    ];
    
    // App-specific config paths
    const appSpecificPaths = {
      'sonarr': ['/config/config.xml'],
      'radarr': ['/config/config.xml'],
      'lidarr': ['/config/config.xml'],
      'readarr': ['/config/config.xml'],
      'prowlarr': ['/config/config.xml'],
      'bazarr': ['/config/config.ini'],
      'jellyfin': ['/config/data/jellyfin.db'],  // SQLite database
      'emby': ['/config/data/library.db'],  // SQLite database
      'plex': ['/config/Library/Application Support/Plex Media Server/Preferences.xml'],
      'overseerr': ['/app/config/settings.json'],
      'ombi': ['/config/Ombi.db'], // SQLite, would need special handling
      'jellyseerr': ['/app/config/settings.json'],
      'tautulli': ['/config/config.ini'],
      'portainer': ['/data/config.json'],
      'decypharr': ['/app/auth.json'],
      'nzbdav': ['/config/db.sqlite'],
    };

    // Apps that need SQLite extraction
    const sqliteApps = ['jellyfin', 'emby', 'ombi'];

    // App name aliases (container names may differ from app names)
    const appAliases = {
      'fin': 'jellyfin',
      'jelly': 'jellyfin',
      'jf': 'jellyfin',
    };

    const lowerAppName = appName.toLowerCase();
    const resolvedAppName = appAliases[lowerAppName] || lowerAppName;

    // Special handling for SQLite-based apps (Jellyfin, Emby)
    if (sqliteApps.includes(resolvedAppName)) {
      let sqlQuery = '';
      let containerDbPath = '';
      let hostDbPaths = [];

      // Get host path from container volume mounts
      const configMount = containerInfo.Mounts?.find(m =>
        m.Destination === '/config' || m.Destination.startsWith('/config')
      );
      const hostConfigPath = configMount?.Source || null;
      const containerName = containerInfo.Name.replace(/^\//, '').toLowerCase();

      if (resolvedAppName === 'jellyfin') {
        containerDbPath = '/config/data/data/jellyfin.db';
        sqlQuery = "SELECT AccessToken FROM ApiKeys ORDER BY DateCreated DESC LIMIT 1";
        // Build host paths - prefer volume mount path, then try common locations
        if (hostConfigPath) {
          hostDbPaths.push(`${hostConfigPath}/data/data/jellyfin.db`);
          hostDbPaths.push(`${hostConfigPath}/data/jellyfin.db`);
        }
        hostDbPaths.push(`/opt/${containerName}/data/data/jellyfin.db`);
        hostDbPaths.push(`/opt/${containerName}/data/jellyfin.db`);
        hostDbPaths.push(`/opt/jellyfin/data/data/jellyfin.db`);
      } else if (resolvedAppName === 'emby') {
        // Emby stores tokens in authentication.db
        containerDbPath = '/config/data/authentication.db';
        sqlQuery = "SELECT AccessToken FROM Tokens_2 WHERE IsActive=1 ORDER BY DateLastActivityInt DESC LIMIT 1";
        if (hostConfigPath) {
          hostDbPaths.push(`${hostConfigPath}/data/authentication.db`);
        }
        hostDbPaths.push(`/opt/${containerName}/data/authentication.db`);
        hostDbPaths.push(`/opt/emby/data/authentication.db`);
      }

      // First, try executing sqlite3 inside the container
      if (sqlQuery && containerDbPath) {
        try {
          const exec = await container.exec({
            Cmd: ['sh', '-c', `sqlite3 "${containerDbPath}" "${sqlQuery}" 2>/dev/null || echo "SQLITE_ERROR"`],
            AttachStdout: true,
            AttachStderr: true,
          });

          const stream = await exec.start({ hijack: true, stdin: false });

          let output = '';
          const result = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              stream.destroy();
              resolve(null);
            }, 5000);

            stream.on('data', (chunk) => {
              output += chunk.toString();
            });

            stream.on('end', () => {
              clearTimeout(timeout);
              // Clean output - remove any non-printable characters
              const cleanOutput = output.replace(/[\x00-\x1F\x7F]/g, '').trim();
              if (cleanOutput && !cleanOutput.includes('SQLITE_ERROR') && cleanOutput.length > 10 && cleanOutput.length < 200) {
                resolve({ path: containerDbPath, data: { accessToken: cleanOutput }, format: 'sqlite' });
              } else {
                resolve(null);
              }
            });

            stream.on('error', () => {
              clearTimeout(timeout);
              resolve(null);
            });
          });

          if (result) {
            return result;
          }
        } catch (err) {
          console.log(`SQLite extraction from container failed for ${lowerAppName}:`, err.message);
        }
      }

      // If container extraction failed, try host paths using Spyglass's sqlite3
      if (sqlQuery && hostDbPaths.length > 0) {
        for (const hostPath of hostDbPaths) {
          try {
            if (fs.existsSync(hostPath)) {
              console.log(`Trying host path: ${hostPath}`);
              const token = execSync(`sqlite3 "${hostPath}" "${sqlQuery}" 2>/dev/null`, { encoding: 'utf8', timeout: 5000 }).trim();
              if (token && token.length > 10 && token.length < 200) {
                console.log(`Successfully extracted token from host path: ${hostPath}`);
                return { path: hostPath, data: { accessToken: token }, format: 'sqlite' };
              }
            }
          } catch (err) {
            console.log(`Failed to extract from ${hostPath}:`, err.message);
          }
        }
      }
    }

    const allPaths = [
      ...(appSpecificPaths[lowerAppName] || []),
      ...configPaths
    ];

    // Try host filesystem first for apps with known mount paths
    const hostPathApps = {
      'decypharr': ['/opt/decypharr/auth.json', '/opt/dechypharr/auth.json'],
      'tautulli': ['/opt/tautulli/config.ini'],
    };
    const hostPaths = hostPathApps[resolvedAppName] || [];

    // Also try to resolve from container volume mounts
    const containerInspect = await container.inspect().catch(() => null);
    if (containerInspect?.Mounts) {
      for (const mount of containerInspect.Mounts) {
        for (const appPath of (appSpecificPaths[resolvedAppName] || [])) {
          // If the app config path starts with the mount destination, build the host path
          if (appPath.startsWith(mount.Destination)) {
            const relativePath = appPath.substring(mount.Destination.length);
            hostPaths.push(`${mount.Source}${relativePath}`);
          }
        }
      }
    }

    for (const hostPath of hostPaths) {
      try {
        if (fs.existsSync(hostPath)) {
          console.log(`[extractConfig] Found host file: ${hostPath}`);
          const content = fs.readFileSync(hostPath, 'utf8');
          try {
            return { path: hostPath, data: JSON.parse(content), format: 'json' };
          } catch {
            return { path: hostPath, data: content, format: 'text' };
          }
        }
      } catch (err) {
        console.log(`[extractConfig] Host path ${hostPath} failed:`, err.message);
      }
    }

    // Try to find and read config files via Docker exec
    for (const configPath of allPaths) {
      // Skip binary database files - they can't be read with cat
      if (configPath.endsWith('.db') || configPath.endsWith('.sqlite') || configPath.endsWith('.sqlite3')) {
        continue;
      }

      try {
        // Execute command to check if file exists and read it
        const exec = await container.exec({
          Cmd: ['sh', '-c', `test -f "${configPath}" && cat "${configPath}" || echo "FILE_NOT_FOUND"`],
          AttachStdout: true,
          AttachStderr: true,
        });
        
        const stream = await exec.start({ hijack: true, stdin: false });

        let output = '';
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            stream.destroy();
            resolve(null);
          }, 5000);

          // Use PassThrough streams to properly demux Docker's framed output
          const { PassThrough } = require('stream');
          const stdout = new PassThrough();
          const stderr = new PassThrough();
          container.modem.demuxStream(stream, stdout, stderr);

          stdout.on('data', (chunk) => {
            output += chunk.toString();
          });

          stream.on('end', () => {
            clearTimeout(timeout);
            if (output && !output.includes('FILE_NOT_FOUND')) {
              try {
                // Try to parse as JSON
                const jsonData = JSON.parse(output);
                resolve({ path: configPath, data: jsonData, format: 'json' });
              } catch {
                // Try to parse as YAML
                try {
                  const yamlData = yaml.load(output);
                  resolve({ path: configPath, data: yamlData, format: 'yaml' });
                } catch {
                  // Try to parse as XML (for Sonarr/Radarr/etc)
                  try {
                    if (output.trim().startsWith('<?xml') || output.trim().startsWith('<')) {
                      const xmlData = {};
                      
                      // Extract ApiKey from XML elements (Sonarr/Radarr/etc)
                      const apiKeyMatch = output.match(/<ApiKey>([^<]+)<\/ApiKey>/i);
                      if (apiKeyMatch) xmlData.ApiKey = apiKeyMatch[1];
                      
                      // Extract Port from XML elements
                      const portMatch = output.match(/<Port>([^<]+)<\/Port>/i);
                      if (portMatch) xmlData.Port = portMatch[1];
                      
                      // Extract PlexOnlineToken from XML attributes (Plex)
                      const plexTokenMatch = output.match(/PlexOnlineToken="([^"]+)"/i);
                      if (plexTokenMatch) xmlData.PlexOnlineToken = plexTokenMatch[1];
                      
                      // Store raw XML for additional parsing if needed
                      xmlData._rawXml = output;
                      
                      if (Object.keys(xmlData).length > 0) {
                        resolve({ path: configPath, data: xmlData, format: 'xml' });
                      } else {
                        resolve({ path: configPath, data: output, format: 'text' });
                      }
                    } else {
                      resolve({ path: configPath, data: output, format: 'text' });
                    }
                  } catch {
                    // Return as text
                    resolve({ path: configPath, data: output, format: 'text' });
                  }
                }
              }
            } else {
              resolve(null);
            }
          });
          
          stream.on('error', (err) => {
            clearTimeout(timeout);
            resolve(null);
          });
        });
        
        if (result) {
          return result;
        }
      } catch (err) {
        // Continue to next path
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting config from container:', error);
    return null;
  }
}

// Helper function to extract API token from config
function extractApiToken(config, appName) {
  if (!config || !config.data) return null;
  
  const lowerAppName = appName.toLowerCase();
  const data = config.data;
  
  // Handle string data (text format) - extract directly from XML string
  if (typeof data === 'string') {
    // For Plex, extract PlexOnlineToken from XML string
    if (lowerAppName === 'plex') {
      const plexTokenMatch = data.match(/PlexOnlineToken="([^"]+)"/i);
      if (plexTokenMatch) {
        return plexTokenMatch[1];
      }
    }
    // For other apps with XML, try to extract ApiKey
    if (data.includes('<ApiKey>')) {
      const apiKeyMatch = data.match(/<ApiKey>([^<]+)<\/ApiKey>/i);
      if (apiKeyMatch) {
        return apiKeyMatch[1];
      }
    }
    return null;
  }
  
  // Handle object data
  // Common token field names
  const tokenFields = [
    'apiKey', 'apikey', 'api_key', 'API_KEY',
    'token', 'Token', 'TOKEN',
    'accessToken', 'access_token', 'ACCESS_TOKEN',
    'authToken', 'auth_token', 'AUTH_TOKEN',
    'api_token', 'apiToken', 'API_TOKEN',
    'apikey', 'ApiKey', 'APIKEY',
  ];
  
  // App-specific token locations
  const appSpecificTokens = {
    'sonarr': data.ApiKey || data.apiKey,
    'radarr': data.ApiKey || data.apiKey,
    'lidarr': data.ApiKey || data.apiKey,
    'readarr': data.ApiKey || data.apiKey,
    'prowlarr': data.ApiKey || data.apiKey,
    'overseerr': data.apiKey || data.accessToken,
    'jellyseerr': data.apiKey || data.accessToken,
    'tautulli': data.api_key || data.tautulli_api_key,
    'bazarr': data.api_key || data.apiKey,
    'decypharr': data.api_token || data.apiToken,
    'nzbdav': data.api_key || data.apiKey,
    'plex': data.PlexOnlineToken || (data._rawXml && typeof data._rawXml === 'string' && data._rawXml.match(/PlexOnlineToken="([^"]+)"/i)?.[1]),
    'jellyfin': data.accessToken || data.AccessToken,
    'emby': data.accessToken || data.AccessToken,
  };
  
  // Try app-specific first
  if (appSpecificTokens[lowerAppName]) {
    return appSpecificTokens[lowerAppName];
  }
  
  // Try common field names
  for (const field of tokenFields) {
    if (data[field]) {
      return data[field];
    }
  }
  
  // Try nested objects
  if (data.config && typeof data.config === 'object') {
    for (const field of tokenFields) {
      if (data.config[field]) {
        return data.config[field];
      }
    }
  }
  
  return null;
}

// ===== Category API Endpoints =====

// Get all categories (ordered)
app.get('/api/categories', requirePermission(userManager.PERMISSIONS.DASHBOARD_VIEW), (req, res) => {
  try {
    const config = readWidgetConfig();
    const sorted = [...config.categories].sort((a, b) => a.order - b.order);
    res.json(sorted);
  } catch (error) {
    console.error('Error reading categories:', error);
    res.status(500).json({ error: 'Failed to read categories', details: error.message });
  }
});

// Create category
app.post('/api/categories', requirePermission(userManager.PERMISSIONS.DASHBOARD_EDIT), (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const config = readWidgetConfig();

    // Determine next order value (before uncategorized)
    const maxOrder = config.categories
      .filter(c => c.id !== '__uncategorized__')
      .reduce((max, c) => Math.max(max, c.order), -1);

    const newCategory = {
      id: generateCategoryId(),
      name: name.trim(),
      order: maxOrder + 1,
      widgetIds: []
    };

    config.categories.push(newCategory);

    if (writeWidgetConfig(config)) {
      res.json(newCategory);
    } else {
      res.status(500).json({ error: 'Failed to create category' });
    }
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category', details: error.message });
  }
});

// Reorder categories (MUST be before /:id to avoid matching "order" as an id)
app.put('/api/categories/order', requirePermission(userManager.PERMISSIONS.DASHBOARD_EDIT), (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of category IDs' });
    }

    const config = readWidgetConfig();

    // Reassign order values based on the provided array
    order.forEach((catId, idx) => {
      const cat = config.categories.find(c => c.id === catId);
      if (cat) {
        cat.order = idx;
      }
    });

    // Ensure uncategorized stays last
    const uncat = config.categories.find(c => c.id === '__uncategorized__');
    if (uncat) {
      uncat.order = 999;
    }

    if (writeWidgetConfig(config)) {
      const sorted = [...config.categories].sort((a, b) => a.order - b.order);
      res.json({ success: true, categories: sorted });
    } else {
      res.status(500).json({ error: 'Failed to reorder categories' });
    }
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({ error: 'Failed to reorder categories', details: error.message });
  }
});

// Rename category
app.put('/api/categories/:id', requirePermission(userManager.PERMISSIONS.DASHBOARD_EDIT), (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (id === '__uncategorized__') {
      return res.status(400).json({ error: 'Cannot rename the Uncategorized category' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const config = readWidgetConfig();
    const cat = config.categories.find(c => c.id === id);

    if (!cat) {
      return res.status(404).json({ error: 'Category not found' });
    }

    cat.name = name.trim();

    if (writeWidgetConfig(config)) {
      res.json(cat);
    } else {
      res.status(500).json({ error: 'Failed to rename category' });
    }
  } catch (error) {
    console.error('Error renaming category:', error);
    res.status(500).json({ error: 'Failed to rename category', details: error.message });
  }
});

// Delete category (widgets move to Uncategorized)
app.delete('/api/categories/:id', requirePermission(userManager.PERMISSIONS.DASHBOARD_EDIT), (req, res) => {
  try {
    const { id } = req.params;

    if (id === '__uncategorized__') {
      return res.status(400).json({ error: 'Cannot delete the Uncategorized category' });
    }

    const config = readWidgetConfig();
    const catIdx = config.categories.findIndex(c => c.id === id);

    if (catIdx === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Move widgets to uncategorized
    const orphanedWidgets = config.categories[catIdx].widgetIds || [];
    const uncatIdx = config.categories.findIndex(c => c.id === '__uncategorized__');
    if (uncatIdx !== -1 && orphanedWidgets.length > 0) {
      config.categories[uncatIdx].widgetIds.push(...orphanedWidgets);
    }

    // Remove the category
    config.categories.splice(catIdx, 1);

    if (writeWidgetConfig(config)) {
      res.json({ success: true, movedWidgets: orphanedWidgets.length });
    } else {
      res.status(500).json({ error: 'Failed to delete category' });
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category', details: error.message });
  }
});

// Move widget between categories
app.put('/api/widgets/:id/move', requirePermission(userManager.PERMISSIONS.DASHBOARD_EDIT), (req, res) => {
  try {
    const { id } = req.params;
    const { targetCategoryId, position } = req.body;

    if (!targetCategoryId) {
      return res.status(400).json({ error: 'targetCategoryId is required' });
    }

    const config = readWidgetConfig();

    // Find target category
    const targetCat = config.categories.find(c => c.id === targetCategoryId);
    if (!targetCat) {
      return res.status(404).json({ error: 'Target category not found' });
    }

    // Remove widget from its current category
    config.categories.forEach(cat => {
      cat.widgetIds = (cat.widgetIds || []).filter(wid => wid !== id);
    });

    // Add to target category at specified position or end
    if (position !== undefined && position >= 0 && position <= targetCat.widgetIds.length) {
      targetCat.widgetIds.splice(position, 0, id);
    } else {
      targetCat.widgetIds.push(id);
    }

    if (writeWidgetConfig(config)) {
      res.json({ success: true, categoryId: targetCategoryId, position: targetCat.widgetIds.indexOf(id) });
    } else {
      res.status(500).json({ error: 'Failed to move widget' });
    }
  } catch (error) {
    console.error('Error moving widget:', error);
    res.status(500).json({ error: 'Failed to move widget', details: error.message });
  }
});

// Extract token/config from Docker container
app.post('/api/widgets/extract-token/:containerId', requirePermission(userManager.PERMISSIONS.WIDGET_CREATE), async (req, res) => {
  try {
    const { containerId } = req.params;
    const { appName } = req.body;
    
    if (!appName) {
      return res.status(400).json({ error: 'appName is required' });
    }
    
    // Find container
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id.startsWith(containerId) || c.Names.some(n => n.replace(/^\//, '').includes(containerId))
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    // Extract config
    const config = await extractConfigFromContainer(container.Id, appName);
    if (!config) {
      const lowerAppName = appName.toLowerCase();
      const appAliases = { 'fin': 'jellyfin', 'jelly': 'jellyfin', 'jf': 'jellyfin' };
      const resolvedAppName = appAliases[lowerAppName] || lowerAppName;
      let errorMsg = 'Config file not found in container';

      if (resolvedAppName === 'jellyfin') {
        errorMsg = 'Could not extract API key from Jellyfin. The container may not have sqlite3 installed, or no API key exists. Go to Dashboard > API Keys in your Jellyfin admin panel to create one and enter it manually.';
      } else if (resolvedAppName === 'emby') {
        errorMsg = 'Could not extract API key from Emby. The container may not have sqlite3 installed, or no API key exists. Go to Settings > API Keys in your Emby admin panel to create one and enter it manually.';
      }

      return res.status(404).json({ error: errorMsg });
    }
    
    // Extract token
    const token = extractApiToken(config, appName);
    const url = req.body.url || null; // URL can be provided or extracted from config
    
    if (!token) {
      // If token extraction failed, try to extract directly from raw data as fallback
      if (config.format === 'text' && typeof config.data === 'string') {
        // For Plex, extract PlexOnlineToken from XML string
        if (appName.toLowerCase() === 'plex') {
          const plexTokenMatch = config.data.match(/PlexOnlineToken="([^"]+)"/i);
          if (plexTokenMatch) {
            return res.json({
              success: true,
              config: {
                path: config.path,
                format: config.format,
              },
              token: plexTokenMatch[1],
              url: url,
            });
          }
        }
        // For other XML-based apps, try ApiKey
        const apiKeyMatch = config.data.match(/<ApiKey>([^<]+)<\/ApiKey>/i);
        if (apiKeyMatch) {
          return res.json({
            success: true,
            config: {
              path: config.path,
              format: config.format,
            },
            token: apiKeyMatch[1],
            url: url,
          });
        }
      }
      
      // If still no token, return app-specific error messages
      const lowerAppName = appName.toLowerCase();
      const appAliases = { 'fin': 'jellyfin', 'jelly': 'jellyfin', 'jf': 'jellyfin' };
      const resolvedAppName = appAliases[lowerAppName] || lowerAppName;
      let helpMessage = `Config format: ${config.format}. Please check the config file or enter the token manually.`;

      if (resolvedAppName === 'jellyfin') {
        helpMessage = 'Jellyfin API keys must be created manually. Go to Dashboard > API Keys in your Jellyfin admin panel to create one.';
      } else if (resolvedAppName === 'emby') {
        helpMessage = 'Emby API keys must be created manually. Go to Settings > API Keys in your Emby admin panel to create one.';
      }

      return res.status(400).json({
        error: 'Could not extract token from config file',
        details: helpMessage
      });
    }
    
    res.json({
      success: true,
      config: {
        path: config.path,
        format: config.format,
      },
      token: token,
      url: url,
    });
  } catch (error) {
    console.error('Error extracting token:', error);
    res.status(500).json({ error: 'Failed to extract token', details: error.message });
  }
});

// Get all widgets with categories
app.get('/api/widgets', requirePermission(userManager.PERMISSIONS.WIDGET_VIEW), (req, res) => {
  try {
    const widgets = readWidgets();
    const config = readWidgetConfig();
    const widgetMap = {};
    widgets.forEach(w => { widgetMap[w.id] = w; });

    // Sort categories by order
    const sortedCategories = [...config.categories].sort((a, b) => a.order - b.order);

    // Build categorized response — each category includes its ordered widgets
    const categories = sortedCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      order: cat.order,
      widgets: (cat.widgetIds || [])
        .filter(id => widgetMap[id])
        .map(id => widgetMap[id])
    }));

    // Collect all categorized widget IDs
    const categorizedIds = new Set();
    config.categories.forEach(cat => {
      (cat.widgetIds || []).forEach(id => categorizedIds.add(id));
    });

    // Any widgets not in any category go to uncategorized
    const orphans = widgets.filter(w => !categorizedIds.has(w.id));
    if (orphans.length > 0) {
      const uncatIdx = config.categories.findIndex(c => c.id === '__uncategorized__');
      if (uncatIdx !== -1) {
        orphans.forEach(w => {
          config.categories[uncatIdx].widgetIds.push(w.id);
        });
        writeWidgetConfig(config);
        // Update response
        const uncatCat = categories.find(c => c.id === '__uncategorized__');
        if (uncatCat) {
          uncatCat.widgets.push(...orphans);
        }
      }
    }

    res.json({ widgets, categories });
  } catch (error) {
    console.error('Error reading widgets:', error);
    res.status(500).json({ error: 'Failed to read widgets', details: error.message });
  }
});

// Update widget order within a category (MUST be before /:id routes to avoid matching "order" as an id)
app.put('/api/widgets/order', requirePermission(userManager.PERMISSIONS.DASHBOARD_EDIT), (req, res) => {
  try {
    const { categoryId, widgetIds } = req.body;

    if (!categoryId || !Array.isArray(widgetIds)) {
      return res.status(400).json({ error: 'categoryId and widgetIds array are required' });
    }

    const config = readWidgetConfig();
    const catIdx = config.categories.findIndex(c => c.id === categoryId);

    if (catIdx === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }

    config.categories[catIdx].widgetIds = widgetIds;

    if (writeWidgetConfig(config)) {
      res.json({ success: true, categoryId, widgetIds });
    } else {
      res.status(500).json({ error: 'Failed to update widget order' });
    }
  } catch (error) {
    console.error('Error updating widget order:', error);
    res.status(500).json({ error: 'Failed to update widget order', details: error.message });
  }
});

// Create widget
app.post('/api/widgets', requirePermission(userManager.PERMISSIONS.WIDGET_CREATE), (req, res) => {
  try {
    const widgets = readWidgets();
    const config = readWidgetConfig();
    const { categoryId, ...widgetData } = req.body;
    const newWidget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...widgetData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    widgets.push(newWidget);

    // Add to specified category or uncategorized
    const targetCatId = categoryId || '__uncategorized__';
    const catIdx = config.categories.findIndex(c => c.id === targetCatId);
    if (catIdx !== -1) {
      config.categories[catIdx].widgetIds.push(newWidget.id);
    } else {
      // Fallback to uncategorized
      const uncatIdx = config.categories.findIndex(c => c.id === '__uncategorized__');
      if (uncatIdx !== -1) {
        config.categories[uncatIdx].widgetIds.push(newWidget.id);
      }
    }

    if (writeWidgets(widgets) && writeWidgetConfig(config)) {
      res.json(newWidget);
    } else {
      res.status(500).json({ error: 'Failed to save widget' });
    }
  } catch (error) {
    console.error('Error creating widget:', error);
    res.status(500).json({ error: 'Failed to create widget', details: error.message });
  }
});

// Update widget
app.put('/api/widgets/:id', requirePermission(userManager.PERMISSIONS.WIDGET_EDIT), (req, res) => {
  try {
    const { id } = req.params;
    const widgets = readWidgets();
    const index = widgets.findIndex(w => w.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    
    widgets[index] = {
      ...widgets[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    
    if (writeWidgets(widgets)) {
      res.json(widgets[index]);
    } else {
      res.status(500).json({ error: 'Failed to update widget' });
    }
  } catch (error) {
    console.error('Error updating widget:', error);
    res.status(500).json({ error: 'Failed to update widget', details: error.message });
  }
});

// Delete widget
app.delete('/api/widgets/:id', requirePermission(userManager.PERMISSIONS.WIDGET_DELETE), (req, res) => {
  try {
    const { id } = req.params;
    const widgets = readWidgets();
    const config = readWidgetConfig();
    const filtered = widgets.filter(w => w.id !== id);

    if (filtered.length === widgets.length) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Remove from all categories
    config.categories.forEach(cat => {
      cat.widgetIds = (cat.widgetIds || []).filter(wid => wid !== id);
    });

    if (writeWidgets(filtered) && writeWidgetConfig(config)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete widget' });
    }
  } catch (error) {
    console.error('Error deleting widget:', error);
    res.status(500).json({ error: 'Failed to delete widget', details: error.message });
  }
});

// Fetch widget data from app API (legacy endpoint)
app.get('/api/widgets/:id/data', requirePermission(userManager.PERMISSIONS.WIDGET_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const widgets = readWidgets();
    const widget = widgets.find(w => w.id === id);
    
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    if (!widget.url) {
      return res.status(400).json({ error: 'Widget missing URL' });
    }

    // Make API request to the app
    const apiUrl = widget.apiEndpoint || widget.url;
    const headers = {
      'X-Api-Key': widget.token,
      'Accept': 'application/json',
    };
    
    // App-specific API endpoints
    const appName = widget.appName?.toLowerCase() || '';
    let endpoint = apiUrl;
    
    if (appName.includes('sonarr') || appName.includes('radarr') || appName.includes('lidarr') || appName.includes('readarr') || appName.includes('prowlarr')) {
      endpoint = `${apiUrl}/api/v3/system/status`;
    } else if (appName.includes('overseerr') || appName.includes('jellyseerr')) {
      endpoint = `${apiUrl}/api/v1/status`;
    } else if (appName.includes('tautulli')) {
      endpoint = `${apiUrl}/api/v2?apikey=${widget.token}&cmd=get_activity`;
    } else if (appName.includes('jellyfin')) {
      endpoint = `${apiUrl}/System/Info`;
      headers['X-Emby-Token'] = widget.token;
      delete headers['X-Api-Key'];
    } else if (appName.includes('plex')) {
      endpoint = `${apiUrl}/status/sessions`;
      headers['X-Plex-Token'] = widget.token;
      delete headers['X-Api-Key'];
    }
    
    try {
      const response = await axios.get(endpoint, { 
        headers,
        timeout: 10000,
      });
      
      res.json({
        success: true,
        data: response.data,
      });
    } catch (apiError) {
      console.error('Error fetching widget data:', apiError.message);
      res.status(500).json({ 
        error: 'Failed to fetch data from app API', 
        details: apiError.message,
        response: apiError.response?.data,
      });
    }
  } catch (error) {
    console.error('Error fetching widget data:', error);
    res.status(500).json({ error: 'Failed to fetch widget data', details: error.message });
  }
});

// Widget proxy endpoint - executes widget proxy handlers
app.get('/api/widgets/:id/proxy', requirePermission(userManager.PERMISSIONS.WIDGET_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const { endpoint = 'unified' } = req.query;
    
    const widgets = readWidgets();
    const widget = widgets.find(w => w.id === id);
    
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    
    if (!widget.url) {
      return res.status(400).json({ error: 'Widget missing URL' });
    }

    const appName = widget.appName?.toLowerCase() || '';
    
    // Try to load and execute widget proxy handler
    try {
      // Check for server-side proxy handler first
      const proxyHandler = getProxyHandler(appName);
      
      if (proxyHandler) {
        // Execute server-side proxy handler
        const proxyData = await proxyHandler(widget, endpoint);
        return res.json({
          success: true,
          data: proxyData,
        });
      }
      
      // No proxy handler found, fall back to direct API call
      return res.redirect(`/api/widgets/${id}/data`);
    } catch (proxyError) {
      console.error('Error executing proxy handler:', proxyError);
      // Fall back to direct API call
      return res.redirect(`/api/widgets/${id}/data`);
    }
  } catch (error) {
    console.error('Error in widget proxy:', error);
    res.status(500).json({ error: 'Failed to execute widget proxy', details: error.message });
  }
});

// Widget action endpoint - executes mutations (queue remove, grab, lookup, add, etc.)
app.post('/api/widgets/:id/action', requirePermission(userManager.PERMISSIONS.WIDGET_EDIT), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, params = {} } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    const widgets = readWidgets();
    const widget = widgets.find(w => w.id === id);

    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const appName = widget.appName?.toLowerCase() || '';
    const actionHandler = getActionHandler(appName);

    if (!actionHandler) {
      return res.status(400).json({ error: `No action handler for ${appName}` });
    }

    const result = await actionHandler(widget, action, params);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in widget action:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.response?.data?.[0]?.errorMessage || error.message;
    res.status(status).json({ error: message });
  }
});

// === Autoscan widget endpoints ===
const AUTOSCAN_ROOT = '/mnt';
const AUTOSCAN_FS_PREFIXES = ['/hostfs', ''];

function autoscanResolveFs(safePath) {
  // safePath is already normalized and validated to be under /mnt
  for (const prefix of AUTOSCAN_FS_PREFIXES) {
    const candidate = prefix + safePath;
    try {
      const st = fs.statSync(candidate);
      if (st.isDirectory()) return candidate;
    } catch { /* try next */ }
  }
  return null;
}

function autoscanSafePath(input) {
  if (typeof input !== 'string') return null;
  let p = input.trim();
  if (!p) return AUTOSCAN_ROOT;
  // Normalize to posix, collapse slashes, strip trailing slash
  p = p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (!p.startsWith('/')) p = '/' + p;
  // Resolve any "." or ".." segments
  const parts = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  const resolved = '/' + parts.join('/');
  if (resolved !== AUTOSCAN_ROOT && !resolved.startsWith(AUTOSCAN_ROOT + '/')) return null;
  return resolved;
}

function autoscanAuthHeader(widget) {
  if (widget.username && widget.password) {
    const token = Buffer.from(`${widget.username}:${widget.password}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }
  return {};
}

app.get('/api/widgets/:id/autoscan/browse', requirePermission(userManager.PERMISSIONS.WIDGET_VIEW), async (req, res) => {
  try {
    const widgets = readWidgets();
    const widget = widgets.find(w => w.id === req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    if ((widget.appName || '').toLowerCase() !== 'autoscan') return res.status(400).json({ error: 'Not an autoscan widget' });

    const requested = autoscanSafePath(req.query.path || AUTOSCAN_ROOT);
    if (!requested) return res.status(400).json({ error: 'Path must be under /mnt' });

    const fsPath = autoscanResolveFs(requested);
    if (!fsPath) return res.status(404).json({ error: `Path not found: ${requested}` });

    const dirents = fs.readdirSync(fsPath, { withFileTypes: true });
    const entries = dirents
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => ({ name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    res.json({ path: requested, entries });
  } catch (err) {
    console.error('Autoscan browse error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/widgets/:id/autoscan/scan', requirePermission(userManager.PERMISSIONS.WIDGET_EDIT), async (req, res) => {
  try {
    const widgets = readWidgets();
    const widget = widgets.find(w => w.id === req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    if ((widget.appName || '').toLowerCase() !== 'autoscan') return res.status(400).json({ error: 'Not an autoscan widget' });
    if (!widget.url) return res.status(400).json({ error: 'Widget missing URL' });

    const safePath = autoscanSafePath(req.body?.path);
    if (!safePath) return res.status(400).json({ error: 'Path must be under /mnt' });

    const target = `${widget.url.replace(/\/$/, '')}/triggers/manual`;
    const axios = (await import('axios')).default;
    const response = await axios.post(target, null, {
      params: { dir: safePath },
      headers: autoscanAuthHeader(widget),
      timeout: 15000,
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      return res.json({ success: true, status: response.status, path: safePath });
    }
    return res.status(response.status).json({
      error: typeof response.data === 'string' ? response.data : (response.data?.message || `Autoscan returned ${response.status}`),
    });
  } catch (err) {
    console.error('Autoscan scan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/widgets/:id/autoscan/status', requirePermission(userManager.PERMISSIONS.WIDGET_VIEW), async (req, res) => {
  try {
    const widgets = readWidgets();
    const widget = widgets.find(w => w.id === req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    if ((widget.appName || '').toLowerCase() !== 'autoscan') return res.status(400).json({ error: 'Not an autoscan widget' });

    let reachable = false;
    if (widget.url) {
      try {
        const axios = (await import('axios')).default;
        const probe = await axios.get(widget.url.replace(/\/$/, '') + '/', {
          headers: autoscanAuthHeader(widget),
          timeout: 5000,
          validateStatus: () => true,
        });
        reachable = probe.status < 500;
      } catch { reachable = false; }
    }

    // Parse activity log if accessible
    const logCandidates = ['/hostfs/opt/autoscan/activity.log', '/opt/autoscan/activity.log'];
    let logPath = null;
    for (const c of logCandidates) {
      try { if (fs.statSync(c).isFile()) { logPath = c; break; } } catch { /* skip */ }
    }

    let recentCount = null;
    let lastScan = null;
    let targets = null;

    if (logPath) {
      try {
        const stat = fs.statSync(logPath);
        const readBytes = Math.min(stat.size, 256 * 1024);
        const fd = fs.openSync(logPath, 'r');
        const buf = Buffer.alloc(readBytes);
        fs.readSync(fd, buf, 0, readBytes, Math.max(0, stat.size - readBytes));
        fs.closeSync(fd);
        const lines = buf.toString('utf8').split('\n').filter(Boolean);

        const oneHourAgo = Date.now() - 3600 * 1000;
        const year = new Date().getFullYear();
        const scanLineRe = /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+INF\s+Scan moved to processor.*?path="([^"]+)"/;
        let count = 0;
        for (let i = lines.length - 1; i >= 0; i--) {
          const m = lines[i].match(scanLineRe);
          if (!m) continue;
          const ts = new Date(`${m[1]} ${year}`);
          if (Number.isNaN(ts.getTime())) continue;
          const tsMs = ts.getTime();
          if (!lastScan) lastScan = { at: ts.toISOString(), path: m[2] };
          if (tsMs >= oneHourAgo) count++;
          else break;
        }
        recentCount = count;
      } catch (e) {
        console.error('Autoscan log parse error:', e.message);
      }
    }

    // Try to read targets count from config
    const cfgCandidates = ['/hostfs/opt/autoscan/config.yml', '/opt/autoscan/config.yml'];
    for (const c of cfgCandidates) {
      try {
        if (!fs.statSync(c).isFile()) continue;
        const text = fs.readFileSync(c, 'utf8');
        const targetsBlock = text.split(/^targets:/m)[1];
        if (targetsBlock) {
          const matches = targetsBlock.match(/^\s{2,4}-\s+url:/gm);
          if (matches) targets = matches.length;
        }
        break;
      } catch { /* skip */ }
    }

    res.json({ reachable, recentCount, lastScan, targets });
  } catch (err) {
    console.error('Autoscan status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// === end autoscan ===

// Widget image proxy endpoint - proxies images through server with authentication
app.get('/api/widgets/:id/proxy-image', requirePermission(userManager.PERMISSIONS.WIDGET_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const { path: imagePath } = req.query;

    if (!imagePath) {
      return res.status(400).json({ error: 'Image path required' });
    }

    const widgets = readWidgets();
    const widget = widgets.find(w => w.id === id);

    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const appName = widget.appName?.toLowerCase() || '';
    const imageHandler = getImageProxyHandler(appName);

    if (imageHandler) {
      try {
        const result = await imageHandler(widget, imagePath);
        res.set('Content-Type', result.contentType);
        res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        return res.send(Buffer.from(result.data));
      } catch (err) {
        console.error('Error proxying image:', err.message);
        return res.status(500).json({ error: 'Failed to fetch image' });
      }
    }

    // Fallback: try generic image fetch
    const baseUrl = widget.url?.replace(/\/$/, '') || '';
    const imageUrl = `${baseUrl}${imagePath}`;

    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: widget.token ? { 'Authorization': `Bearer ${widget.token}` } : {},
      });
      res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(Buffer.from(response.data));
    } catch (err) {
      console.error('Error fetching image:', err.message);
      return res.status(500).json({ error: 'Failed to fetch image' });
    }
  } catch (error) {
    console.error('Error in image proxy:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// SPA catch-all route - must be AFTER all API routes
if (isProduction && fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Spyglass server running on port ${PORT}`);
  if (!isProduction) {
    console.log(`Frontend dev server should be running on http://localhost:5173`);
    console.log(`API available at http://localhost:${PORT}/api`);
  }
});

