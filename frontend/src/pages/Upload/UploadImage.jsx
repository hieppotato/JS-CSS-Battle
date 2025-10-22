import React, { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

export default function SupabaseImageUploader() {
  const [files, setFiles] = useState([]); // {file, preview}
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({}); // {filename: percent}
  const [message, setMessage] = useState(null);

  const bucket = process.env.REACT_APP_SUPABASE_BUCKET || 'images';

  function handleFilesChange(e) {
    const chosen = Array.from(e.target.files || []);
    const mapped = chosen.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setFiles((prev) => [...prev, ...mapped]);
  }

  function removeItem(index) {
    const copy = [...files];
    // revoke object URL
    if (copy[index] && copy[index].preview) URL.revokeObjectURL(copy[index].preview);
    copy.splice(index, 1);
    setFiles(copy);
  }

  async function uploadAll() {
    if (!files.length) return setMessage({ type: 'error', text: 'No files selected' });
    setUploading(true);
    setMessage(null);
    const results = [];

    try {
      for (const entry of files) {
        const file = entry.file;
        // create a safe path: YYYY/MMDD/filename_timestamp.ext
        const ext = file.name.split('.').pop();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const ts = now.getTime();
        const path = `${yyyy}/${mm}${dd}/${ts}_${safeName}`;

        setProgress((p) => ({ ...p, [file.name]: 5 }));

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          console.error('Upload error', uploadError);
          results.push({ file: file.name, ok: false, error: uploadError });
          setProgress((p) => ({ ...p, [file.name]: 0 }));
          continue;
        }

        setProgress((p) => ({ ...p, [file.name]: 50 }));

        // Get public URL (adjust if you want signed URLs)
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
        const public_url = urlData.publicUrl;

        setProgress((p) => ({ ...p, [file.name]: 80 }));

        // Insert metadata into images table
        const metadata = {
          image_id: uploadData.path, // we store path as image_id so we can build URLs later
          image_url: public_url,
          filename: file.name,
          width: null,
          height: null,
          bytes: file.size
        };

        const { data: insertData, error: insertError } = await supabase
          .from('images')
          .insert([metadata])
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Insert metadata error', insertError);
          results.push({ file: file.name, ok: false, error: insertError });
          setProgress((p) => ({ ...p, [file.name]: 60 }));
          continue;
        }

        setProgress((p) => ({ ...p, [file.name]: 100 }));
        results.push({ file: file.name, ok: true, row: insertData });
      }

      const successCount = results.filter((r) => r.ok).length;
      setMessage({ type: 'success', text: `${successCount} / ${files.length} uploaded` });

      // clear previews for uploaded files
      setFiles([]);
      setProgress({});
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Unexpected error. Check console.' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload images to Supabase Storage</h1>

      <p className="text-sm text-gray-600 mb-4">
        This page uploads selected files into the <code className="bg-gray-100 px-1 rounded">{bucket}</code> bucket
        and stores metadata in the <code className="bg-gray-100 px-1 rounded">images</code> table.
      </p>

      <div className="mb-4">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesChange}
          className="block"
        />
      </div>

      {files.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-3">
            {files.map((f, i) => (
              <div key={i} className="border rounded p-2 relative">
                <button
                  onClick={() => removeItem(i)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
                  title="Remove"
                >
                  ×
                </button>
                <img src={f.preview} alt={f.file.name} className="w-full h-32 object-cover rounded" />
                <div className="mt-2 text-xs">
                  <div className="truncate">{f.file.name}</div>
                  <div className="text-gray-500">{(f.file.size / 1024).toFixed(0)} KB</div>
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${progress[f.file.name] || 0}%` }}
                      className="h-full bg-green-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={uploadAll}
          disabled={uploading || files.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {uploading ? 'Uploading...' : 'Upload to Supabase'}
        </button>

        <button
          onClick={() => { setFiles([]); setMessage(null); setProgress({}); }}
          className="px-3 py-2 border rounded"
        >
          Clear
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">
        <p>Notes:</p>
        <ul className="list-disc ml-5">
          <li>Make sure the <code>images</code> table exists and your RLS policy allows inserts (or call from server).</li>
          <li>If you prefer private files, use <code>createSignedUrl</code> when serving images and store only the path here.</li>
          <li>Set environment variables: <code>REACT_APP_SUPABASE_URL</code>, <code>REACT_APP_SUPABASE_ANON_KEY</code>, <code>REACT_APP_SUPABASE_BUCKET</code>.</li>
        </ul>
      </div>
    </div>
  );
}
