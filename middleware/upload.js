import multer from "multer";

// In-memory storage — multer keeps the file as a Buffer on req.file.
// We never write to disk because we forward directly to Cloudinary.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!/^image\/(jpe?g|png|webp|heic)$/i.test(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP or HEIC images are allowed"));
  }
  cb(null, true);
};

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single("avatar");

// Wrap multer to forward errors as JSON instead of HTML.
export function withUpload(req, res, next) {
  uploadAvatar(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "Image is too large (max 5MB)" });
    }
    return res.status(400).json({ success: false, message: err.message || "Upload failed" });
  });
}
