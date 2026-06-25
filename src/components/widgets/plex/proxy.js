// Plex proxy handler - processes API data and returns formatted response
export default async function plexProxyHandler(widget, endpoint = "unified") {
  try {
    const { url, token } = widget;

    // Fetch streams (active sessions) with full details
    const streamsResponse = await fetch(
      `${url}/status/sessions?X-Plex-Token=${token}`,
      {
        headers: {
          Accept: "application/json",
          "X-Plex-Container-Start": "0",
          "X-Plex-Container-Size": "500",
        },
      }
    );

    let streams = 0;
    let streamDetails = [];

    if (streamsResponse.ok) {
      const contentType = streamsResponse.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        // JSON response
        const data = await streamsResponse.json();
        const mediaContainer = data.MediaContainer || {};
        streams = mediaContainer.size || 0;

        if (mediaContainer.Metadata) {
          streamDetails = mediaContainer.Metadata.map(parseStreamMetadata);
        }
      } else {
        // XML response fallback
        const streamsText = await streamsResponse.text();
        const sizeMatch = streamsText.match(/size="(\d+)"/);
        if (sizeMatch) {
          streams = parseInt(sizeMatch[1], 10);
        }

        // Parse XML sessions
        const videoMatches = streamsText.matchAll(/<Video[^>]*>([\s\S]*?)<\/Video>/g);
        for (const match of videoMatches) {
          const videoXml = match[0];
          streamDetails.push(parseXmlStream(videoXml));
        }

        const trackMatches = streamsText.matchAll(/<Track[^>]*>([\s\S]*?)<\/Track>/g);
        for (const match of trackMatches) {
          const trackXml = match[0];
          streamDetails.push(parseXmlStream(trackXml, 'track'));
        }
      }
    }

    // Fetch libraries
    const librariesResponse = await fetch(
      `${url}/library/sections?X-Plex-Token=${token}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    let libraries = [];
    if (librariesResponse.ok) {
      const contentType = librariesResponse.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const data = await librariesResponse.json();
        const directories = data.MediaContainer?.Directory || [];
        libraries = directories
          .filter(d => ["movie", "show", "artist"].includes(d.type))
          .map(d => ({ type: d.type, key: d.key }));
      } else {
        const librariesText = await librariesResponse.text();
        const libraryMatches = librariesText.matchAll(
          /<Directory[^>]*type="(movie|show|artist)"[^>]*key="(\d+)"[^>]*>/g
        );
        libraries = Array.from(libraryMatches).map((match) => ({
          type: match[1],
          key: match[2],
        }));
      }
    }

    // Fetch counts for each library type
    let albums = 0;
    let movies = 0;
    let tv = 0;

    await Promise.all(
      libraries.map(async (library) => {
        const libraryURL =
          ["movie", "show"].includes(library.type)
            ? `/library/sections/${library.key}/all`
            : `/library/sections/${library.key}/albums`;

        const libraryResponse = await fetch(
          `${url}${libraryURL}?X-Plex-Token=${token}&X-Plex-Container-Size=0`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (libraryResponse.ok) {
          const contentType = libraryResponse.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            const data = await libraryResponse.json();
            const size = data.MediaContainer?.totalSize || data.MediaContainer?.size || 0;
            if (library.type === "movie") movies += size;
            else if (library.type === "show") tv += size;
            else if (library.type === "artist") albums += size;
          } else {
            const libraryText = await libraryResponse.text();
            const sizeMatch = libraryText.match(/(?:totalSize|size)="(\d+)"/);
            if (sizeMatch) {
              const size = parseInt(sizeMatch[1], 10);
              if (library.type === "movie") movies += size;
              else if (library.type === "show") tv += size;
              else if (library.type === "artist") albums += size;
            }
          }
        }
      })
    );

    return {
      streams,
      albums,
      movies,
      tv,
      streamDetails,
    };
  } catch (error) {
    console.error("Error in Plex proxy handler:", error);
    throw error;
  }
}

function parseStreamMetadata(metadata) {
  const user = metadata.User?.title || "Unknown";
  const player = metadata.Player || {};
  const session = metadata.Session || {};
  const media = metadata.Media?.[0] || {};
  const part = media.Part?.[0] || {};
  const stream = part.Stream?.find(s => s.streamType === 1) || {}; // Video stream

  // Determine if transcoding
  const transcodeSession = metadata.TranscodeSession;
  const isTranscoding = !!transcodeSession;

  // Get quality info
  let quality = "";
  if (stream.displayTitle) {
    quality = stream.displayTitle;
  } else if (media.videoResolution) {
    quality = media.videoResolution.toUpperCase();
    if (quality === "1080") quality = "1080p";
    if (quality === "720") quality = "720p";
    if (quality === "2160") quality = "4K";
  }

  return {
    user,
    title: metadata.title || "Unknown",
    grandparentTitle: metadata.grandparentTitle || null, // Show name for episodes
    parentTitle: metadata.parentTitle || null, // Season for episodes
    type: metadata.type || "video",
    thumb: metadata.thumb || metadata.parentThumb || metadata.grandparentThumb || null,
    state: player.state || "playing",
    platform: player.platform || player.product || "Unknown",
    viewOffset: metadata.viewOffset || 0,
    duration: metadata.duration || 0,
    quality,
    transcoding: isTranscoding,
    transcodingProgress: transcodeSession?.progress || null,
  };
}

function parseXmlStream(xml, defaultType = 'video') {
  const getAttr = (name) => {
    const match = xml.match(new RegExp(`${name}="([^"]*)"`, 'i'));
    return match ? match[1] : null;
  };

  // Get user from User element
  const userMatch = xml.match(/<User[^>]*title="([^"]*)"/);
  const user = userMatch ? userMatch[1] : "Unknown";

  // Get player info
  const playerMatch = xml.match(/<Player[^>]*platform="([^"]*)"[^>]*state="([^"]*)"/);
  const platform = playerMatch ? playerMatch[1] : "Unknown";
  const state = playerMatch ? playerMatch[2] : "playing";

  // Get media info
  const mediaMatch = xml.match(/<Media[^>]*videoResolution="([^"]*)"/);
  let quality = mediaMatch ? mediaMatch[1] : "";
  if (quality === "1080") quality = "1080p";
  if (quality === "720") quality = "720p";
  if (quality === "2160") quality = "4K";

  // Check for transcoding
  const isTranscoding = xml.includes("<TranscodeSession");

  return {
    user,
    title: getAttr("title") || "Unknown",
    grandparentTitle: getAttr("grandparentTitle"),
    parentTitle: getAttr("parentTitle"),
    type: getAttr("type") || defaultType,
    thumb: getAttr("thumb") || getAttr("parentThumb") || getAttr("grandparentThumb"),
    state,
    platform,
    viewOffset: parseInt(getAttr("viewOffset") || "0", 10),
    duration: parseInt(getAttr("duration") || "0", 10),
    quality,
    transcoding: isTranscoding,
  };
}
