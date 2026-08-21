import { useState } from 'react';
import { authApi } from '../api';

const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

export function useImageKitUpload() {
  const [uploading, setUploading] = useState(false);
  const publicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
  const endpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;
  const configured = Boolean(publicKey && typeof endpoint === 'string' && /^https?:\/\//.test(endpoint));

  async function upload(file) {
    if (!configured) {
      throw new Error('Isi VITE_IMAGEKIT_PUBLIC_KEY dan VITE_IMAGEKIT_URL_ENDPOINT (URL https://ik.imagekit.io/...) di .env');
    }
    setUploading(true);
    try {
      const auth = await authApi.imageAuth();
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);
      body.append('publicKey', publicKey);
      body.append('token', auth.token);
      body.append('expire', String(auth.expire));
      body.append('signature', auth.signature);
      body.append('folder', '/berybox');

      const response = await fetch(UPLOAD_URL, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Gagal mengunggah gambar');
      return data.url;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, configured, endpoint };
}
