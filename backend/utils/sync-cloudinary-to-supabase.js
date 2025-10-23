/**
 * sync-cloudinary-to-supabase.js
 *
 * Sync images from a Cloudinary folder (prefix "CSS_image") into Supabase table `images`.
 *
 * Usage:
 *   node sync-cloudinary-to-supabase.js
 *
 * Required env vars (in your .env or environment):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service_role key or a key with insert/upsert rights)
 *
 * Notes:
 *  - Script pages through Cloudinary API (next_cursor).
 *  - Upserts into Supabase images table using public_id as unique key.
 *  - Edit PREFIX variable below if you want to sync a different folder or the whole account (set to '' to fetch all).
 */

require('dotenv').config();
const { cloudinary, supabase } = require('../config/db'); // <-- đổi đường dẫn nếu config của bạn ở chỗ khác

const PREFIX = ''; // folder name you provided (no leading slash). Set to '' to fetch everything.
const RESOURCE_TYPE = 'image';
const TYPE = 'upload';
const MAX_RESULTS_PER_PAGE = 500; // max Cloudinary permits per request

function mapCloudinaryToRow(resource) {
  return {
    image_id: resource.public_id,
    image_url: resource.secure_url || resource.url || null,
    filename: resource.original_filename || resource.public_id,
    width: resource.width || null,
    height: resource.height || null,
    bytes: resource.bytes || null,
    created_at: resource.created_at ? new Date(resource.created_at).toISOString() : null
  };
}

async function fetchResourcesByPrefix(prefix) {
  const all = [];
  let next_cursor = undefined;

  do {
    const params = {
      resource_type: RESOURCE_TYPE,
      type: TYPE,
      max_results: MAX_RESULTS_PER_PAGE,
      next_cursor,
    };
    if (prefix && prefix.length) params.prefix = prefix;

    console.log('Requesting Cloudinary resources with params:', { ...params, next_cursor: next_cursor ? '...' : null });
    const resp = await cloudinary.api.resources(params);
    if (resp.resources && resp.resources.length) {
      all.push(...resp.resources);
      console.log(`Fetched ${all.length} resources so far`);
    }
    next_cursor = resp.next_cursor;
    // gentle delay to avoid throttling for large syncs
    if (next_cursor) await new Promise(r => setTimeout(r, 200));
  } while (next_cursor);

  return all;
}

async function upsertBatch(rows, batchSize = 50) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    console.log(`Upserting batch ${i}..${i + batch.length - 1} (${batch.length} rows)`);
    const { data, error } = await supabase
      .from('images')
      .upsert(batch, { onConflict: 'image_id' })
      .select('id, image_id, image_url');

    if (error) {
      console.error('Supabase upsert error:', error);
      // continue after small delay so we don't hammer
      await new Promise(r => setTimeout(r, 300));
    } else {
      console.log(`Upserted ${data ? data.length : 0} rows`);
    }
    // small pause
    await new Promise(r => setTimeout(r, 150));
  }
}

(async function main() {
  try {
    console.log('Starting Cloudinary -> Supabase sync');
    console.log('Cloudinary cloud_name:', cloudinary.config().cloud_name);
    console.log('Using prefix:', PREFIX || '(ALL resources)');

    const resources = await fetchResourcesByPrefix(PREFIX);
    console.log('Total resources fetched:', resources.length);

    if (!resources.length) {
      console.log('No resources found for the given prefix. Exiting.');
      return;
    }

    const rows = resources.map(mapCloudinaryToRow);
    await upsertBatch(rows, 50);

    console.log('Sync finished successfully.');
  } catch (err) {
    console.error('Fatal error during sync:', err);
    process.exit(1);
  }
})();
