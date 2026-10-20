// Image formats the backend accepts (ALLOWED_TYPES in upload.middleware.js).
// The server checks the file's real contents; this only lets users know before they upload.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// for <input type="file" accept={IMAGE_ACCEPT}>
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");

export const IMAGE_TYPE_ERROR = "Only JPEG, PNG, GIF or WebP images are allowed.";

export const isAllowedImage = (file) => IMAGE_TYPES.includes(file.type);
