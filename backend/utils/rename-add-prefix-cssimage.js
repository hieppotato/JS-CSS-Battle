/**
 * utils/rename-add-prefix-cssimage.js
 *
 * Usage:
 *   # dry-run (default)
 *   node utils/rename-add-prefix-cssimage.js
 *
 *   # real run (will perform rename + DB update)
 *   DRY_RUN=false node utils/rename-add-prefix-cssimage.js
 *
 * Required env vars: (via .env or environment)
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *
 * Behavior:
 *   - Reads rows from images table (id, public_id, secure_url)
 *   - For rows where public_id does NOT start with PREFIX + '/', it will call cloudinary.uploader.rename(old, new)
 *   - On success, it updates the Supabase row with new public_id and secure_url
 *   - If dry-run (default) it only prints what it WOULD do
 */

require('dotenv').config();
const { cloudinary, supabase } = require('../config/db'); // chỉnh đường dẫn nếu khác

const PREFIX = process.env.TARGET_PREFIX || 'CSS_image';    // prefix to add
const DRY_RUN = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false'; // default true
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 30);
const DELAY_MS = Number(process.env.DELAY_MS || 200); // small delay between ops to be gentle

async function fetchImagesToRename(limit = 1000) {
  // fetch images that don't already start with PREFIX/
  const prefixLike = `${PREFIX}/%`; // for later SQL style, but supabase-js doesn't support ilike with wildcard easily; we'll fetch and filter client-side
  const { data, error } = await supabase
    .from('images')
    .select('id, public_id, secure_url')
    .limit(limit);
  if (error) throw error;
  const rows = data || [];
  return rows.filter(r => r.public_id && !r.public_id.startsWith(`${PREFIX}/`));
}

async function renameResource(oldPublicId, newPublicId) {
  try {
    // overwrite: false ensures we don't overwrite existing resource
    const resp = await cloudinary.uploader.rename(oldPublicId, newPublicId, { invalidate: true, overwrite: false });
    return resp;
  } catch (err) {
    // return error object for caller to handle/log
    throw err;
  }
}

async function getResource(publicId) {
  try {
    const res = await cloudinary.api.resource(publicId);
    return res;
  } catch (err) {
    return null;
  }
}

async function updateDbRow(id, updates) {
  const { data, error } = await supabase
    .from('images')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}

(async function main(){
  try {
    console.log('DRY_RUN =', DRY_RUN);
    console.log('TARGET PREFIX =', PREFIX);
    console.log('Fetching images from Supabase to consider renaming...');
    const rows = await fetchImagesToRename(5000);
    console.log('Total candidate rows (without prefix):', rows.length);
    if (!rows.length) {
      console.log('No rows to process. Exiting.');
      return;
    }

    // process in batches
    let processed = 0;
    let renamed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      for (const row of batch) {
        processed++;
        const oldId = row.public_id;
        if (!oldId) {
          console.warn('Skipping row with no public_id, id=', row.id);
          skipped++;
          continue;
        }
        const newPublicId = `${PREFIX}/${oldId}`;
        console.log(`\n[${processed}] Would rename: "${oldId}" -> "${newPublicId}"`);

        // dry-run only show what would be done
        if (DRY_RUN) {
          // optionally fetch current cloudinary info to show current URL
          const current = await getResource(oldId);
          console.log('  Cloudinary current secure_url:', current ? current.secure_url : '(not found)');
          continue;
        }

        // REAL RUN: attempt rename
        try {
          // First check if target exists to avoid conflict
          const target = await getResource(newPublicId);
          if (target) {
            console.warn('  Target already exists on Cloudinary, skipping to avoid overwrite:', newPublicId);
            skipped++;
            continue;
          }

          // rename old -> new
          console.log('  Calling cloudinary.uploader.rename...');
          const renameResp = await renameResource(oldId, newPublicId);
          console.log('  Rename response:', renameResp && renameResp.result ? renameResp.result : renameResp);

          // Fetch resource details for new id
          const res = await getResource(newPublicId);
          if (!res) {
            console.warn('  Rename succeeded but unable to fetch new resource info for', newPublicId);
          }

          // Update DB row: public_id and secure_url (if available)
          const updates = { public_id: newPublicId };
          if (res && res.secure_url) updates.secure_url = res.secure_url;

          await updateDbRow(row.id, updates);
          console.log(`  Updated DB id=${row.id} with new public_id and secure_url`);
          renamed++;
        } catch (err) {
          errors++;
          console.error('  Error renaming/updating for', oldId, err && err.message ? err.message : err);
        }

        // gentle delay
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    console.log('\nDone. Summary:');
    console.log(' processed:', processed);
    console.log(' renamed:', renamed);
    console.log(' skipped:', skipped);
    console.log(' errors:', errors);
  } catch (err) {
    console.error('Fatal error', err);
    process.exit(1);
  }
})();
