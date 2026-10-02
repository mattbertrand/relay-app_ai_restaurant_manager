import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Imports the restaurant's menu into editable menu items, from either:
//  - source 'file'    — an uploaded menu (PDF, photo, CSV, XLSX, JSON), or
//  - source 'website' — the restaurant's own website, fetched server-side.
// Re-importing a source replaces its unedited items; manual items and items
// the manager has edited are always preserved.

const MENU_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string', description: 'Menu section, e.g. Starters, Mains, Desserts, Cocktails' },
          name: { type: 'string' },
          description: { type: 'string', description: 'Short description as printed on the menu' },
          price: { type: 'string', description: 'Price exactly as printed, e.g. "18" or "MP" or "14-22". Empty string when no price is shown — never write "not listed" or similar.' },
          dietary: { type: 'string', description: 'Comma-separated dietary notes, e.g. "vegetarian, gluten-free"' },
        },
        required: ['name'],
      },
    },
  },
  required: ['items'],
};

const MAX_ITEMS = 200;

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeItems(rawItems) {
  const normalized = [];
  if (!Array.isArray(rawItems)) return normalized;
  for (const it of rawItems) {
    if (!it || !it.name || !String(it.name).trim()) continue;
    if (normalized.length >= MAX_ITEMS) break;
    normalized.push({
      section: it.section && String(it.section).trim() ? String(it.section).trim() : 'Menu',
      name: String(it.name).trim(),
      description: it.description ? String(it.description).trim() : '',
      price: it.price !== undefined && it.price !== null && String(it.price).trim() !== '' ? String(it.price).trim() : '',
      dietary: it.dietary ? String(it.dietary).trim() : '',
    });
  }
  return normalized;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const restaurantId = String(payload.restaurant_id || '').trim();
    if (!restaurantId) return Response.json({ error: 'Missing restaurant.' }, { status: 400 });

    const source = payload.source === 'website' ? 'website' : 'file';
    let rawItems = [];

    if (source === 'file') {
      const fileUrl = String(payload.file_url || '').trim();
      if (!fileUrl) return Response.json({ error: 'Upload a menu file first.' }, { status: 400 });
      const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: MENU_SCHEMA,
      });
      if (!extraction || extraction.status !== 'success' || !extraction.output) {
        return Response.json({
          error: "We couldn't read a menu from that file. A clear PDF or photo of the menu works best.",
        });
      }
      rawItems = Array.isArray(extraction.output)
        ? extraction.output
        : Array.isArray(extraction.output.items)
          ? extraction.output.items
          : [];
    } else {
      const url = String(payload.url || '').trim();
      if (!/^https?:\/\//i.test(url)) {
        return Response.json({ error: 'Enter a valid website address starting with http:// or https://.' }, { status: 400 });
      }
      let pageRes;
      try {
        pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RelayMenuImport)' } });
      } catch (e) {
        return Response.json({ error: "We couldn't reach that website. Check the address and try again." });
      }
      if (!pageRes.ok) {
        return Response.json({ error: `That website returned an error (${pageRes.status}). Check the address and try again.` });
      }
      let html = await pageRes.text();
      if (html.length > 400000) html = html.slice(0, 400000);
      const text = stripHtml(html);
      if (!text || text.length < 50) {
        return Response.json({ error: "We couldn't read any content from that page. If the menu is a file or image on the site, upload it directly instead." });
      }
      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt:
          "The following is text from a restaurant's website. Extract every menu item you can find on it, keeping the printed section, name, description, price and dietary notes. Include drinks if a drink list is present. Do not invent items that are not on the page, and leave price empty when it is not printed. If the page contains no menu at all, return an empty items list.\n\nWEBSITE TEXT:\n" +
          text.slice(0, 60000),
        response_json_schema: MENU_SCHEMA,
      });
      rawItems = (llm && Array.isArray(llm.items)) ? llm.items : [];
    }

    const items = normalizeItems(rawItems);
    if (!items.length) {
      return Response.json({ error: 'No menu items could be identified from that source. Try uploading the menu file directly.' });
    }

    // Replace this source's unedited items; keep manual items and anything
    // the manager has edited so small menu changes never force a re-import.
    const existing = await base44.entities.MenuItem.filter({ restaurant_id: restaurantId, origin: source });
    const keptEdited = Array.isArray(existing) ? existing.filter((i) => i.edited) : [];
    await base44.entities.MenuItem.deleteMany({ restaurant_id: restaurantId, origin: source, edited: { $ne: true } });

    const records = items.map((it, i) => ({
      restaurant_id: restaurantId,
      section: it.section,
      name: it.name,
      description: it.description,
      price: it.price,
      dietary: it.dietary,
      origin: source,
      edited: false,
      position: i + 1,
    }));
    // Edited items keep their place at the end of the order.
    const kept = keptEdited.map((it, i) => ({ ...it, position: (records.length || 0) + i + 1 }));
    if (kept.length) {
      await base44.entities.MenuItem.bulkUpdate(
        kept.map((it) => ({ id: it.id, position: it.position }))
      );
    }
    await base44.entities.MenuItem.bulkCreate(records);

    // Record where the menu came from on the Restaurant Profile, when it exists.
    try {
      const kRecords = await base44.entities.RestaurantKnowledge.filter({ restaurant_id: restaurantId }, null, 5);
      if (kRecords[0]) {
        const menu = { ...(kRecords[0].menu || {}) };
        if (source === 'file') {
          menu.menu_file_name = String(payload.file_name || 'Uploaded menu');
          menu.menu_file_uri = String(payload.file_uri || '');
        } else {
          menu.menu_source_url = String(payload.url || '').trim();
        }
        menu.menu_last_imported_at = new Date().toISOString();
        await base44.entities.RestaurantKnowledge.update(kRecords[0].id, { menu });
      }
    } catch (e) {
      // Metadata only — the import itself already succeeded.
    }

    return Response.json({ imported: records.length, replaced: Math.max(0, (Array.isArray(existing) ? existing.filter((i) => !i.edited) : []).length), source });
  } catch (error) {
    return Response.json({ error: error.message || 'Menu import failed.' }, { status: 500 });
  }
}