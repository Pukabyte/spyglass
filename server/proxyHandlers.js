// Server-side proxy handlers for widgets
// These handlers run on the server to process API responses
import axios from 'axios';

// Utility functions used by widget config map/filter callbacks (ported from homepage)
// These are set as globals so dynamically-imported widget.js map functions can reference them
globalThis.asJson = function asJson(data) {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
};

globalThis.jsonArrayFilter = function jsonArrayFilter(data, filterFn) {
  const arr = globalThis.asJson(data);
  if (Array.isArray(arr)) return arr.filter(filterFn);
  return [];
};

// Library stats cache - caches library counts for 5 minutes since they rarely change
const libraryCache = new Map();
const LIBRARY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Emby user access token cache - caches user tokens for 24 hours
const embyTokenCache = new Map();
const EMBY_TOKEN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Authenticate with Emby using username/password to get a user access token
async function getEmbyUserToken(baseUrl, username, password, widgetId) {
  const cacheKey = `emby-token-${widgetId}`;
  const cached = embyTokenCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EMBY_TOKEN_CACHE_TTL) {
    return cached.token;
  }

  try {
    const authHeader = 'MediaBrowser Client="Spyglass", Device="Server", DeviceId="spyglass-' + widgetId + '", Version="1.0"';
    const response = await axios.post(
      `${baseUrl}/Users/AuthenticateByName`,
      { Username: username, Pw: password },
      {
        headers: {
          'X-Emby-Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const accessToken = response.data?.AccessToken;
    if (accessToken) {
      embyTokenCache.set(cacheKey, { token: accessToken, timestamp: Date.now() });
      return accessToken;
    }
  } catch (err) {
    console.error('Error authenticating with Emby:', err.message);
    // Clear cached token on auth failure
    embyTokenCache.delete(cacheKey);
  }
  return null;
}

function getCachedLibraryStats(widgetId) {
  const cached = libraryCache.get(widgetId);
  if (cached && Date.now() - cached.timestamp < LIBRARY_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedLibraryStats(widgetId, data) {
  libraryCache.set(widgetId, {
    data,
    timestamp: Date.now(),
  });
}

// Plex proxy handler
export async function handlePlexProxy(widget, endpoint = 'unified') {
  try {
    const { url, token } = widget;

    if (!url || !token) {
      console.error('Plex proxy: Missing URL or token', { url, hasToken: !!token });
      throw new Error('Missing URL or token');
    }

    const baseUrl = url.replace(/\/$/, '');

    // Fetch streams (active sessions)
    let streams = 0;
    let streamDetails = [];
    try {
      const streamsUrl = `${baseUrl}/status/sessions?X-Plex-Token=${token}`;
      const streamsResponse = await axios.get(streamsUrl, {
        headers: {
          'X-Plex-Container-Start': '0',
          'X-Plex-Container-Size': '500',
          'Accept': 'application/xml',
        },
        timeout: 10000,
        responseType: 'text',
      });

      const sizeMatch = streamsResponse.data.match(/size="(\d+)"/);
      if (sizeMatch) {
        streams = parseInt(sizeMatch[1], 10);
      } else {
        const videoMatches = streamsResponse.data.match(/<Video/g);
        streams = videoMatches ? videoMatches.length : 0;
      }

      if (streams > 0) {
        const videoRegex = /<Video[^>]*>([\s\S]*?)<\/Video>/g;
        let videoMatch;
        while ((videoMatch = videoRegex.exec(streamsResponse.data)) !== null) {
          streamDetails.push(parseStreamXml(videoMatch[0], 'video'));
        }

        const trackRegex = /<Track[^>]*>([\s\S]*?)<\/Track>/g;
        let trackMatch;
        while ((trackMatch = trackRegex.exec(streamsResponse.data)) !== null) {
          streamDetails.push(parseStreamXml(trackMatch[0], 'track'));
        }
      }
    } catch (err) {
      console.error('Error fetching Plex streams:', err.message);
    }

    // Check for cached library stats
    const cacheKey = `plex-${widget.id}`;
    let cachedStats = getCachedLibraryStats(cacheKey);
    let albums = cachedStats?.albums ?? 0;
    let movies = cachedStats?.movies ?? 0;
    let tv = cachedStats?.tv ?? 0;

    // Only fetch library stats if not cached
    if (!cachedStats) {
      let libraries = [];
      try {
        const librariesUrl = `${baseUrl}/library/sections?X-Plex-Token=${token}`;
        const librariesResponse = await axios.get(librariesUrl, {
          headers: { 'Accept': 'application/xml' },
          timeout: 10000,
          responseType: 'text',
        });

        const directoryMatches = librariesResponse.data.matchAll(/<Directory[^>]*>/g);
        for (const directoryMatch of directoryMatches) {
          const directoryTag = directoryMatch[0];
          const typeMatch = directoryTag.match(/type="(movie|show|artist)"/i);
          const keyMatch = directoryTag.match(/key="(\d+)"/i);

          if (typeMatch && keyMatch) {
            libraries.push({ type: typeMatch[1].toLowerCase(), key: keyMatch[1] });
          }
        }
      } catch (err) {
        console.error('Error fetching Plex libraries:', err.message);
      }

      const batchSize = 3;
      for (let i = 0; i < libraries.length; i += batchSize) {
        const batch = libraries.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (library) => {
            const libraryURL = `/library/sections/${library.key}/all?X-Plex-Token=${token}&includeMeta=1&X-Plex-Container-Start=0&X-Plex-Container-Size=1`;
            try {
              const libraryResponse = await axios.get(`${baseUrl}${libraryURL}`, {
                headers: { 'Accept': 'application/xml' },
                timeout: 15000,
                responseType: 'text',
              });
              const totalSizeMatch = libraryResponse.data.match(/<MediaContainer[^>]*totalSize="(\d+)"[^>]*>/);
              const sizeMatch = libraryResponse.data.match(/<MediaContainer[^>]*size="(\d+)"[^>]*>/);
              const size = totalSizeMatch ? parseInt(totalSizeMatch[1], 10) : (sizeMatch ? parseInt(sizeMatch[1], 10) : 0);
              if (library.type === 'movie') movies += size;
              else if (library.type === 'show') tv += size;
              else if (library.type === 'artist') albums += size;
            } catch (err) { /* ignore timeout errors */ }
          })
        );
      }

      // Cache the library stats
      setCachedLibraryStats(cacheKey, { albums, movies, tv });
    }

    return { streams, streamDetails, albums, movies, tv };
  } catch (error) {
    console.error('Error in Plex proxy handler:', error);
    throw error;
  }
}

function parseStreamXml(xml, defaultType = 'video') {
  const getAttr = (name) => {
    // Use word boundary to match exact attribute name (not librarySectionTitle when looking for title)
    const match = xml.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
    return match ? match[1] : null;
  };
  const userMatch = xml.match(/<User[^>]*title="([^"]*)"/);
  const user = userMatch ? userMatch[1] : 'Unknown';
  const playerPlatformMatch = xml.match(/<Player[^>]*platform="([^"]*)"/);
  const playerStateMatch = xml.match(/<Player[^>]*state="([^"]*)"/);
  const platform = playerPlatformMatch ? playerPlatformMatch[1] : 'Unknown';
  const state = playerStateMatch ? playerStateMatch[1] : 'playing';
  const mediaResolutionMatch = xml.match(/<Media[^>]*videoResolution="([^"]*)"/);
  let quality = mediaResolutionMatch ? mediaResolutionMatch[1] : '';
  if (quality === '1080') quality = '1080p';
  else if (quality === '720') quality = '720p';
  else if (quality === '2160') quality = '4K';
  const isTranscoding = xml.includes('<TranscodeSession');
  // Extract season/episode numbers
  const parentIndex = getAttr('parentIndex');
  const index = getAttr('index');
  const seasonEpisode = parentIndex && index
    ? `S${String(parentIndex).padStart(2, '0')}E${String(index).padStart(2, '0')}`
    : null;

  // Device name from Player tag
  const playerDeviceMatch = xml.match(/<Player[^>]*title="([^"]*)"/);
  const deviceName = playerDeviceMatch ? playerDeviceMatch[1] : null;
  const playerProductMatch = xml.match(/<Player[^>]*product="([^"]*)"/);
  const client = playerProductMatch ? playerProductMatch[1] : platform;

  // Media codec info
  const mediaVideoCodecMatch = xml.match(/<Media[^>]*videoCodec="([^"]*)"/);
  const mediaAudioCodecMatch = xml.match(/<Media[^>]*audioCodec="([^"]*)"/);
  const mediaAudioChannelsMatch = xml.match(/<Media[^>]*audioChannels="([^"]*)"/);
  const mediaWidthMatch = xml.match(/<Media[^>]*width="([^"]*)"/);
  const mediaHeightMatch = xml.match(/<Media[^>]*height="([^"]*)"/);
  const videoCodec = mediaVideoCodecMatch ? mediaVideoCodecMatch[1].toUpperCase() : null;
  const audioCodec = mediaAudioCodecMatch ? mediaAudioCodecMatch[1].toUpperCase() : null;
  const audioChannels = mediaAudioChannelsMatch ? parseInt(mediaAudioChannelsMatch[1], 10) : null;
  const resolution = mediaWidthMatch && mediaHeightMatch ? `${mediaWidthMatch[1]}x${mediaHeightMatch[1]}` : null;

  // TranscodeSession details
  const tsMatch = xml.match(/<TranscodeSession([^>]*)\/?>/)
  const tsGetAttr = (name) => {
    if (!tsMatch) return null;
    const m = tsMatch[1].match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
    return m ? m[1] : null;
  };
  const transcodeVideoCodec = tsGetAttr('videoCodec')?.toUpperCase() || null;
  const transcodeAudioCodec = tsGetAttr('audioCodec')?.toUpperCase() || null;
  const transcodeVideoDecision = tsGetAttr('videoDecision') || null;
  const transcodeAudioDecision = tsGetAttr('audioDecision') || null;
  const transcodeBitrate = tsGetAttr('speed') ? null : null; // Plex doesn't expose bitrate directly
  const transcodeReason = [
    transcodeVideoDecision === 'transcode' ? 'Video transcoding' : null,
    transcodeAudioDecision === 'transcode' ? 'Audio transcoding' : null,
  ].filter(Boolean).join(', ') || null;

  // Determine play method similar to Emby/Jellyfin
  let playMethod = 'DirectPlay';
  if (isTranscoding) {
    if (transcodeVideoDecision === 'transcode' || transcodeAudioDecision === 'transcode') {
      playMethod = 'Transcode';
    } else if (transcodeVideoDecision === 'copy' && transcodeAudioDecision === 'copy') {
      playMethod = 'DirectStream';
    }
  }

  return {
    user, title: getAttr('title') || 'Unknown',
    grandparentTitle: getAttr('grandparentTitle'), parentTitle: getAttr('parentTitle'),
    seasonEpisode,
    type: getAttr('type') || defaultType,
    thumb: getAttr('thumb') || getAttr('parentThumb') || getAttr('grandparentThumb'),
    state, platform, client, deviceName,
    viewOffset: parseInt(getAttr('viewOffset') || '0', 10),
    duration: parseInt(getAttr('duration') || '0', 10),
    quality, transcoding: isTranscoding,
    // Consistent fields with Emby/Jellyfin
    resolution, videoCodec, audioCodec, audioChannels,
    playMethod, isTranscoding,
    transcodeVideoCodec, transcodeAudioCodec, transcodeReason,
  };
}

