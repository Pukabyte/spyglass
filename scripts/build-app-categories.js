#!/usr/bin/env node
// Generates data/app-categories.json from the Saltbox docs app taxonomy.
// Source: https://docs.saltbox.dev/apps/ (5 top categories + subcategories).
//
// Apps are keyed by an ALNUM-ONLY normalized form so docs display names match
// the actual `sb list` tags despite hyphen/space/case differences:
//   "AdGuard Home" -> "adguardhome"   (sb tag: adguardhome)
//   "Paperless NGX" -> "paperlessngx" (sb tag: paperless-ngx)
//   "code-server"  -> "codeserver"    (sb tag: code-server)
// server.js normalizes incoming app names the same way at lookup time.
//
// Regenerate when the docs change:  node scripts/build-app-categories.js

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Alnum-only key: lowercase, strip everything that isn't a-z0-9.
export const normKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

// Docs taxonomy: category -> subcategory -> [display names].
// Mirror of docs.saltbox.dev/apps/ as of 2026-06.
const TAXONOMY = {
  'Content Delivery': {
    'Media Server': ['Plex', 'Emby', 'Jellyfin'],
    'Audio Server': ['Airsonic', 'Audiobookshelf', 'Koel', 'Navidrome'],
    'Collaborative': ['transfer.sh', 'File Browser', 'Karakeep', 'Nextcloud', 'PrivateBin', 'RocketChat', 'XBackBone'],
    'Game Servers': ['Crafty Controller', 'Factorio', 'Foundry', 'LinuxGSM', 'Minecraft Bedrock', 'Minecraft', 'PufferPanel'],
    'IPTV Proxy': ['Threadfin'],
    'Reader': ['Codex', 'Grimmory', 'Kavita', 'Komga'],
  },
  'Content Acquisition': {
    'Collection Manager': ['Sonarr', 'Radarr', 'Lidarr', 'Whisparr', 'Lazylibrarian', 'Medusa', 'Mylar3'],
    'BitTorrent Clients': ['qBittorrent', 'Deluge', 'rFlood', 'ruTorrent', 'Transmission', 'DelugeVPN', 'QBittorrentVPN', 'Transmission VPN'],
    'Usenet': ['SABnzbd', 'NZBGet'],
    'Indexer Managers': ['Jackett', 'NZBHydra2', 'Prowlarr'],
    'Download Managers': ['AirDC++', 'Deemix', 'JDownloader', 'PyLoad', 'YTDL-Sub'],
    'Miscellaneous': ['Autobrr', 'Bazarr', 'Subliminal', 'Shelfmark'],
  },
  'Accessories': {
    'Integration': ['Autoscan', 'A-Train', 'Kometa', 'PlexTraktSync', 'WatchState'],
    'Monitoring': ['Tautulli', 'Jellystat', 'Varken', 'Wrapperr', 'YourSpotify'],
    'Requests': ['Overseerr', 'Petio', 'Seerr', 'Jellyseerr', 'Ombi'],
    'Chat Bots': ['DiscoFlix', 'Doplarr', 'Membarr', 'Requestrr', 'Tauticord'],
    'Media Server Misc': ['ASSHAMA', 'Plex Auto Languages', 'Plex DupeFinder', 'PlexShare', 'Wizarr'],
    'Collection Manager Support': ['Unpackerr', 'FlareSolverr', 'Maintainerr', 'Nabarr', 'Profilarr', 'Recyclarr'],
    'Download Client Support': ['NZBThrottle', 'qBit Manage', 'Qui', 'SABThrottle', 'tqm', 'ZNC'],
    'File Processing': ['Handbrake', 'MKVToolNix', 'MakeMKV', 'Tdarr Node', 'Tdarr', 'Unmanic'],
    'Library Management': ['Calibre-Web', 'ComiXed', 'Filebot', 'Immich', 'PhotoPrism', 'Stash', 'Tubearchivist'],
    'Tag Editors': ['Beets', 'Calibre', 'Puddletag'],
  },
  'Admin': {
    'Access Control': ['Authelia', 'Authentik', 'CrowdSec', 'LLDAP'],
    'Container Management': ['Portainer', 'Docker CE', 'Dockwatch', 'Autoheal', 'cAdvisor', 'Diun', 'Dozzle', 'Docker Socket Proxy', 'ctop'],
    'Databases': ['MariaDB', 'MongoDB', 'PostgreSQL Host', 'PostgreSQL', 'Prometheus', 'Redis', 'Elasticsearch', 'InfluxDB2', 'InfluxDB', 'Meilisearch', 'Adminer', 'PGAdmin', 'phpMyAdmin', 'SQLite Browser'],
    'File Operations': ['Cloudplow', 'Rclone', 'Duplicati', 'Resilio Sync', 'Syncthing'],
    'Health Monitoring': ['iperf3', 'GoAccess', 'Speedtest', 'VNStat', 'Grafana', 'Netdata', 'Glances web', 'OpenObserve', 'Uptime Kuma', 'btop', 'Glances', 'Node Exporter', 'Scrutiny', 'Healthchecks', 'Telegraf'],
    'Notifications': ['Apprise', 'changedetection.io', 'Gotify', 'Notifiarr Client'],
    'Network Services': ['DDNS', 'DDClient', 'Traefik Proxy', 'AdGuard Home', 'Gluetun', 'Kcptun-Client', 'Kcptun-Server', 'Wireguard'],
    'Remote Access': ['Chrome', 'Cockpit', 'Firefox', 'Sshwifty'],
    'Miscellaneous': ['BTRFS Maintenance', 'Mainline', 'Python', 'yq'],
  },
  'Productivity': {
    'Automation': ['n8n', 'Node-Red', 'OliveTin', 'SemaphoreUI', 'Teslamate'],
    'Development': ['code-server', 'Forgejo', 'Gitea', 'Gotenberg', 'IT Tools', 'Tika'],
    'IoT': ['Home Assistant', 'MQTT', 'UniFi Network Application'],
    'Landing Pages': ['Organizr', 'Error Pages', 'Dashdot', 'Dashy', 'Heimdall', 'Homarr', 'Homepage'],
    'Record Keeping': ['Actual Budget', 'Firefly III', 'Firefly III Importer', 'Invoice Ninja', 'Grocy', 'Homebox', 'Mealie', 'Tandoor Recipes', 'ArchiveBox', 'Cherry', 'Joplin', 'LinkWarden', 'Linkding', 'Paperless NGX', 'Paperless AI', 'Trilium Notes', 'Vaultwarden'],
    'Web Publishing': ['Nginx', 'BookStack', 'Wikijs', 'WordPress', 'Zig robots.txt'],
    'General Misc': ['FileZilla', 'FreshRSS', 'Krusader', 'Miniflux', 'Reposilite', 'The Lounge'],
  },
};

