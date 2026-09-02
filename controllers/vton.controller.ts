import { Request, Response } from "express";
import { Genlook } from "@genlook/api";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const client = new Genlook({ apiKey: 'gk_fj-p1psuJEapqr1LXVaWq_O8_ZVHX5-d6pDl0SNKjYM' });
 


import { v2 as cloudinary } from 'cloudinary';

const uploadImage = async (imagePath: string) => {
    if(!imagePath) return null
    // Configuration
    cloudinary.config({ 
        cloud_name: 'hagj26kg', 
        api_key: '578378629943262', 
        api_secret: 'O54OjhPUsc1_ZQpYMD4tInDQV1s' // Click 'View API Keys' above to copy your API secret
    });
    
    // Upload an image with a unique public_id so each upload is a distinct asset
    const uploadResult = await cloudinary.uploader
       .upload(
           imagePath, {
               public_id: `product_${randomUUID()}`,
               folder: 'vton-products',
           }
       )
       .catch((error) => {
           console.log(error);
       });

    console.log(uploadResult);

    if (!uploadResult) return null;

    // Optimize delivery by resizing and applying auto-format and auto-quality
    const optimizeUrl = cloudinary.url(uploadResult.public_id, {
        fetch_format: 'auto',
        quality: 'auto'
    });

    console.log(optimizeUrl);

    // Transform the image: auto-crop to square aspect_ratio
    const autoCropUrl = cloudinary.url(uploadResult.public_id, {
        crop: 'auto',
        gravity: 'auto',
        width: 500,
        height: 500,
    });

    return autoCropUrl
};


const runGeneration = async (modelImage: string, productImage: string) => {
    try{
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
    }catch(error){
        console.log("error", error)

    }
}

export class VtonController {
    async generateVton(req: Request, res: Response){
        try{
            const files:{ [fieldname: string]: Express.Multer.File[]; } | Express.Multer.File[] | undefined= req.files
            if(files && Array.isArray(files)){
                const publicUrl = await uploadImage(files[1]?.path ?? '')
                console.log("publicUrl", publicUrl)
                if(publicUrl)
                await runGeneration(files[0]?.path ?? '', publicUrl);
            }
            return res.json({
                ok:true
            })
        }catch(error){
            console.log("error", error)
            return res.json({
                ok:false,
                error
            });
        }
    }
}