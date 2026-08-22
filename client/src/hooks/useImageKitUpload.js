import { useState } from 'react';
import { authApi } from '../api';

export function useImageKitUpload() {
  const [uploading, setUploading] = useState(false);
  const configured = true;

  async function upload(file) {
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const data = await authApi.imageUpload({ file: dataUrl, fileName: file.name || 'upload.jpg' });
      if (!data?.url) throw new Error('Gagal mengunggah gambar');
      return data.url;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, configured };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}
