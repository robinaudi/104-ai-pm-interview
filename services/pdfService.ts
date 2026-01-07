
import * as pdfjsLibProxy from 'pdfjs-dist';

// 1. Resolve the module structure (CommonJS vs ESM vs Bundled)
let pdfjsLib: any = pdfjsLibProxy;
if (pdfjsLibProxy.default) {
    pdfjsLib = pdfjsLibProxy.default;
}

// 2. Configure Worker
// We use cdnjs here because it's often more reliable for Worker scripts than esm.sh in restricted environments
// due to how importScripts works inside the worker.
if (typeof window !== 'undefined') {
    // Ensure GlobalWorkerOptions exists
    if (!pdfjsLib.GlobalWorkerOptions && (pdfjsLibProxy as any).GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions = (pdfjsLibProxy as any).GlobalWorkerOptions;
    }

    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
}

/**
 * Renders the first page of the PDF to a base64 image string.
 * Used for file preview thumbnails.
 */
export const renderPDFPageToDataURL = async (file: File, scale = 1.5): Promise<string | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    if (!pdfjsLib.getDocument) return null;

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Get first page

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return null;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error("PDF Render Error:", error);
    return null;
  }
};

/**
 * Extracts the largest image found on the first page of a PDF.
 */
export const extractProfileImageFromPDF = async (file: File): Promise<string | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Check if getDocument is available
    if (!pdfjsLib.getDocument) {
        console.error("PDF.js library is missing getDocument function", pdfjsLib);
        return null;
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const page = await pdf.getPage(1);
    const ops = await page.getOperatorList();
    
    let bestImage: { width: number; height: number; data: string } | null = null;

    // Resolve OPS constants
    const OPS = pdfjsLib.OPS || (pdfjsLibProxy as any).OPS;
    if (!OPS) {
         console.warn("PDF.js OPS constants not found.");
         return null;
    }

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      if (fn === OPS.paintImageXObject) {
        const imgName = args[0];
        try {
            const imgObj = await page.objs.get(imgName);
            
            if (imgObj && imgObj.width && imgObj.height) {
                // Filter: Ignore small icons/lines
                if (imgObj.width < 50 || imgObj.height < 50) continue;

                // 104 Logic: Profile photos are roughly square/portrait and of reasonable size
                const isLikelyProfilePhoto = 
                    (imgObj.width > 100 && imgObj.width < 800) &&
                    (imgObj.height > 100 && imgObj.height < 800);

                if (isLikelyProfilePhoto) {
                    const canvas = document.createElement('canvas');
                    canvas.width = imgObj.width;
                    canvas.height = imgObj.height;
                    const ctx = canvas.getContext('2d');
                    
                    if (ctx) {
                        const imgData = ctx.createImageData(imgObj.width, imgObj.height);
                        
                        if (imgObj.kind === 1) { // Grayscale
                             // Simple grayscale handling could go here
                        } else if (imgObj.data.length === imgObj.width * imgObj.height * 3) { // RGB
                            let srcIndex = 0;
                            let destIndex = 0;
                            while (srcIndex < imgObj.data.length) {
                                imgData.data[destIndex++] = imgObj.data[srcIndex++];
                                imgData.data[destIndex++] = imgObj.data[srcIndex++];
                                imgData.data[destIndex++] = imgObj.data[srcIndex++];
                                imgData.data[destIndex++] = 255;
                            }
                        } else if (imgObj.data.length === imgObj.width * imgObj.height * 4) { // RGBA
                             imgData.data.set(imgObj.data);
                        }

                        ctx.putImageData(imgData, 0, 0);
                        const base64 = canvas.toDataURL('image/jpeg', 0.85);
                        
                        // Heuristic: Prefer largest image
                        if (!bestImage || (imgObj.width * imgObj.height > bestImage.width * bestImage.height)) {
                            bestImage = {
                                width: imgObj.width,
                                height: imgObj.height,
                                data: base64
                            };
                        }
                    }
                }
            }
        } catch (e) {
            // Ignore individual image extraction errors
        }
      }
    }

    return bestImage ? bestImage.data : null;

  } catch (error) {
    console.error("PDF Image Extraction Error:", error);
    // Return null instead of throwing to prevent blocking the main import process
    return null;
  }
};
