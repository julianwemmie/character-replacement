import multer from "multer";
import path from "path";
import { config } from "../config.js";
import { AppError } from "./errorHandler.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const allowedTypes = [
    ...config.upload.allowedVideoTypes,
    ...config.upload.allowedImageTypes,
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, `File type ${file.mimetype} is not allowed`));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxVideoSize,
  },
});