export async function handlePlexImage(widget, imagePath) {
  const { url, token } = widget;
  const imageUrl = `${url.replace(/\/$/, '')}${imagePath}?X-Plex-Token=${token}`;
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
  return { data: response.data, contentType: response.headers['content-type'] || 'image/jpeg' };
}

// Sonarr proxy handler
export async function handleSonarrProxy(widget, endpoint = 'unified') {
  try {
    const { url, token } = widget;
    if (!url || !token) throw new Error('Missing URL or token');
    const baseUrl = url.replace(/\/$/, '');
    const headers = { 'X-Api-Key': token };

    // Fetch series count
    let series = 0;
    try {
      const seriesResponse = await axios.get(`${baseUrl}/api/v3/series`, { headers, timeout: 10000 });
      series = Array.isArray(seriesResponse.data) ? seriesResponse.data.length : 0;
    } catch (err) { console.error('Error fetching Sonarr series:', err.message); }

    // Fetch queue with full details
    let queue = 0;
    let queueItems = [];
    try {
      const queueResponse = await axios.get(`${baseUrl}/api/v3/queue?includeUnknownSeriesItems=true&includeSeries=true&includeEpisode=true&pageSize=50`, { headers, timeout: 10000 });
      queue = queueResponse.data?.totalRecords || 0;

      if (queue > 0 && Array.isArray(queueResponse.data?.records)) {
        queueItems = queueResponse.data.records.map(item => {
          const size = item.size || 0;
          const sizeleft = item.sizeleft || 0;
          const progress = size > 0 ? Math.round((1 - sizeleft / size) * 100) : 0;
          return {
            id: item.id,
            title: item.title || item.episode?.title || 'Unknown',
            series: item.series?.title || '',
            season: item.episode?.seasonNumber,
            episode: item.episode?.episodeNumber,
            timeLeft: item.timeleft || null,
            estimatedCompletionTime: item.estimatedCompletionTime || null,
            progress,
            status: item.status,
            trackedDownloadStatus: item.trackedDownloadStatus || null,
            trackedDownloadState: item.trackedDownloadState || null,
            size,
            sizeleft,
            quality: item.quality?.quality?.name || null,
            downloadClient: item.downloadClient || null,
            indexer: item.indexer || null,
            protocol: item.protocol || null,
            errorMessage: item.errorMessage || null,
            statusMessages: item.statusMessages || [],
            outputPath: item.outputPath || null,
            added: item.added || null,
          };
        });
      }
    } catch (err) { console.error('Error fetching Sonarr queue:', err.message); }

    // Fetch wanted/missing
    let wanted = 0;
    try {
      const wantedResponse = await axios.get(`${baseUrl}/api/v3/wanted/missing?pageSize=1`, { headers, timeout: 10000 });
      wanted = wantedResponse.data?.totalRecords || 0;
    } catch (err) { console.error('Error fetching Sonarr wanted:', err.message); }

    // Fetch calendar (7 days)
    let today = 0;
    let calendarItems = [];
    try {
      const now = new Date();
      const start = now.toISOString().split('T')[0];
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const calendarResponse = await axios.get(`${baseUrl}/api/v3/calendar?start=${start}&end=${end}&includeSeries=true`, { headers, timeout: 10000 });
      if (Array.isArray(calendarResponse.data)) {
        const todayStr = start;
        today = calendarResponse.data.filter(ep => ep.airDate === todayStr).length;
        calendarItems = calendarResponse.data.map(ep => {
          const poster = (ep.series?.images || []).find(i => i.coverType === 'poster');
          return {
            id: ep.id,
            seriesId: ep.seriesId,
            seriesTitle: ep.series?.title || '',
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
            title: ep.title || '',
            airDate: ep.airDate || null,
            airDateUtc: ep.airDateUtc || null,
            hasFile: ep.hasFile || false,
            monitored: ep.monitored ?? true,
            overview: ep.overview || '',
            network: ep.series?.network || '',
            posterUrl: poster?.remoteUrl || poster?.url || null,
          };
        });
      }
    } catch (err) { console.error('Error fetching Sonarr calendar:', err.message); }

    return { series, queue, queueItems, wanted, today, calendarItems };
  } catch (error) {
    console.error('Error in Sonarr proxy handler:', error);
    throw error;
  }
}

