/**
 * Storage Service Placeholder
 * Future: integrate with Supabase Storage for file uploads (payslips, receipts, etc.)
 */

const { supabase } = require('../../config/database');

async function uploadFile(bucket, filePath, file, contentType = 'application/pdf') {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { contentType });

    if (error) throw error;
    return { success: true, path: data.path };
  } catch (err) {
    console.error('Upload error:', err.message);
    return { success: false, error: err.message };
  }
}

async function getFileUrl(bucket, filePath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || null;
}

module.exports = { uploadFile, getFileUrl };
