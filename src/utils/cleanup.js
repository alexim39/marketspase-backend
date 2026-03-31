// utils/cleanup.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cleanOldCampiagnFiles = () => {
  const tempDir = path.join(__dirname, '../../../uploads/campaigns');
  console.log('Checking directory:', tempDir); 
  
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

const cleanOldProductFiles = () => {
  const tempDir = path.join(__dirname, '../../../uploads/products');
  console.log('Checking directory:', tempDir); 
  
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

// 2. Schedule the job to run every 20 minutes
export const initFileUploadCleanupTask = () => {
  cron.schedule('*/20 * * * *', () => {
    console.log('- Starting Scheduled Files Cleanup -');
    cleanOldCampiagnFiles();
    cleanOldProductFiles();
  });
}