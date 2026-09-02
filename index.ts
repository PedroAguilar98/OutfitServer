
import path from "path";
import express from "express";
import vtonRoutes from "./routes/vton.routes";


const app = express();


async function main() {
    app.use(express.json());


    app.use("/vton", vtonRoutes);

    app.use(
        "/uploads",
        express.static(path.join(__dirname, "../uploads"))
    );

    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        console.log(`Servidor corriendo en puerto ${port}`);
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});