// utils/cleanup.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const cleanOldTempFiles = () => {
  const tempDir = path.join(__dirname, '../uploads');
  
  if (!fs.existsSync(tempDir)) return;
  
  const files = fs.readdirSync(tempDir);
  const now = Date.now();
  
  files.forEach(file => {
    const filePath = path.join(tempDir, file);
    const stats = fs.statSync(filePath);
    const fileAge = now - stats.mtimeMs;
    
    // Delete files older than 1 hour
    if (fileAge > 60 * 60 * 1000) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old temp file: ${file}`);
    }
  });
};

// Run cleanup every hour
//setInterval(cleanOldTempFiles, 60 * 60 * 1000);
setInterval(cleanOldTempFiles, 2 * 60 * 1000); // dev test