import { put, head } from '@vercel/blob';

const STORAGE_BLOB_PATH = 'sent-events.json';

// In-memory fallback in case Blob is unavailable
let memorySentEvents = new Map();

/**
 * Generate a unique ID for an economic calendar event
 */
export function getEventId(event) {
  const country = (event.country || '').trim().toUpperCase();
  const title = (event.title || '').trim();
  const date = (event.date || '').trim();
  return `${country}__${title}__${date}`;
}

/**
 * Retrieve the set of event IDs that were already alerted
 */
export async function getSentEventIds() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (!token) {
    // Fallback to in-memory
    const sent = new Set();
    for (const [id, time] of memorySentEvents.entries()) {
      if (now - time < ONE_DAY_MS) {
        sent.add(id);
      } else {
        memorySentEvents.delete(id);
      }
    }
    return sent;
  }

  try {
    // Try to get existing blob details
    const blobDetails = await head(STORAGE_BLOB_PATH, { token }).catch(() => null);
    if (!blobDetails || !blobDetails.url) {
      return new Set();
    }

    // Fetch the JSON with cache-busting
    const res = await fetch(`${blobDetails.url}?t=${now}`);
    if (!res.ok) {
      return new Set();
    }

    const data = await res.json();
    const sent = new Set();
    if (data && typeof data === 'object') {
      for (const [id, time] of Object.entries(data)) {
        if (now - time < ONE_DAY_MS) {
          sent.add(id);
        }
      }
    }
    return sent;
  } catch (error) {
    console.warn('Warning: Failed to fetch sent-events blob, falling back to empty set:', error.message);
    return new Set();
  }
}

/**
 * Mark a list of events as sent in persistent storage
 */
export async function markEventsAsSent(events) {
  if (!events || events.length === 0) return;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // 1. In-memory update
  for (const ev of events) {
    const id = getEventId(ev);
    memorySentEvents.set(id, now);
  }

  if (!token) return;

  try {
    // Load current map
    let currentData = {};
    const blobDetails = await head(STORAGE_BLOB_PATH, { token }).catch(() => null);
    if (blobDetails && blobDetails.url) {
      const res = await fetch(`${blobDetails.url}?t=${now}`).catch(() => null);
      if (res && res.ok) {
        currentData = (await res.json().catch(() => ({}))) || {};
      }
    }

    // Add new events & prune entries older than 24h
    const updatedData = {};
    for (const [id, time] of Object.entries(currentData)) {
      if (now - time < ONE_DAY_MS) {
        updatedData[id] = time;
      }
    }

    for (const ev of events) {
      const id = getEventId(ev);
      updatedData[id] = now;
    }

    await put(STORAGE_BLOB_PATH, JSON.stringify(updatedData), {
      token,
      access: 'public',
      addRandomSuffix: false
    });
  } catch (error) {
    console.error('Error saving sent events to Vercel Blob:', error);
  }
}