// System/utility module tags from docs.saltbox.dev/reference/modules/.
// These are infra roles, not installable apps, so the App Store hides them.
const SYSTEM_MODULES = [
  'arr_db', 'backup', 'backup2', 'common', 'custom', 'diag',
  'download_clients', 'download_indexers', 'hetzner_nfs', 'hetzner_vlan',
  'kernel', 'main_tag', 'main_tags', 'media_server', 'motd', 'mount_templates',
  'permissions', 'plex_auth_token', 'plex_db', 'plex_fix_futures', 'reboot',
  'remote', 'restore', 'saltbox_mod', 'sandbox', 'shell', 'system',
  'traefik_file_template', 'traefik_template', 'unionfs', 'user',
  // Additional non-app tags that show up in `sb list`
  'core', 'mounts', 'preinstall', 'settings',
];

const apps = {};
const tree = {};
for (const [category, subs] of Object.entries(TAXONOMY)) {
  tree[category] = {};
  for (const [subcategory, names] of Object.entries(subs)) {
    tree[category][subcategory] = [];
    for (const display of names) {
      const key = normKey(display);
      if (!key) continue;
      apps[key] = { category, subcategory, display };
      tree[category][subcategory].push(key);
    }
  }
}

// System tags as alnum-only keys (deduped), excluding any that are real apps.
const system = [...new Set(SYSTEM_MODULES.map(normKey).filter((k) => k && !apps[k]))];

const out = { generatedFrom: 'https://docs.saltbox.dev/apps/', apps, tree, system };
// Write to the app root, NOT data/ — data/ is bind-mounted from the host in
// production and would shadow the image-baked file.
const outPath = join(__dirname, '..', 'app-categories.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${Object.keys(apps).length} apps across ${Object.keys(tree).length} categories, ${system.length} system tags to ${outPath}`);
