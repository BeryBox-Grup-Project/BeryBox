const ImageKit = require('imagekit');

let imagekitInstance;

function getImageKit() {
  if (!imagekitInstance) {
    imagekitInstance = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }

  return imagekitInstance;
}

function isImageKitUrl(url) {
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  return typeof url === 'string'
    && typeof endpoint === 'string'
    && endpoint.length > 0
    && url.startsWith(endpoint);
}

module.exports = { getImageKit, isImageKitUrl };
