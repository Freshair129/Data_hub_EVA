import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

/**
 * Downloads a file from a URL and saves it to a local path.
 * 
 * @param {string} url - The URL of the asset to download.
 * @param {string} localPath - The local absolute path where the file should be saved.
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise.
 */
export async function downloadAsset(url, localPath) {
    if (!url || !url.startsWith('http')) {
        return false;
    }

    try {
        // Ensure directory exists
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }

        const fileStream = fs.createWriteStream(localPath);
        await pipeline(response.body, fileStream);

        // console.log(`[AssetDownloader] ✅ Downloaded: ${url} -> ${localPath}`);
        return true;
    } catch (err) {
        console.error(`[AssetDownloader] ❌ Failed to download ${url}:`, err.message);
        return false;
    }
}

/**
 * Resolves a local path for an asset based on its type and ID.
 * 
 * @param {string} customerId - The customer ID.
 * @param {string} url - Original URL to determine extension.
 * @param {string} type - 'images', 'videos', or 'files'.
 * @returns {string} - Relative path from customer folder, e.g., 'assets/images/profile.jpg'
 */
export function getLocalAssetPath(customerId, url, type = 'images') {
    try {
        const urlObj = new URL(url);
        const ext = path.extname(urlObj.pathname) || '.jpg';
        const filename = path.basename(urlObj.pathname) || `asset_${Date.now()}${ext}`;

        return path.join('assets', type, filename);
    } catch {
        return `assets/${type}/asset_${Date.now()}.jpg`;
    }
}