// Sonarr action handler - mutations (queue remove, grab, lookup, add series, commands)
export async function handleSonarrAction(widget, action, params = {}) {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or token');
  const baseUrl = url.replace(/\/$/, '');
  const headers = { 'X-Api-Key': token, 'Content-Type': 'application/json' };

  switch (action) {
    case 'queue.remove':
    case 'queue.blocklist': {
      const { id, removeFromClient = true, blocklist = false, skipRedownload = false } = params;
      await axios.delete(`${baseUrl}/api/v3/queue/${id}?removeFromClient=${removeFromClient}&blocklist=${blocklist}&skipRedownload=${skipRedownload}`, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'queue.grab': {
      const { id } = params;
      await axios.post(`${baseUrl}/api/v3/queue/grab/${id}`, {}, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'lookup': {
      const { term } = params;
      const res = await axios.get(`${baseUrl}/api/v3/series/lookup?term=${encodeURIComponent(term)}`, { headers, timeout: 15000 });
      return (res.data || []).slice(0, 10).map(s => ({
        title: s.title,
        tvdbId: s.tvdbId,
        year: s.year,
        overview: s.overview || '',
        network: s.network || '',
        status: s.status || '',
        seasonCount: s.statistics?.seasonCount || s.seasons?.length || 0,
        images: s.images || [],
        titleSlug: s.titleSlug,
        seasons: s.seasons,
        existsInLibrary: !!s.id && s.id > 0,
      }));
    }
    case 'add': {
      const { tvdbId, title, titleSlug, qualityProfileId, rootFolderPath, monitored = true, seasons, images, searchForMissingEpisodes = true } = params;
      const body = { tvdbId, title, titleSlug, qualityProfileId, rootFolderPath, monitored, seasons, images, seasonFolder: true, addOptions: { monitor: 'all', searchForMissingEpisodes } };
      const res = await axios.post(`${baseUrl}/api/v3/series`, body, { headers, timeout: 15000 });
      return { success: true, id: res.data?.id, title: res.data?.title };
    }
    case 'qualityProfiles': {
      const res = await axios.get(`${baseUrl}/api/v3/qualityprofile`, { headers, timeout: 10000 });
      return (res.data || []).map(p => ({ id: p.id, name: p.name }));
    }
    case 'rootFolders': {
      const res = await axios.get(`${baseUrl}/api/v3/rootfolder`, { headers, timeout: 10000 });
      return (res.data || []).map(f => ({ id: f.id, path: f.path, freeSpace: f.freeSpace }));
    }
    case 'command': {
      const { name, ...rest } = params;
      const res = await axios.post(`${baseUrl}/api/v3/command`, { name, ...rest }, { headers, timeout: 10000 });
      return { success: true, id: res.data?.id, status: res.data?.status };
    }
    default:
      throw new Error(`Unknown Sonarr action: ${action}`);
  }
}

// Radarr proxy handler
export async function handleRadarrProxy(widget, endpoint = 'unified') {
  try {
    const { url, token } = widget;
    if (!url || !token) throw new Error('Missing URL or token');
    const baseUrl = url.replace(/\/$/, '');
    const headers = { 'X-Api-Key': token };

    // Fetch movies
    let movies = 0, downloaded = 0, missing = 0;
    try {
      const moviesResponse = await axios.get(`${baseUrl}/api/v3/movie`, { headers, timeout: 15000 });
      if (Array.isArray(moviesResponse.data)) {
        movies = moviesResponse.data.length;
        moviesResponse.data.forEach(movie => {
          if (movie.hasFile) downloaded++;
          else if (movie.monitored && movie.isAvailable) missing++;
        });
      }
    } catch (err) { console.error('Error fetching Radarr movies:', err.message); }

    // Fetch queue with full details
    let queue = 0;
    let queueItems = [];
    try {
      const queueResponse = await axios.get(`${baseUrl}/api/v3/queue?includeUnknownMovieItems=true&includeMovie=true&pageSize=50`, { headers, timeout: 10000 });
      queue = queueResponse.data?.totalRecords || 0;

      if (queue > 0 && Array.isArray(queueResponse.data?.records)) {
        queueItems = queueResponse.data.records.map(item => {
          const size = item.size || 0;
          const sizeleft = item.sizeleft || 0;
          const progress = size > 0 ? Math.round((1 - sizeleft / size) * 100) : 0;
          return {
            id: item.id,
            title: item.title || item.movie?.title || 'Unknown',
            year: item.movie?.year || null,
            timeLeft: item.timeleft || null,
            estimatedCompletionTime: item.estimatedCompletionTime || null,
            progress,
            status: item.status,
            trackedDownloadStatus: item.trackedDownloadStatus || null,
            trackedDownloadState: item.trackedDownloadState || null,
            size,
            sizeleft,
            quality: item.quality?.quality?.name || null,
            downloadClient: item.downloadClient || null,
            indexer: item.indexer || null,
            protocol: item.protocol || null,
            errorMessage: item.errorMessage || null,
            statusMessages: item.statusMessages || [],
            outputPath: item.outputPath || null,
            added: item.added || null,
          };
        });
      }
    } catch (err) { console.error('Error fetching Radarr queue:', err.message); }

    // Fetch calendar (30 days - upcoming releases)
    let calendarItems = [];
    try {
      const now = new Date();
      const start = now.toISOString().split('T')[0];
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const calendarResponse = await axios.get(`${baseUrl}/api/v3/calendar?start=${start}&end=${end}`, { headers, timeout: 10000 });
      if (Array.isArray(calendarResponse.data)) {
        calendarItems = calendarResponse.data.map(movie => {
          const poster = (movie.images || []).find(i => i.coverType === 'poster');
          return {
            id: movie.id,
            title: movie.title || '',
            year: movie.year || null,
            overview: movie.overview || '',
            studio: movie.studio || '',
            hasFile: movie.hasFile || false,
            monitored: movie.monitored ?? true,
            inCinemas: movie.inCinemas || null,
            physicalRelease: movie.physicalRelease || null,
            digitalRelease: movie.digitalRelease || null,
            runtime: movie.runtime || 0,
            posterUrl: poster?.remoteUrl || poster?.url || null,
          };
        });
      }
    } catch (err) { console.error('Error fetching Radarr calendar:', err.message); }

    return { movies, downloaded, missing, queue, queueItems, calendarItems };
  } catch (error) {
    console.error('Error in Radarr proxy handler:', error);
    throw error;
  }
}

// Radarr action handler - mutations (queue remove, grab, lookup, add movie, commands)
export async function handleRadarrAction(widget, action, params = {}) {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or token');
  const baseUrl = url.replace(/\/$/, '');
  const headers = { 'X-Api-Key': token, 'Content-Type': 'application/json' };

  switch (action) {
    case 'queue.remove':
    case 'queue.blocklist': {
      const { id, removeFromClient = true, blocklist = false, skipRedownload = false } = params;
      await axios.delete(`${baseUrl}/api/v3/queue/${id}?removeFromClient=${removeFromClient}&blocklist=${blocklist}&skipRedownload=${skipRedownload}`, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'queue.grab': {
      const { id } = params;
      await axios.post(`${baseUrl}/api/v3/queue/grab/${id}`, {}, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'lookup': {
      const { term } = params;
      const res = await axios.get(`${baseUrl}/api/v3/movie/lookup?term=${encodeURIComponent(term)}`, { headers, timeout: 15000 });
      return (res.data || []).slice(0, 10).map(m => ({
        title: m.title,
        tmdbId: m.tmdbId,
        imdbId: m.imdbId || '',
        year: m.year,
        overview: m.overview || '',
        runtime: m.runtime || 0,
        images: m.images || [],
        existsInLibrary: !!m.id && m.id > 0,
      }));
    }
    case 'add': {
      const { tmdbId, title, qualityProfileId, rootFolderPath, monitored = true, minimumAvailability = 'released', searchForMovie = true } = params;
      const body = { tmdbId, title, qualityProfileId, rootFolderPath, monitored, minimumAvailability, addOptions: { searchForMovie } };
      const res = await axios.post(`${baseUrl}/api/v3/movie`, body, { headers, timeout: 15000 });
      return { success: true, id: res.data?.id, title: res.data?.title };
    }
    case 'qualityProfiles': {
      const res = await axios.get(`${baseUrl}/api/v3/qualityprofile`, { headers, timeout: 10000 });
      return (res.data || []).map(p => ({ id: p.id, name: p.name }));
    }
    case 'rootFolders': {
      const res = await axios.get(`${baseUrl}/api/v3/rootfolder`, { headers, timeout: 10000 });
      return (res.data || []).map(f => ({ id: f.id, path: f.path, freeSpace: f.freeSpace }));
    }
    case 'command': {
      const { name, ...rest } = params;
      const res = await axios.post(`${baseUrl}/api/v3/command`, { name, ...rest }, { headers, timeout: 10000 });
      return { success: true, id: res.data?.id, status: res.data?.status };
    }
    default:
      throw new Error(`Unknown Radarr action: ${action}`);
  }
}

// Jellyfin proxy handler
export async function handleJellyfinProxy(widget, endpoint = 'unified') {
  try {
    const { url, token } = widget;
    if (!url || !token) throw new Error('Missing URL or token');
    const baseUrl = url.replace(/\/$/, '');
    const headers = { 'X-Emby-Token': token };

    // Check for cached library stats
    const cacheKey = `jellyfin-${widget.id}`;
    let cachedStats = getCachedLibraryStats(cacheKey);
    let movies = cachedStats?.movies ?? 0;
    let series = cachedStats?.series ?? 0;
    let episodes = cachedStats?.episodes ?? 0;
    let songs = cachedStats?.songs ?? 0;

    // Only fetch library counts if not cached
    if (!cachedStats) {
      try {
        const countsResponse = await axios.get(`${baseUrl}/Items/Counts`, { headers, timeout: 10000 });
        movies = countsResponse.data?.MovieCount || 0;
        series = countsResponse.data?.SeriesCount || 0;
        episodes = countsResponse.data?.EpisodeCount || 0;
        songs = countsResponse.data?.SongCount || 0;
        // Cache the library stats
        setCachedLibraryStats(cacheKey, { movies, series, episodes, songs });
      } catch (err) { console.error('Error fetching Jellyfin counts:', err.message); }
    }

    // Fetch sessions (now playing)
    let streams = 0;
    let sessions = [];
    try {
      const sessionsResponse = await axios.get(`${baseUrl}/Sessions`, { headers, timeout: 10000 });
      if (Array.isArray(sessionsResponse.data)) {
        const activeSessions = sessionsResponse.data.filter(s => s.NowPlayingItem);
        streams = activeSessions.length;
        sessions = activeSessions.map(session => {
          const item = session.NowPlayingItem;
          // Get primary image ID - prefer series image for episodes
          const imageItemId = item?.SeriesId || item?.Id;
          const imageTag = item?.SeriesPrimaryImageTag || item?.ImageTags?.Primary;

          // Get video stream info for resolution
          const videoStream = item?.MediaStreams?.find(s => s.Type === 'Video');
          const audioStream = item?.MediaStreams?.find(s => s.Type === 'Audio');
          const resolution = videoStream ? `${videoStream.Width}x${videoStream.Height}` : null;
          const videoCodec = videoStream?.Codec?.toUpperCase() || null;
          const audioCodec = audioStream?.Codec?.toUpperCase() || null;
          const audioChannels = audioStream?.Channels || null;

          // Transcoding info
          const transcodeInfo = session.TranscodingInfo;
          const isTranscoding = !!transcodeInfo;
          const transcodeReason = transcodeInfo?.TranscodeReasons?.join(', ') || null;
          const transcodeProgress = transcodeInfo?.CompletionPercentage || null;
          const transcodeBitrate = transcodeInfo?.Bitrate || null;
          const transcodeVideoCodec = transcodeInfo?.VideoCodec?.toUpperCase() || null;
          const transcodeAudioCodec = transcodeInfo?.AudioCodec?.toUpperCase() || null;

          return {
            userName: session.UserName || 'Unknown',
            client: session.Client || session.DeviceName || 'Unknown',
            deviceName: session.DeviceName || '',
            nowPlayingItem: item?.Name || 'Unknown',
            seriesName: item?.SeriesName || null,
            seasonEpisode: item?.ParentIndexNumber && item?.IndexNumber
              ? `S${String(item.ParentIndexNumber).padStart(2, '0')}E${String(item.IndexNumber).padStart(2, '0')}`
              : null,
            type: item?.Type || 'Unknown',
            isPaused: session.PlayState?.IsPaused || false,
            positionTicks: session.PlayState?.PositionTicks || 0,
            runtimeTicks: item?.RunTimeTicks || 0,
            itemId: imageItemId,
            imageTag: imageTag,
            // Media info
            resolution,
            videoCodec,
            audioCodec,
            audioChannels,
            bitrate: item?.Bitrate || null,
            // Transcoding info
            isTranscoding,
            transcodeReason,
            transcodeProgress,
            transcodeBitrate,
            transcodeVideoCodec,
            transcodeAudioCodec,
            playMethod: session.PlayState?.PlayMethod || 'Unknown',
          };
        });
      }
    } catch (err) { console.error('Error fetching Jellyfin sessions:', err.message); }

    return { movies, series, episodes, songs, streams, sessions };
  } catch (error) {
    console.error('Error in Jellyfin proxy handler:', error);
    throw error;
  }
}

// Jellyfin image proxy handler
export async function handleJellyfinImage(widget, imagePath) {
  const { url, token } = widget;
  const baseUrl = url.replace(/\/$/, '');
  // imagePath format: /Items/{itemId}/Images/Primary
  const imageUrl = `${baseUrl}${imagePath}`;
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 10000,
    headers: { 'X-Emby-Token': token },
  });
  return { data: response.data, contentType: response.headers['content-type'] || 'image/jpeg' };
}

// Lidarr proxy handler
export async function handleLidarrProxy(widget, endpoint = 'unified') {
  try {
    const { url, token } = widget;
    if (!url || !token) throw new Error('Missing URL or token');
    const baseUrl = url.replace(/\/$/, '');
    const headers = { 'X-Api-Key': token };

    // Fetch artists
    let artists = 0;
    try {
      const artistsResponse = await axios.get(`${baseUrl}/api/v1/artist`, { headers, timeout: 10000 });
      artists = Array.isArray(artistsResponse.data) ? artistsResponse.data.length : 0;
    } catch (err) { console.error('Error fetching Lidarr artists:', err.message); }

    // Fetch queue
    let queue = 0;
    let queueItems = [];
    try {
      const queueResponse = await axios.get(`${baseUrl}/api/v1/queue`, { headers, timeout: 10000 });
      queue = queueResponse.data?.totalRecords || 0;

      if (queue > 0 && Array.isArray(queueResponse.data?.records)) {
        queueItems = queueResponse.data.records.slice(0, 10).map(item => {
          const size = item.size || 0;
          const sizeleft = item.sizeleft || 0;
          const progress = size > 0 ? Math.round((1 - sizeleft / size) * 100) : 0;
          return {
            title: item.title || item.album?.title || 'Unknown',
            artist: item.artist?.artistName || '',
            timeLeft: item.timeleft || null,
            progress,
            status: item.status,
            size: size,
            sizeleft: sizeleft,
            quality: item.quality?.quality?.name || null,
            downloadClient: item.downloadClient || null,
            indexer: item.indexer || null,
            errorMessage: item.errorMessage || null,
            statusMessages: item.statusMessages?.map(m => m.messages?.join(', ')).filter(Boolean) || [],
          };
        });
      }
    } catch (err) { console.error('Error fetching Lidarr queue:', err.message); }

    // Fetch wanted/missing
    let wanted = 0;
    try {
      const wantedResponse = await axios.get(`${baseUrl}/api/v1/wanted/missing?pageSize=1`, { headers, timeout: 10000 });
      wanted = wantedResponse.data?.totalRecords || 0;
    } catch (err) { console.error('Error fetching Lidarr wanted:', err.message); }

    return { artists, queue, queueItems, wanted };
  } catch (error) {
    console.error('Error in Lidarr proxy handler:', error);
    throw error;
  }
}

// Emby proxy handler (similar to Jellyfin)
export async function handleEmbyProxy(widget, endpoint = 'unified') {
  try {
    const { url, token, username, password } = widget;
    if (!url) throw new Error('Missing URL');
    if (!token && (!username || !password)) throw new Error('Missing token or username/password');
    const baseUrl = url.replace(/\/$/, '');

    // Determine which token to use - prefer user authentication for session data
    let sessionToken = token;
    if (username && password) {
      const userToken = await getEmbyUserToken(baseUrl, username, password, widget.id);
      if (userToken) {
        sessionToken = userToken;
      }
    }
    const headers = { 'X-Emby-Token': token };
    const sessionHeaders = { 'X-Emby-Token': sessionToken };

    // Check for cached library stats
    const cacheKey = `emby-${widget.id}`;
    let cachedStats = getCachedLibraryStats(cacheKey);
    let movies = cachedStats?.movies ?? 0;
    let series = cachedStats?.series ?? 0;
    let episodes = cachedStats?.episodes ?? 0;
    let songs = cachedStats?.songs ?? 0;

    // Only fetch library counts if not cached
    if (!cachedStats) {
      try {
        const countsResponse = await axios.get(`${baseUrl}/Items/Counts`, { headers, timeout: 10000 });
        movies = countsResponse.data?.MovieCount || 0;
        series = countsResponse.data?.SeriesCount || 0;
        episodes = countsResponse.data?.EpisodeCount || 0;
        songs = countsResponse.data?.SongCount || 0;
        // Cache the library stats
        setCachedLibraryStats(cacheKey, { movies, series, episodes, songs });
      } catch (err) { console.error('Error fetching Emby counts:', err.message); }
    }

    // Fetch sessions (now playing)
    // Emby requires user authentication (not just API key) to see NowPlayingItem
    let streams = 0;
    let sessions = [];
    try {
      const sessionsResponse = await axios.get(`${baseUrl}/Sessions`, { headers: sessionHeaders, timeout: 10000 });
      if (Array.isArray(sessionsResponse.data)) {
        const activeSessions = sessionsResponse.data.filter(s => s.NowPlayingItem);
        streams = activeSessions.length;
        sessions = activeSessions.map(session => {
          const item = session.NowPlayingItem;
          // Get primary image ID - prefer series image for episodes
          const imageItemId = item?.SeriesId || item?.Id;
          const imageTag = item?.SeriesPrimaryImageTag || item?.ImageTags?.Primary;

          // Get video stream info for resolution
          const videoStream = item?.MediaStreams?.find(s => s.Type === 'Video');
          const audioStream = item?.MediaStreams?.find(s => s.Type === 'Audio');
          const resolution = videoStream ? `${videoStream.Width}x${videoStream.Height}` : null;
          const videoCodec = videoStream?.Codec?.toUpperCase() || null;
          const audioCodec = audioStream?.Codec?.toUpperCase() || null;
          const audioChannels = audioStream?.Channels || null;

          // Transcoding info
          const transcodeInfo = session.TranscodingInfo;
          const isTranscoding = !!transcodeInfo;
          const transcodeReason = transcodeInfo?.TranscodeReasons?.join(', ') || null;
          const transcodeProgress = transcodeInfo?.CompletionPercentage || null;
          const transcodeBitrate = transcodeInfo?.Bitrate || null;
          const transcodeVideoCodec = transcodeInfo?.VideoCodec?.toUpperCase() || null;
          const transcodeAudioCodec = transcodeInfo?.AudioCodec?.toUpperCase() || null;

          return {
            userName: session.UserName || 'Unknown',
            client: session.Client || session.DeviceName || 'Unknown',
            deviceName: session.DeviceName || '',
            nowPlayingItem: item?.Name || 'Unknown',
            seriesName: item?.SeriesName || null,
            seasonEpisode: item?.ParentIndexNumber && item?.IndexNumber
              ? `S${String(item.ParentIndexNumber).padStart(2, '0')}E${String(item.IndexNumber).padStart(2, '0')}`
              : null,
            type: item?.Type || 'Unknown',
            isPaused: session.PlayState?.IsPaused || false,
            positionTicks: session.PlayState?.PositionTicks || 0,
            runtimeTicks: item?.RunTimeTicks || 0,
            itemId: imageItemId,
            imageTag: imageTag,
            // Media info
            resolution,
            videoCodec,
            audioCodec,
            audioChannels,
            bitrate: item?.Bitrate || null,
            // Transcoding info
            isTranscoding,
            transcodeReason,
            transcodeProgress,
            transcodeBitrate,
            transcodeVideoCodec,
            transcodeAudioCodec,
            playMethod: session.PlayState?.PlayMethod || 'Unknown',
          };
        });
      }
    } catch (err) { console.error('Error fetching Emby sessions:', err.message); }

    return { movies, series, episodes, songs, streams, sessions };
  } catch (error) {
    console.error('Error in Emby proxy handler:', error);
    throw error;
  }
}

// Emby image proxy handler
export async function handleEmbyImage(widget, imagePath) {
  const { url, token } = widget;
  const baseUrl = url.replace(/\/$/, '');
  // imagePath format: /Items/{itemId}/Images/Primary
  const imageUrl = `${baseUrl}${imagePath}`;
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 10000,
    headers: { 'X-Emby-Token': token },
  });
  return { data: response.data, contentType: response.headers['content-type'] || 'image/jpeg' };
}

// Overseerr proxy handler
// Shared Seerr proxy handler (works for Overseerr, Jellyseerr, Seerr)
async function handleSeerrProxyShared(widget, label = 'Seerr') {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or token');
  const baseUrl = url.replace(/\/$/, '');
  const headers = { 'X-Api-Key': token };

  let pending = 0, approved = 0, processing = 0, available = 0;
  let issues = { open: 0 };
  let requests = [];

  // Fetch request counts
  try {
    const countResponse = await axios.get(`${baseUrl}/api/v1/request/count`, { headers, timeout: 10000 });
    pending = countResponse.data?.pending || 0;
    approved = countResponse.data?.approved || 0;
    processing = countResponse.data?.processing || 0;
    available = countResponse.data?.available || 0;
  } catch (err) { console.error(`Error fetching ${label} request counts:`, err.message); }

  // Fetch recent requests with details
  try {
    const reqResponse = await axios.get(`${baseUrl}/api/v1/request?take=20&sort=added&filter=all`, { headers, timeout: 10000 });
    if (Array.isArray(reqResponse.data?.results)) {
      // The /request endpoint doesn't include titles in the media object.
      // We need to fetch titles from /movie/{tmdbId} or /tv/{tmdbId} separately.
      const rawRequests = reqResponse.data.results.map(req => ({
        id: req.id,
        status: req.status, // 1=pending, 2=approved, 3=declined
        type: req.type, // movie or tv
        is4k: req.is4k || false,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        requestedBy: req.requestedBy?.displayName || req.requestedBy?.email || 'Unknown',
        requestedByAvatar: req.requestedBy?.avatar || null,
        title: null,
        mediaId: req.media?.id || null,
        tmdbId: req.media?.tmdbId || null,
        tvdbId: req.media?.tvdbId || null,
        posterPath: req.media?.posterPath || null,
        mediaStatus: req.media?.status || null, // 1=unknown, 2=pending, 3=processing, 4=partially_available, 5=available
      }));

      // Fetch titles in parallel from /movie or /tv endpoints
      await Promise.all(rawRequests.map(async (item) => {
        if (!item.tmdbId) {
          item.title = item.type === 'movie' ? 'Unknown Movie' : 'Unknown Show';
          return;
        }
        try {
          const endpoint = item.type === 'movie' ? 'movie' : 'tv';
          const detailRes = await axios.get(`${baseUrl}/api/v1/${endpoint}/${item.tmdbId}`, { headers, timeout: 10000 });
          item.title = detailRes.data?.title || detailRes.data?.name || (item.type === 'movie' ? 'Unknown Movie' : 'Unknown Show');
          if (!item.posterPath && detailRes.data?.posterPath) {
            item.posterPath = detailRes.data.posterPath;
          }
        } catch {
          item.title = item.type === 'movie' ? 'Unknown Movie' : 'Unknown Show';
        }
      }));

      requests = rawRequests;
    }
  } catch (err) { console.error(`Error fetching ${label} requests:`, err.message); }

  // Fetch issue counts
  try {
    const issueResponse = await axios.get(`${baseUrl}/api/v1/issue/count`, { headers, timeout: 10000 });
    issues.open = issueResponse.data?.open || 0;
  } catch (err) { console.error(`Error fetching ${label} issue counts:`, err.message); }

  return { pending, approved, processing, available, issues, requests };
}

// Shared Seerr action handler
async function handleSeerrActionShared(widget, action, params = {}) {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or token');
  const baseUrl = url.replace(/\/$/, '');
  const headers = { 'X-Api-Key': token, 'Content-Type': 'application/json' };

  switch (action) {
    case 'request.approve': {
      const { id } = params;
      await axios.post(`${baseUrl}/api/v1/request/${id}/approve`, {}, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'request.decline': {
      const { id } = params;
      await axios.post(`${baseUrl}/api/v1/request/${id}/decline`, {}, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'request.delete': {
      const { id } = params;
      await axios.delete(`${baseUrl}/api/v1/request/${id}`, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'request.retry': {
      const { id } = params;
      await axios.post(`${baseUrl}/api/v1/request/${id}/retry`, {}, { headers, timeout: 10000 });
      return { success: true };
    }
    case 'search': {
      const { query, page = 1 } = params;
      const res = await axios.get(`${baseUrl}/api/v1/search?query=${encodeURIComponent(query)}&page=${page}`, { headers, timeout: 15000 });
      return (res.data?.results || []).slice(0, 12).map(item => ({
        id: item.id,
        title: item.title || item.name || item.originalTitle || item.originalName || 'Unknown',
        mediaType: item.mediaType, // movie or tv
        year: item.releaseDate?.substring(0, 4) || item.firstAirDate?.substring(0, 4) || '',
        overview: item.overview || '',
        posterPath: item.posterPath || null,
        voteAverage: item.voteAverage || 0,
        mediaInfo: item.mediaInfo || null, // null = not in library
      }));
    }
    case 'request.create': {
      const { mediaType, mediaId, is4k = false } = params;
      const body = { mediaType, mediaId, is4k };
      if (mediaType === 'tv') body.seasons = params.seasons || 'all';
      const res = await axios.post(`${baseUrl}/api/v1/request`, body, { headers, timeout: 15000 });
      return { success: true, id: res.data?.id };
    }
    default:
      throw new Error(`Unknown Seerr action: ${action}`);
  }
}

export async function handleOverseerrProxy(widget, endpoint = 'unified') {
  try {
    return await handleSeerrProxyShared(widget, 'Overseerr');
  } catch (error) {
    console.error('Error in Overseerr proxy handler:', error);
    throw error;
  }
}

export async function handleOverseerrAction(widget, action, params = {}) {
  return handleSeerrActionShared(widget, action, params);
}

// Jellyseerr proxy handler
export async function handleJellyseerrProxy(widget, endpoint = 'unified') {
  try {
    return await handleSeerrProxyShared(widget, 'Jellyseerr');
  } catch (error) {
    console.error('Error in Jellyseerr proxy handler:', error);
    throw error;
  }
}

export async function handleJellyseerrAction(widget, action, params = {}) {
  return handleSeerrActionShared(widget, action, params);
}

// SABnzbd proxy handler
async function handleSabnzbdProxy(widget) {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or API key');

  const baseUrl = url.replace(/\/$/, '');

  // Fetch queue and history in parallel
  const [queueRes, historyRes] = await Promise.all([
    axios.get(`${baseUrl}/api/`, {
      params: { apikey: token, output: 'json', mode: 'queue' },
      timeout: 10000,
    }),
    axios.get(`${baseUrl}/api/`, {
      params: { apikey: token, output: 'json', mode: 'history', limit: 1 },
      timeout: 10000,
    }),
  ]);

  const queue = queueRes.data?.queue || {};
  const history = historyRes.data?.history || {};

  // Count only actively downloading slots (not paused/queued)
  const slots = queue.slots || [];
  const activeDownloads = slots.filter(s => s.status === 'Downloading').length;
  const queuedCount = slots.filter(s => s.status === 'Queued' || s.status === 'Idle').length;

  return {
    status: queue.paused ? 'Paused' : (activeDownloads > 0 ? 'Downloading' : 'Idle'),
    speed: queue.speed || '0',
    speedBytes: Number(queue.kbpersec || 0) * 1024,
    sizeLeft: queue.sizeleft || '0 B',
    timeLeft: queue.timeleft || '0:00:00',
    activeDownloads,
    queueCount: slots.length,
    queuedCount,
    totalHistory: Number(history.noofslots || 0),
    diskFree: queue.diskspace1 ? `${Number(queue.diskspace1).toFixed(1)} GB` : null,
    paused: queue.paused || false,
  };
}

// Navidrome JWT token cache
const navidromeTokenCache = new Map();
const NAVIDROME_TOKEN_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

async function getNavidromeToken(baseUrl, username, password, widgetId) {
  const cacheKey = `nd-token-${widgetId}`;
  const cached = navidromeTokenCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < NAVIDROME_TOKEN_CACHE_TTL) {
    return cached;
  }

  const loginResp = await axios.post(`${baseUrl}/auth/login`, {
    username,
    password,
  }, { timeout: 10000 });

  const token = loginResp.data.token;
  const subsonicSalt = loginResp.data.subsonicSalt;
  const subsonicToken = loginResp.data.subsonicToken;

  const entry = { token, subsonicSalt, subsonicToken, timestamp: Date.now() };
  navidromeTokenCache.set(cacheKey, entry);
  return entry;
}

// Navidrome proxy handler (uses native API for stats + Subsonic API for now playing)
export async function handleNavidromeProxy(widget) {
  const { url, token: password, username } = widget;
  const baseUrl = url.replace(/\/$/, '');
  const user = username || 'admin';

  // Authenticate with Navidrome native API
  const auth = await getNavidromeToken(baseUrl, user, password, widget.id);
  const ndHeaders = { 'x-nd-authorization': `Bearer ${auth.token}` };

  const results = {};

  // Fetch counts via native API (accurate totals via X-Total-Count header)
  const countEndpoints = [
    { key: 'songs', path: '/api/song?_end=1&_start=0&_sort=title&_order=ASC' },
    { key: 'albums', path: '/api/album?_end=1&_start=0&_sort=name&_order=ASC' },
    { key: 'artists', path: '/api/artist?_end=1&_start=0&_sort=name&_order=ASC' },
  ];

  await Promise.all(countEndpoints.map(async ({ key, path }) => {
    try {
      const resp = await axios.get(`${baseUrl}${path}`, { headers: ndHeaders, timeout: 10000 });
      results[key] = parseInt(resp.headers['x-total-count'] || '0', 10);
    } catch (e) { /* optional */ }
  }));

  // Fetch playlists count
  try {
    const resp = await axios.get(`${baseUrl}/api/playlist?_end=1&_start=0&_sort=name&_order=ASC`, {
      headers: ndHeaders, timeout: 10000,
    });
    results.playlists = parseInt(resp.headers['x-total-count'] || '0', 10);
  } catch (e) { /* optional */ }

  // Fetch players and transcoding profiles for transcoding info
  let players = [];
  let transcodings = [];
  try {
    const [playersResp, transResp] = await Promise.all([
      axios.get(`${baseUrl}/api/player?_end=100&_start=0&_sort=lastSeen&_order=DESC`, { headers: ndHeaders, timeout: 10000 }),
      axios.get(`${baseUrl}/api/transcoding`, { headers: ndHeaders, timeout: 10000 }),
    ]);
    players = playersResp.data || [];
    transcodings = transResp.data || [];
  } catch (e) { /* optional */ }

  // Build lookup maps
  const transcodingMap = {};
  transcodings.forEach(t => { transcodingMap[t.id] = t; });

  // Fetch now playing via Subsonic API (native API doesn't have this)
  const subAuth = `u=${encodeURIComponent(user)}&t=${auth.subsonicToken}&s=${auth.subsonicSalt}&v=1.16.1&c=spyglass&f=json`;
  try {
    const resp = await axios.get(`${baseUrl}/rest/getNowPlaying?${subAuth}`, { timeout: 10000 });
    const body = resp.data?.['subsonic-response'];
    const entries = body?.nowPlaying?.entry || [];
    results.playing = entries.length;
    results.nowPlaying = entries.slice(0, 5).map(e => {
      // Match player by name/client to get transcoding info
      const player = players.find(p =>
        p.name === e.playerName || p.client === e.playerName ||
        (e.playerName && p.name?.startsWith(e.playerName))
      );
      const transcoding = player?.transcodingId ? transcodingMap[player.transcodingId] : null;
      const isTranscoding = !!transcoding;
      const maxBitRate = player?.maxBitRate || 0;

      return {
        title: e.title || 'Unknown',
        artist: e.artist || 'Unknown',
        album: e.album || '',
        year: e.year,
        duration: e.duration,
        username: e.username || '',
        playerName: e.playerName || '',
        minutesAgo: e.minutesAgo || 0,
        suffix: e.suffix || '',
        bitRate: e.bitRate || 0,
        size: e.size || 0,
        contentType: e.contentType || '',
        // Transcoding info
        playMethod: isTranscoding ? 'Transcode' : 'Direct Play',
        transcodeFormat: transcoding?.targetFormat || null,
        transcodeBitRate: isTranscoding ? (maxBitRate || transcoding?.defaultBitRate || 0) : 0,
        transcodeCodec: transcoding?.name || null,
        playerClient: player?.client || '',
        playerUserAgent: player?.userAgent || '',
        coverArt: e.coverArt ? `/api/widgets/${widget.id}/proxy-image?path=${encodeURIComponent(`rest/getCoverArt?id=${e.coverArt}&size=300&${subAuth}`)}` : null,
      };
    });
  } catch (e) {
    results.playing = 0;
    results.nowPlaying = [];
  }

  return results;
}

// Decypharr proxy handler (Bearer token auth, /debug/stats endpoint)
async function handleDecypharrProxy(widget) {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or token');
  const baseUrl = url.replace(/\/$/, '');
  const headers = { 'Authorization': `Bearer ${token}` };

  const [statsRes, torrentsRes] = await Promise.all([
    axios.get(`${baseUrl}/debug/stats`, { headers, timeout: 10000 }).catch(() => ({ data: {} })),
    axios.get(`${baseUrl}/api/torrents`, { headers, params: { limit: 5, state: 'downloading' }, timeout: 10000 }).catch(() => ({ data: [] })),
  ]);

  const snap = statsRes.data || {};
  const torrentsData = torrentsRes.data?.torrents || (Array.isArray(torrentsRes.data) ? torrentsRes.data : []);
  const queueItems = torrentsData.slice(0, 5).map(t => ({
    name: t.name || t.original_filename || 'Unknown',
    category: t.category || '',
    progress: Math.round((t.progress || 0) * 100),
    status: t.status || t.state || '',
    size: t.size || 0,
  }));

  // Debrid accounts summary with individual sub-accounts
  const debrids = Array.isArray(snap.debrids) ? snap.debrids : [];
  const accounts = [];
  for (const d of debrids) {
    const subAccounts = Array.isArray(d.accounts) ? d.accounts : [];
    // Each sub-account becomes its own entry for carousel display
    for (const sub of subAccounts) {
      let daysLeft = null;
      if (sub.expiration) {
        const exp = new Date(sub.expiration);
        daysLeft = Math.max(0, Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24)));
      }
      accounts.push({
        debrid: d.profile?.name || sub.debrid || 'Unknown',
        username: sub.username || '',
        daysLeft,
        inUse: sub.in_use || false,
        disabled: sub.disabled || false,
        linksCount: sub.links_count || 0,
        trafficUsed: sub.traffic_used || 0,
        order: sub.order ?? 0,
      });
    }
    // If no sub-accounts, use profile-level info
    if (subAccounts.length === 0 && d.profile) {
      let daysLeft = null;
      if (d.profile.expiration) {
        const exp = new Date(d.profile.expiration);
        daysLeft = Math.max(0, Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24)));
      }
      accounts.push({
        debrid: d.profile.name || 'Unknown',
        username: d.profile.username || '',
        daysLeft,
        inUse: true,
        disabled: false,
        linksCount: d.library?.active_links || 0,
        order: 0,
      });
    }
  }
  // Overall library stats (aggregate)
  const totalLinks = debrids.reduce((sum, d) => sum + (d.library?.active_links || 0), 0);
  const totalTorrents = debrids.reduce((sum, d) => sum + (d.library?.total || 0), 0);
  const badTorrents = debrids.reduce((sum, d) => sum + (d.library?.bad || 0), 0);

  // Format uptime nicely
  const uptimeSec = snap.system?.uptime_seconds || 0;
  const hours = Math.floor(uptimeSec / 3600);
  const mins = Math.floor((uptimeSec % 3600) / 60);
  const formattedUptime = hours > 24
    ? `${Math.floor(hours / 24)}d ${hours % 24}h`
    : `${hours}h ${mins}m`;

  return {
    accounts,
    totalLinks,
    totalTorrents,
    badTorrents,
    streams: snap.active_streams?.count || 0,
    streamDetails: (snap.active_streams?.streams || []).slice(0, 5).map(s => ({
      fileName: s.file_name || s.entry_name,
      source: s.source,
      client: s.client,
    })),
    queue: snap.queue?.pending || 0,
    queueItems,
    repair: snap.repair || {},
    uptime: formattedUptime,
    mount: snap.mount?.ready ? 'Ready' : 'Not Ready',
    memory: snap.system?.memory_used || '',
    arrs: snap.arrs?.names || [],
  };
}

// Tautulli proxy handler (non-standard API: cmd= parameter, response.data wrapping)
async function handleTautulliProxy(widget) {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or API key');
  const baseUrl = url.replace(/\/$/, '');

  const [activityRes, librariesRes] = await Promise.all([
    axios.get(`${baseUrl}/api/v2`, {
      params: { apikey: token, cmd: 'get_activity' },
      timeout: 15000,
    }).catch(() => ({ data: {} })),
    axios.get(`${baseUrl}/api/v2`, {
      params: { apikey: token, cmd: 'get_libraries_table' },
      timeout: 15000,
    }).catch(() => ({ data: {} })),
  ]);

  const activity = activityRes.data?.response?.data || {};
  const libData = librariesRes.data?.response?.data || {};
  const libraries = libData.data || libData || [];

  // Tautulli bandwidth is in kbps - convert to readable strings
  const fmtBw = (kbps) => {
    const val = Number(kbps) || 0;
    if (val === 0) return '0';
    if (val >= 1000) return `${(val / 1000).toFixed(1)} Mbps`;
    return `${val} Kbps`;
  };

  // Sum up library item counts from get_libraries_table
  let movies = 0, shows = 0, episodes = 0, music = 0;
  if (Array.isArray(libraries)) {
    libraries.forEach(lib => {
      const count = Number(lib.count) || 0;
      const childCount = Number(lib.child_count) || 0;
      if (lib.section_type === 'movie') movies += count;
      else if (lib.section_type === 'show') { shows += count; episodes += childCount; }
      else if (lib.section_type === 'artist') music += count;
    });
  }

  return {
    streams: Number(activity.stream_count) || 0,
    bandwidth: fmtBw(activity.total_bandwidth),
    movies,
    shows,
    episodes,
    music: music || undefined,
  };
}

// qBittorrent proxy handler (session-based auth)
const qbitSessionCache = new Map();
const QBIT_SESSION_TTL = 30 * 60 * 1000; // 30 minutes

async function getQbitSession(baseUrl, username, password, widgetId) {
  const cacheKey = `qbit-${widgetId}`;
  const cached = qbitSessionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QBIT_SESSION_TTL) {
    return cached.cookie;
  }

  try {
    const loginResp = await axios.post(`${baseUrl}/api/v2/auth/login`,
      `username=${encodeURIComponent(username || 'admin')}&password=${encodeURIComponent(password || '')}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
    );
    const setCookie = loginResp.headers['set-cookie'];
    const sid = setCookie?.find(c => c.startsWith('SID='))?.split(';')[0] || '';
    if (sid) {
      qbitSessionCache.set(cacheKey, { cookie: sid, timestamp: Date.now() });
      return sid;
    }
  } catch (err) {
    console.error('qBittorrent login failed:', err.message);
    qbitSessionCache.delete(cacheKey);
  }
  return null;
}

async function handleQbittorrentProxy(widget) {
  const { url, username, password } = widget;
  if (!url) throw new Error('Missing URL');
  const baseUrl = url.replace(/\/$/, '');

  const cookie = await getQbitSession(baseUrl, username, password, widget.id);
  const headers = cookie ? { Cookie: cookie } : {};

  const [transferRes, torrentsRes] = await Promise.all([
    axios.get(`${baseUrl}/api/v2/transfer/info`, { headers, timeout: 10000 }).catch(() => ({ data: {} })),
    axios.get(`${baseUrl}/api/v2/torrents/info`, { headers, timeout: 10000 }).catch(() => ({ data: [] })),
  ]);

  const transfer = transferRes.data || {};
  const torrents = Array.isArray(torrentsRes.data) ? torrentsRes.data : [];

  const downloading = torrents.filter(t => t.state?.includes('downloading') || t.state === 'downloading').length;
  const seeding = torrents.filter(t => t.state?.includes('uploading') || t.state === 'seeding' || t.state === 'stalledUP').length;
  const paused = torrents.filter(t => t.state?.includes('paused') || t.state === 'pausedDL' || t.state === 'pausedUP').length;

  return {
    dlSpeed: transfer.dl_info_speed || 0,
    upSpeed: transfer.up_info_speed || 0,
    totalDownloaded: transfer.dl_info_data || 0,
    totalUploaded: transfer.up_info_data || 0,
    torrents: torrents.length,
    downloading,
    seeding,
    paused,
  };
}

// Transmission proxy handler (JSON-RPC with session ID)
const transmissionSessionCache = new Map();

async function getTransmissionSessionId(baseUrl, username, password, widgetId) {
  const cacheKey = `transmission-${widgetId}`;
  const cached = transmissionSessionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return cached.sessionId;
  }

  const headers = {};
  if (username && password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  try {
    // Transmission returns 409 with X-Transmission-Session-Id header
    await axios.post(`${baseUrl}/rpc`, {}, { headers, timeout: 10000, validateStatus: () => true });
  } catch (err) {
    const sessionId = err.response?.headers?.['x-transmission-session-id'];
    if (sessionId) {
      transmissionSessionCache.set(cacheKey, { sessionId, timestamp: Date.now() });
      return sessionId;
    }
  }

  // Try from the successful response or 409
  return null;
}

async function handleTransmissionProxy(widget) {
  const { url, username, password } = widget;
  if (!url) throw new Error('Missing URL');
  const baseUrl = url.replace(/\/$/, '');
  const rpcUrl = `${baseUrl}/transmission/rpc`;

  const headers = { 'Content-Type': 'application/json' };
  if (username && password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  // Get session ID by making a request (Transmission returns 409 with the session header)
  let sessionId;
  try {
    const probe = await axios.post(rpcUrl, JSON.stringify({ method: 'session-get' }), {
      headers, timeout: 10000, validateStatus: () => true,
    });
    sessionId = probe.headers['x-transmission-session-id'];
    if (probe.status === 200 && probe.data?.result === 'success') {
      // Got it on first try
      const sessionData = probe.data.arguments || {};
      headers['X-Transmission-Session-Id'] = sessionId || '';
      // Fetch torrents
      const torrentResp = await axios.post(rpcUrl,
        JSON.stringify({ method: 'torrent-get', arguments: { fields: ['id', 'name', 'status', 'rateDownload', 'rateUpload', 'percentDone', 'totalSize'] } }),
        { headers, timeout: 10000, validateStatus: () => true }
      );
      const torrents = torrentResp.data?.arguments?.torrents || [];
      return buildTransmissionResponse(sessionData, torrents);
    }
  } catch (err) {
    sessionId = err.response?.headers?.['x-transmission-session-id'];
  }

  if (!sessionId) throw new Error('Could not get Transmission session ID');
  headers['X-Transmission-Session-Id'] = sessionId;

  // Fetch session stats and torrent list in parallel
  const [sessionResp, torrentResp] = await Promise.all([
    axios.post(rpcUrl, JSON.stringify({ method: 'session-stats' }), { headers, timeout: 10000 }).catch(() => ({ data: {} })),
    axios.post(rpcUrl,
      JSON.stringify({ method: 'torrent-get', arguments: { fields: ['id', 'name', 'status', 'rateDownload', 'rateUpload', 'percentDone', 'totalSize'] } }),
      { headers, timeout: 10000 }
    ).catch(() => ({ data: {} })),
  ]);

  const stats = sessionResp.data?.arguments || {};
  const torrents = torrentResp.data?.arguments?.torrents || [];
  return buildTransmissionResponse(stats, torrents);
}

function buildTransmissionResponse(stats, torrents) {
  const downloading = torrents.filter(t => t.status === 4).length;
  const seeding = torrents.filter(t => t.status === 6).length;
  const paused = torrents.filter(t => t.status === 0).length;
  const dlSpeed = torrents.reduce((sum, t) => sum + (t.rateDownload || 0), 0);
  const upSpeed = torrents.reduce((sum, t) => sum + (t.rateUpload || 0), 0);

  return {
    torrents: torrents.length,
    downloading,
    seeding,
    paused,
    dlSpeed,
    upSpeed,
    downloadedTotal: stats.cumulative_stats?.downloadedBytes || stats['current-stats']?.downloadedBytes || 0,
    uploadedTotal: stats.cumulative_stats?.uploadedBytes || stats['current-stats']?.uploadedBytes || 0,
  };
}

// Deluge proxy handler (JSON-RPC with session cookie)
const delugeSessionCache = new Map();
const DELUGE_SESSION_TTL = 30 * 60 * 1000;

async function handleDelugeProxy(widget) {
  const { url, password } = widget;
  if (!url) throw new Error('Missing URL');
  const baseUrl = url.replace(/\/$/, '');
  const rpcUrl = `${baseUrl}/json`;

  // Login to get session cookie
  let cookie = delugeSessionCache.get(widget.id)?.cookie;
  if (!cookie || Date.now() - (delugeSessionCache.get(widget.id)?.timestamp || 0) > DELUGE_SESSION_TTL) {
    try {
      const loginResp = await axios.post(rpcUrl,
        JSON.stringify({ method: 'auth.login', params: [password || ''], id: 1 }),
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      const setCookie = loginResp.headers['set-cookie'];
      cookie = setCookie?.find(c => c.startsWith('_session_id='))?.split(';')[0] || '';
      if (cookie) {
        delugeSessionCache.set(widget.id, { cookie, timestamp: Date.now() });
      }
    } catch (err) {
      console.error('Deluge login failed:', err.message);
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;

  // Fetch torrent status
  try {
    const resp = await axios.post(rpcUrl,
      JSON.stringify({
        method: 'web.update_ui',
        params: [['name', 'state', 'progress', 'download_payload_rate', 'upload_payload_rate', 'total_size'], {}],
        id: 2,
      }),
      { headers, timeout: 10000 }
    );

    const result = resp.data?.result || {};
    const torrents = result.torrents ? Object.values(result.torrents) : [];
    const stats = result.stats || {};

    const downloading = torrents.filter(t => t.state === 'Downloading').length;
    const seeding = torrents.filter(t => t.state === 'Seeding').length;
    const paused = torrents.filter(t => t.state === 'Paused').length;

    return {
      torrents: torrents.length,
      downloading,
      seeding,
      paused,
      dlSpeed: stats.download_rate || torrents.reduce((sum, t) => sum + (t.download_payload_rate || 0), 0),
      upSpeed: stats.upload_rate || torrents.reduce((sum, t) => sum + (t.upload_payload_rate || 0), 0),
      freeSpace: stats.free_space || 0,
    };
  } catch (err) {
    console.error('Error fetching Deluge data:', err.message);
    throw err;
  }
}

// NZBGet proxy handler (basic auth + JSON-RPC)
async function handleNzbgetProxy(widget) {
  const { url, username, password } = widget;
  if (!url) throw new Error('Missing URL');
  const baseUrl = url.replace(/\/$/, '');

  const headers = { 'Content-Type': 'application/json' };
  if (username && password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  const rpcUrl = `${baseUrl}/jsonrpc`;

  const [statusResp, historyResp] = await Promise.all([
    axios.post(rpcUrl, JSON.stringify({ method: 'status' }), { headers, timeout: 10000 }).catch(() => ({ data: {} })),
    axios.post(rpcUrl, JSON.stringify({ method: 'history', params: [false] }), { headers, timeout: 10000 }).catch(() => ({ data: {} })),
  ]);

  const status = statusResp.data?.result || {};
  const history = historyResp.data?.result || [];

  return {
    speed: status.DownloadRate || 0,
    remainingSize: (status.RemainingSizeMB || 0) * 1024 * 1024,
    downloadedSize: (status.DownloadedSizeMB || 0) * 1024 * 1024,
    queueCount: status.PostJobCount || 0,
    articleCache: (status.ArticleCacheMB || 0) * 1024 * 1024,
    freeDisk: (status.FreeDiskSpaceMB || 0) * 1024 * 1024,
    totalHistory: Array.isArray(history) ? history.length : 0,
    paused: status.DownloadPaused || false,
  };
}

// NZBDav proxy handler (SABnzbd-compatible API)
async function handleNzbdavProxy(widget) {
  const { url, token } = widget;
  if (!url || !token) throw new Error('Missing URL or API key');
  const baseUrl = url.replace(/\/$/, '');
  const params = { apikey: token, output: 'json' };

  const [queueRes, historyRes, healthRes] = await Promise.all([
    axios.get(`${baseUrl}/api`, { params: { ...params, mode: 'queue', limit: 10 }, timeout: 10000 }).catch(() => ({ data: {} })),
    axios.get(`${baseUrl}/api`, { params: { ...params, mode: 'history', limit: 5 }, timeout: 10000 }).catch(() => ({ data: {} })),
    axios.get(`${baseUrl}/api/get-health-check-queue`, { headers: { 'X-API-Key': token }, timeout: 10000 }).catch(() => ({ data: {} })),
  ]);

  const queue = queueRes.data?.Queue || {};
  const history = historyRes.data?.History || {};
  const health = healthRes.data || {};

  const slots = queue.Slots || [];
  const historySlots = history.Slots || [];

  return {
    queueCount: queue.NoOfSlots || 0,
    queueItems: slots.slice(0, 5).map(s => ({
      id: s.NzoId,
      name: s.Filename,
      category: s.Category,
      progress: parseFloat(s.Percentage) || 0,
      status: s.Status,
      timeLeft: s.TimeLeft,
      size: s.MB,
      sizeLeft: s.MBLeft,
    })),
    historyCount: history.NoOfSlots || 0,
    recentHistory: historySlots.slice(0, 3).map(s => ({
      name: s.Name || s.NzbName,
      category: s.Category,
      status: s.Status,
      size: s.Bytes,
    })),
    healthUnchecked: health.UncheckedCount || 0,
    healthItems: (health.Items || []).length,
  };
}

// Proxy handler registry - specialized handlers for complex widgets
export const actionHandlers = {
  sonarr: handleSonarrAction,
  radarr: handleRadarrAction,
  overseerr: handleOverseerrAction,
  jellyseerr: handleJellyseerrAction,
  seerr: handleJellyseerrAction,
};

export function getActionHandler(appName) {
  return actionHandlers[appName?.toLowerCase()] || null;
}

export const proxyHandlers = {
  plex: handlePlexProxy,
  sonarr: handleSonarrProxy,
  radarr: handleRadarrProxy,
  jellyfin: handleJellyfinProxy,
  emby: handleEmbyProxy,
  navidrome: handleNavidromeProxy,
  lidarr: handleLidarrProxy,
  overseerr: handleOverseerrProxy,
  jellyseerr: handleJellyseerrProxy,
  seerr: handleJellyseerrProxy,
  sabnzbd: handleSabnzbdProxy,
  decypharr: handleDecypharrProxy,
  tautulli: handleTautulliProxy,
  qbittorrent: handleQbittorrentProxy,
  transmission: handleTransmissionProxy,
  deluge: handleDelugeProxy,
  nzbget: handleNzbgetProxy,
  nzbdav: handleNzbdavProxy,
};

// Navidrome image proxy (Subsonic getCoverArt)
async function handleNavidromeImage(widget, imagePath) {
  const baseUrl = widget.url.replace(/\/$/, '');
  const imageUrl = `${baseUrl}/${imagePath}`;
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 10000,
  });
  return {
    data: response.data,
    contentType: response.headers['content-type'] || 'image/jpeg',
  };
}

// Image proxy handlers
export const imageProxyHandlers = {
  plex: handlePlexImage,
  jellyfin: handleJellyfinImage,
  emby: handleEmbyImage,
  navidrome: handleNavidromeImage,
};

// Widget configs cache (loaded per widget)
const widgetConfigCache = new Map();

// Load a single widget config from its widget.js file using dynamic import
async function loadWidgetConfig(widgetType) {
  if (widgetConfigCache.has(widgetType)) {
    return widgetConfigCache.get(widgetType);
  }

  try {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const fsSync = await import('fs');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const widgetPath = path.join(__dirname, '..', 'src', 'components', 'widgets', widgetType, 'widget.js');

    // Check if the file exists first
    if (!fsSync.existsSync(widgetPath)) {
      console.warn(`Widget config file not found: ${widgetPath}`);
      widgetConfigCache.set(widgetType, null);
      return null;
    }

    // Use dynamic import to load the ES module properly (handles arrow functions, etc.)
    const widgetUrl = 'file://' + widgetPath.replace(/\\/g, '/');
    const module = await import(widgetUrl);
    const config = module.default || module;

    if (config && typeof config === 'object' && (config.api || config.apiv5 || config.apiv6 || config.mappings)) {
      widgetConfigCache.set(widgetType, config);
      return config;
    }

    console.warn(`Widget config for ${widgetType} has no api/mappings definition`);
    widgetConfigCache.set(widgetType, null);
    return null;
  } catch (err) {
    console.error(`Failed to load widget config for ${widgetType}:`, err.message);
    widgetConfigCache.set(widgetType, null);
    return null;
  }
}

// Auto-unwrap common API response wrapper patterns
function unwrapApiResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

  // Pattern: { response: { data: {...} } } (Tautulli, etc.)
  if (data.response?.data !== undefined && Object.keys(data).length <= 2) {
    return data.response.data;
  }

  // Pattern: { result: "success", data: {...} } or { status: "ok", data: {...} }
  if (data.data !== undefined && (data.result || data.status || data.success !== undefined) && Object.keys(data).length <= 3) {
    return data.data;
  }

  // Pattern: { result: {...} } where result is the actual payload (Deluge-style JSON-RPC)
  if (data.result !== undefined && data.id !== undefined && Object.keys(data).length <= 3) {
    return data.result;
  }

  return data;
}

// Generic proxy handler that uses widget.js config
export async function handleGenericProxy(widget, widgetType, requestedEndpoint) {
  try {
    const { url, token, username, password, env } = widget;
    if (!url) throw new Error('Missing URL');

    const baseUrl = url.replace(/\/$/, '');
    const config = await loadWidgetConfig(widgetType);

    if (!config) {
      throw new Error(`No widget config found for: ${widgetType}`);
    }

    // Get API template - prefer 'api', fall back to other variants
    let apiTemplate = config.api || config.apiv5 || config.apiv6;
    if (!apiTemplate) {
      throw new Error(`No API template for widget: ${widgetType}`);
    }

    // Determine which endpoints to fetch
    const mappings = config.mappings || {};
    const endpointsToFetch = requestedEndpoint && mappings[requestedEndpoint]
      ? { [requestedEndpoint]: mappings[requestedEndpoint] }
      : mappings;

    // If no mappings, try a default endpoint
    if (Object.keys(endpointsToFetch).length === 0) {
      // Try common default endpoints
      const defaultEndpoints = ['stats', 'status', 'info', 'count'];
      for (const ep of defaultEndpoints) {
        endpointsToFetch[ep] = { endpoint: ep };
      }
    }

    // Build headers based on common auth patterns
    const headers = { 'Accept': 'application/json' };

    // Apply widget-level headers from config (e.g. X-Emby-Token, Authorization)
    if (config.headers && typeof config.headers === 'object') {
      for (const [key, val] of Object.entries(config.headers)) {
        // Substitute {key} placeholder in header values
        headers[key] = typeof val === 'string' ? val.replace('{key}', token || '') : val;
      }
    }

    // X-Api-Key header (most common for *arr apps)
    if (token && !apiTemplate.includes('{key}') && !config.headers) {
      headers['X-Api-Key'] = token;
    }

    // Bearer token auth
    if (token && config.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Basic auth
    if (username && password) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    }

    // Fetch all endpoints and combine results
    const results = {};
    const fetchPromises = Object.entries(endpointsToFetch).map(async ([name, mapping]) => {
      try {
        const endpoint = mapping.endpoint || name;

        // Build URL from template
        let fetchUrl = apiTemplate
          .replace('{url}', baseUrl)
          .replace('{endpoint}', endpoint)
          .replace('{key}', token || '')
          .replace('{env}', env || '1');

        // Handle params if specified
        if (mapping.params && Array.isArray(mapping.params)) {
          const params = new URLSearchParams();
          mapping.params.forEach(p => {
            if (typeof p === 'string') params.append(p, 'true');
            else if (typeof p === 'object') Object.entries(p).forEach(([k, v]) => params.append(k, v));
          });
          fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + params.toString();
        }

        const response = await axios.get(fetchUrl, {
          headers,
          timeout: 15000,
          validateStatus: (status) => status < 500 // Accept 4xx to return error info
        });

        if (response.status >= 400) {
          console.warn(`${widgetType}/${endpoint} returned ${response.status}`);
          return;
        }

        // Apply map transform if defined in widget config
        let resultData = response.data;
        if (typeof mapping.map === 'function') {
          try {
            resultData = mapping.map(resultData);
          } catch (mapErr) {
            console.warn(`Map transform failed for ${widgetType}/${name}:`, mapErr.message);
            // Fall through with raw data
          }
        }

        // Auto-unwrap common API response wrappers
        resultData = unwrapApiResponse(resultData);

        // Store the result
        if (typeof resultData === 'object' && resultData !== null && !Array.isArray(resultData)) {
          // Flatten single-endpoint responses
          if (Object.keys(endpointsToFetch).length === 1) {
            Object.assign(results, resultData);
          } else {
            // For multi-endpoint, merge flat values directly, nest complex objects
            const flatKeys = Object.entries(resultData).filter(([, v]) => typeof v !== 'object' || v === null);
            if (flatKeys.length > 0 && flatKeys.length === Object.keys(resultData).length) {
              // All values are flat primitives - merge directly to avoid nesting
              Object.assign(results, resultData);
            } else {
              results[name] = resultData;
            }
          }
        } else if (Array.isArray(resultData)) {
          // Store array length as a count with the endpoint name
          results[name] = resultData.length;
        } else {
          results[name] = resultData;
        }
      } catch (err) {
        console.error(`Error fetching ${widgetType}/${name}:`, err.message);
      }
    });

    await Promise.all(fetchPromises);
    return results;
  } catch (error) {
    console.error(`Error in generic proxy handler for ${widgetType}:`, error);
    throw error;
  }
}

// Get proxy handler for an app
export function getProxyHandler(appName) {
  const lowerName = appName?.toLowerCase() || '';

  // Return specialized handler if available
  if (proxyHandlers[lowerName]) {
    return proxyHandlers[lowerName];
  }

  // Return a wrapper around the generic handler
  return (widget, endpoint) => handleGenericProxy(widget, lowerName, endpoint);
}

// Get image proxy handler for an app
export function getImageProxyHandler(appName) {
  const lowerName = appName?.toLowerCase() || '';
  return imageProxyHandlers[lowerName] || null;
}
