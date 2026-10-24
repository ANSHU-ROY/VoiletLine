// scripts/validate-data.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔍 Validating VioletLink Open-Source Data Structure...');

const stationsDir = path.join(rootDir, 'data', 'violet-line');
const stationFiles = fs.readdirSync(stationsDir).filter(f => f.endsWith('.json'));

if (stationFiles.length < 12) {
  console.error(`❌ Expected at least 12 Violet Line Faridabad stations, found ${stationFiles.length}`);
  process.exit(1);
}

let hasError = false;

for (const file of stationFiles) {
  const filePath = path.join(stationsDir, file);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    // Required fields
    const required = ['slug', 'name', 'hindiName', 'line', 'coordinates', 'gates', 'autoStands', 'dropZones'];
    for (const req of required) {
      if (!data[req]) {
        console.error(`❌ [${file}] Missing required field: ${req}`);
        hasError = true;
      }
    }

    // Coordinates sanity check (Faridabad lat ~28.3 - 28.5, lng ~77.2 - 77.4)
    if (data.coordinates.lat < 28.2 || data.coordinates.lat > 28.6 || data.coordinates.lng < 77.1 || data.coordinates.lng > 77.5) {
      console.error(`❌ [${file}] Coordinate out of Faridabad bounds: ${JSON.stringify(data.coordinates)}`);
      hasError = true;
    }

    if (!Array.isArray(data.gates) || data.gates.length === 0) {
      console.error(`❌ [${file}] Gates must be a non-empty array`);
      hasError = true;
    }

    if (!Array.isArray(data.dropZones) || data.dropZones.length === 0) {
      console.error(`❌ [${file}] Drop zones must be a non-empty array`);
      hasError = true;
    }
  } catch (err) {
    console.error(`❌ [${file}] Failed to parse JSON:`, err.message);
    hasError = true;
  }
}

// Check fares & timetable & pricing
const pricingFile = path.join(rootDir, 'data', 'pricing.json');
const faresFile = path.join(rootDir, 'data', 'fares', 'violet-line-fares.json');
const timetableFile = path.join(rootDir, 'data', 'timetable', 'violet-line.json');

for (const extra of [pricingFile, faresFile, timetableFile]) {
  try {
    const content = fs.readFileSync(extra, 'utf-8');
    JSON.parse(content);
    console.log(`✅ Loaded ${path.relative(rootDir, extra)}`);
  } catch (err) {
    console.error(`❌ Error in ${extra}:`, err.message);
    hasError = true;
  }
}

if (hasError) {
  console.error('\n❌ Data validation failed.');
  process.exit(1);
} else {
  console.log(`\n✨ All ${stationFiles.length} stations and fare/timetable datasets successfully validated!`);
  process.exit(0);
}
