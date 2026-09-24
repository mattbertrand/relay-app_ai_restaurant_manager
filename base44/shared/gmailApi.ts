// Shared Gmail API helpers for Relay's Gmail integration (app-user connector).

export const GMAIL_CONNECTOR_ID = "6ab4c39dd81d1c8bc44d5db3";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function getGmailProfile(accessToken) {
  const res = await fetch(`${GMAIL_API}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail request failed (${res.status})`);
  }
  const profile = await res.json();
  return profile.emailAddress || null;
}

export async function listInboxMessages(accessToken, maxResults = 25) {
  const query = "in:inbox newer_than:30d -category:promotions -category:social -category:forums";
  const url = `${GMAIL_API}/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Gmail request failed (${res.status})`);
  }
  const data = await res.json();
  return { messages: data.messages || [] };
}

export async function fetchMessage(accessToken, messageId) {
  const res = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail request failed (${res.status})`);
  }
  return res.json();
}

export function getHeader(message, name) {
  const headers = (message.payload && message.payload.headers) || [];
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : "";
}

export function parseFromAddress(fromValue) {
  const value = fromValue || "";
  const match = value.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, "").trim();
    const email = match[2].trim();
    return { name: name || email, email };
  }
  return { name: value.trim() || "Unknown sender", email: value.trim() };
}

function decodeBase64Url(data) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export function extractTextBody(payload) {
  const candidates = [];
  const walk = (part) => {
    if (!part) return;
    if (part.body && part.body.data) {
      candidates.push({ mimeType: part.mimeType || "", data: part.body.data });
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  const plain = candidates.find((c) => c.mimeType === "text/plain");
  const chosen = plain || candidates[0];
  return chosen ? decodeBase64Url(chosen.data) : "";
}