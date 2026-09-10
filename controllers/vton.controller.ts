import { Request, Response } from "express";
import { Genlook } from "@genlook/api";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const client = new Genlook({ apiKey: process.env.GENLOOK_API_KEY || '' });
 


import { v2 as cloudinary } from 'cloudinary';

// Shared upload helper: `source` can be a local file path OR a remote URL,
// Cloudinary fetches either one. Used both for the product photo the user
// sends us, and for persisting Genlook's (short-lived) result image.
const uploadToCloudinary = async (source: string, folder: string, publicIdPrefix: string) => {
    if (!source) return null;
    // Configuration
    cloudinary.config({
        cloud_name: 'hagj26kg',
        api_key: process.env.CLOUDINARY_API_KEY || '',
        api_secret: process.env.CLOUDINARY_API_SECRET || '' // Click 'View API Keys' above to copy your API secret
    });

    // Upload with a unique public_id so each upload is a distinct asset
    const uploadResult = await cloudinary.uploader
       .upload(
           source, {
               public_id: `${publicIdPrefix}_${randomUUID()}`,
               folder,
           }
       )
       .catch((error) => {
           console.log(error);
       });

    console.log(uploadResult);

    return uploadResult ?? null;
};

const uploadImage = async (imagePath: string) => {
    const uploadResult = await uploadToCloudinary(imagePath, 'vton-products', 'product');
    if (!uploadResult) return null;

    // Transform the image: auto-crop to square aspect_ratio
    const autoCropUrl = cloudinary.url(uploadResult.public_id, {
        crop: 'auto',
        gravity: 'auto',
        width: 500,
        height: 500,
    });

    // Keep the public_id around so a failed downstream step can undo this upload
    return { url: autoCropUrl, publicId: uploadResult.public_id };
};

// Genlook only keeps generated result images in its bucket for ~7 days.
// Re-host the result on Cloudinary so we own a durable copy, and hand that
// URL back instead of the Genlook one.
const persistResultImage = async (remoteUrl: string) => {
    const uploadResult = await uploadToCloudinary(remoteUrl, 'vton-results', 'result');
    if (!uploadResult) return null;

    // Just optimize delivery (no crop) — this is the full try-on result, not a thumbnail
    const optimizedUrl = cloudinary.url(uploadResult.public_id, {
        fetch_format: 'auto',
        quality: 'auto'
    });

    return { url: optimizedUrl, publicId: uploadResult.public_id };
};

// Compensating action for uploadImage: deletes the asset if a later step fails
const deleteImage = async (publicId: string) => {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId).catch((error) => {
        console.log("cloudinary destroy error", error);
    });
};


const runGeneration = async (modelImage: string, productImage: string) => {
    // 1. Upload the person photo (reuse the imageId across many try-ons)
    const { imageId } = await client.images.upload(await readFile(modelImage), {
        mimeType: "image/jpeg",
    });
    console.log("imageId", imageId)
    // 2. Run the try-on: reference an existing product, or upsert one inline
    const { generationId } = await client.tryOn.create({
        products: [
            {
                externalId: "shirt-42",
                title: "Red tee",
                description: "Soft cotton regular fit",
                images: [
                    {
                        source: {
                            url: productImage
                        }
                    }
                ]
            }
        ],
        person: {
            image: {
                source: {
                    id: imageId
                }
            }
        }
    }as any) ;

    const result = await client.generations.waitFor(generationId);

    console.log(result.resultImageUrl);
    console.log(result.status);

    return result;
}

export class VtonController {
    async generateVton(req: Request, res: Response){
        try{
            const files:{ [fieldname: string]: Express.Multer.File[]; } | Express.Multer.File[] | undefined= req.files
            let result:any = null
            if(files && Array.isArray(files)){
                const uploaded = await uploadImage(files[1]?.path ?? '')
                console.log("publicUrl", uploaded?.url)
                if(uploaded){
                    try{
                        result =await runGeneration(files[0]?.path ?? '', uploaded.url);
                    }catch(error){
                        // Compensating action: undo the Cloudinary upload since the
                        // overall try-on failed and there's nothing to keep it for.
                        await deleteImage(uploaded.publicId);
                        throw error;
                    }
                }
            }
            if(result){
                // Genlook's result image only lives ~7 days in its bucket, so
                // re-host it on Cloudinary and return that durable URL instead.
                // If the copy fails for some reason, fall back to Genlook's URL
                // rather than failing the whole request.
                const persisted = result?.resultImageUrl
                    ? await persistResultImage(result.resultImageUrl)
                    : null;
                return res.json({
                    ok:true,
                    image:persisted?.url ?? result?.resultImageUrl,
                    status:result?.status
                })
            } else {
                return res.json({
                ok:false,
                error:{body:{message:'No se pudo generar la imagen'}}
            });
            }
        }catch(error){
            console.log("error", error)
            return res.json({
                ok:false,
                error
            });
        }
    }
}