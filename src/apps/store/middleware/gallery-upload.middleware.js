import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|webp|gif/;
  const videoTypes = /mp4|mov|avi|webm|mkv/;
  const ext = (file.originalname.toLowerCase().match(/\.[0-9a-z]+$/i)?.[0] || '');
  const extname = imageTypes.test(ext) || videoTypes.test(ext);
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');

  if ((isImage || isVideo) && extname) {
    return cb(null, true);
  }
  cb(new Error('Only images (JPEG, PNG, WebP, GIF) and videos (MP4, MOV, AVI, WebM, MKV) are allowed'));
};

const limits = {
  fileSize: 20 * 1024 * 1024,
  files: 5
};

export const galleryUpload = multer({ storage, fileFilter, limits });
