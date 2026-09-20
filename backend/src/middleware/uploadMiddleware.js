import multer from 'multer';
import path from 'path';
import fs from 'fs';
import env from '../config/env.js';
import { sendError } from '../utils/responseHandler.js';

// Storage configuration with per-user directory isolation and sanitized file identifiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const userUploadDir = path.join(env.UPLOAD_DIR, req.user._id.toString());
      if (!fs.existsSync(userUploadDir)) {
        fs.mkdirSync(userUploadDir, { recursive: true });
      }
      cb(null, userUploadDir);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    // Sanitize extension and protect against path traversal
    const safeExt = path.extname(path.basename(file.originalname)).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `doc-${uniqueSuffix}${safeExt}`);
  },
});

// File filter for supported receipt/invoice types: JPG, JPEG, PNG, PDF
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];

  const cleanBasename = path.basename(file.originalname);
  const ext = path.extname(cleanBasename).toLowerCase();

  // Check for path traversal or hidden/suspicious file naming
  if (file.originalname.includes('..') || cleanBasename.startsWith('.')) {
    return cb(new Error('Invalid or suspicious file name format.'), false);
  }

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file format: ${file.mimetype || ext}. Only JPG, JPEG, PNG, and PDF documents are supported.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE, // 10MB
    files: 1,
  },
});

/**
 * Verify file header / magic bytes against declared MIME type
 */
const verifyMagicBytes = (filePath, mimeType) => {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (mimeType === 'application/pdf') {
      // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
      return buffer.toString('utf8', 0, 4) === '%PDF';
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      // JPEG magic bytes: FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    } else if (mimeType === 'image/png') {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    }
    return true;
  } catch (err) {
    console.warn(`[Magic Byte Check Warning] ${err.message}`);
    return true; // Don't fail if read error on valid file
  }
};

// Middleware wrapper to catch Multer errors and verify magic bytes
export const uploadSingleDocument = (fieldName = 'document') => {
  return (req, res, next) => {
    const uploadHandler = upload.single(fieldName);

    uploadHandler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(
            res,
            `File size exceeds the 10MB limit. Please upload a smaller receipt or invoice.`,
            400
          );
        }
        return sendError(res, `Upload error: ${err.message}`, 400);
      } else if (err) {
        return sendError(res, err.message, 400);
      }

      if (!req.file) {
        return sendError(res, 'No document file was uploaded.', 400);
      }

      // Verify file magic bytes to prevent renamed executables
      const isMagicValid = verifyMagicBytes(req.file.path, req.file.mimetype);
      if (!isMagicValid) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.warn(`[Cleanup Warning] Could not remove rejected file: ${unlinkErr.message}`);
        }
        return sendError(
          res,
          'File content validation failed: The uploaded file content does not match its declared image/PDF format.',
          400
        );
      }

      next();
    });
  };
};

export default uploadSingleDocument;
