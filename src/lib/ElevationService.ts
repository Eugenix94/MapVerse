import * as turf from '@turf/turf';

export interface ElevationData {
  gridSize: [number, number]; // [width, height] usually [10, 10]
  elevations: number[]; // 1D array of normalized elevations, length gridSize[0] * gridSize[1]
  minElevation: number; // Minimum elevation found in the raw data, used to offset other heights
}

export class ElevationService {
  /**
   * Fetches SRTM elevation data for a grid of points covering the bounding box.
   * @param bbox Bounding box [minLon, minLat, maxLon, maxLat]
   * @param gridWidth Number of points along the longitude axis
   * @param gridHeight Number of points along the latitude axis
   */
  static async fetchElevationGrid(bbox: [number, number, number, number], gridWidth = 10, gridHeight = 10): Promise<ElevationData> {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    
    // Generate grid points
    // Three.js PlaneGeometry starts from top-left, going row by row (X from left to right, Y from top to bottom)
    const points: {lat: number, lon: number}[] = [];
    
    for (let y = 0; y < gridHeight; y++) {
      // Linear interpolate latitude from maxLat (top) to minLat (bottom)
      const lat = maxLat - (y / (gridHeight - 1)) * (maxLat - minLat);
      for (let x = 0; x < gridWidth; x++) {
        // Linear interpolate longitude from minLon (left) to maxLon (right)
        const lon = minLon + (x / (gridWidth - 1)) * (maxLon - minLon);
        points.push({ lat, lon });
      }
    }
    
    // Format for API: lat,lng|lat,lng...
    const locationsString = points.map(p => `${p.lat},${p.lon}`).join('|');
    // We use a local Vite proxy to avoid CORS issues. See vite.config.ts.
    const url = `/api/elevation`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `locations=${encodeURIComponent(locationsString)}`
    });
    
    if (!response.ok) {
      throw new Error(`OpenTopoData API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.results || data.results.length !== points.length) {
      throw new Error('Invalid response from OpenTopoData API');
    }
    
    // Extract raw elevations. Sometimes elevation can be null if over ocean.
    const rawElevations = data.results.map((r: any) => (r.elevation !== null ? r.elevation : 0));
    
    // Calculate min elevation for normalization
    const minElevation = Math.min(...rawElevations);
    
    // Normalize elevations
    const normalizedElevations = rawElevations.map((e: number) => e - minElevation);
    
    return {
      gridSize: [gridWidth, gridHeight],
      elevations: normalizedElevations,
      minElevation
    };
  }

  /**
   * Helper to interpolate the elevation at a specific lon/lat within the grid bounding box.
   */
  static getInterpolatedElevation(
    lon: number, 
    lat: number, 
    bbox: [number, number, number, number], 
    elevationData: ElevationData
  ): number {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const { gridSize, elevations } = elevationData;
    const [gridWidth, gridHeight] = gridSize;

    // Calculate relative position 0 to 1
    const px = (lon - minLon) / (maxLon - minLon);
    // Y is inverted because grid row 0 is maxLat
    const py = (maxLat - lat) / (maxLat - minLat);

    // Map to grid coordinates
    const gx = px * (gridWidth - 1);
    const gy = py * (gridHeight - 1);

    // Bound indices
    const x0 = Math.max(0, Math.min(gridWidth - 2, Math.floor(gx)));
    const y0 = Math.max(0, Math.min(gridHeight - 2, Math.floor(gy)));
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    // Local coordinates within the cell (0 to 1)
    const dx = gx - x0;
    const dy = gy - y0;

    // Fetch the 4 corner elevations
    const e00 = elevations[y0 * gridWidth + x0];
    const e10 = elevations[y0 * gridWidth + x1];
    const e01 = elevations[y1 * gridWidth + x0];
    const e11 = elevations[y1 * gridWidth + x1];

    // Bilinear interpolation
    const e0 = e00 * (1 - dx) + e10 * dx;
    const e1 = e01 * (1 - dx) + e11 * dx;
    return e0 * (1 - dy) + e1 * dy;
  }
}
