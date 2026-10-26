import multer from "multer";
import { requireR2Capacity } from "../services/r2Usage.services.js";

const storage = multer.memoryStorage();

// SVG is left out on purpose: it can carry scripts and is served from our public bucket
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

function uploadError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const parser = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // the declared type is client-controlled, this just rejects obvious junk early
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(uploadError("Only JPEG, PNG, GIF or WebP images allowed"));
    }
    cb(null, true);
  },
});

function startsWith(buffer, bytes, offset = 0) {
  return buffer.length >= offset + bytes.length &&
    bytes.every((byte, i) => buffer[offset + i] === byte)
}

// work out the real type from the file's magic bytes
function detectImageType(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "image/gif"
  // "RIFF" .... "WEBP"
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"
  return null
}

function verifyImages(req, res, next) {
  const files = req.file ? [req.file] : req.files ?? []

  for (const file of files) {
    const detected = detectImageType(file.buffer)
    if (!detected) {
      return next(uploadError("Uploaded file is not a valid image"))
    }
    // controllers build the R2 key extension and ContentType from this, so make it trustworthy
    file.mimetype = detected
  }

  next()
}

// same API as multer, but every upload is checked against its actual contents,
// and refused up front while R2 is near its free tier limit
export const upload = {
  single: (field) => [requireR2Capacity, parser.single(field), verifyImages],
  array: (field, maxCount) => [requireR2Capacity, parser.array(field, maxCount), verifyImages],
};
