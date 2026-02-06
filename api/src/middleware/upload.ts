import multer from "multer";
import path from "path";
import { Request } from "express";

// WIP

// Configure storage
const storage = multer.diskStorage({
    destination: (req: Request, file, cb) => {
        cb(null, "uploads/designs/");
    },
    filename: (req: Request, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `design-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error("Only image files are allowed!"));
    }
};

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter,
});

