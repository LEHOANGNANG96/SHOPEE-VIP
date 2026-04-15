import fs from 'fs-extra';
import path from 'path';

/**
 * This script splits a large JSON file into smaller chunks
 * to be served as static assets.
 */
async function splitJson(inputPath: string, outputDir: string, chunkSize: number = 50) {
  try {
    console.log(`Reading large JSON from ${inputPath}...`);
    const data = await fs.readJson(inputPath);
    
    if (!Array.isArray(data)) {
      throw new Error('Input JSON must be an array of objects.');
    }

    console.log(`Total items: ${data.length}`);
    const totalChunks = Math.ceil(data.length / chunkSize);
    
    await fs.ensureDir(outputDir);
    await fs.emptyDir(outputDir);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkPath = path.join(outputDir, `part_${i + 1}.json`);
      await fs.outputJson(chunkPath, chunk);
      console.log(`Generated ${chunkPath} (${chunk.length} items)`);
    }

    // Generate a manifest file
    const manifest = {
      totalItems: data.length,
      chunkSize,
      totalChunks,
      lastUpdated: new Date().toISOString()
    };
    await fs.outputJson(path.join(outputDir, 'manifest.json'), manifest);
    
    console.log('Split completed successfully!');
  } catch (error) {
    console.error('Error splitting JSON:', error);
  }
}

const input = process.argv[2] || 'large-data.json';
const output = process.argv[3] || 'public/data/chunks';
const size = parseInt(process.argv[4]) || 100;

splitJson(input, output, size);
