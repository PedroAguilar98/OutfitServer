import { Router } from "express";
import { VtonController } from "../controllers/vton.controller";
import { upload } from "../upload.middleware";

const router = Router();

const controller = new VtonController();

router.post(
    "/",
    upload.array("file"),
    controller.generateVton
);
    
export default router;