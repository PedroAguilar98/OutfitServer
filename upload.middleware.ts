import fs from "fs";
import multer from "multer";
import path from "path";

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: "uploads/",
    filename(req, file, cb) {

        const filename =
            crypto.randomUUID() +
            path.extname(file.originalname);

        cb(null, filename);
    }
});

export const upload = multer({
    storage
});