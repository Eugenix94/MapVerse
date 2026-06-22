import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

export interface ExtractedGeoData {
  buildings: GeoJSON.FeatureCollection;
  highways: GeoJSON.FeatureCollection;
}

export class OverpassApiService {
  /**
   * Fetches OSM data within a bounding box using Overpass API and converts to GeoJSON.
   * @param polygon User drawn polygon in GeoJSON format.
   */
  static async fetchFeaturesForPolygon(polygon: GeoJSON.Feature<GeoJSON.Polygon>): Promise<ExtractedGeoData> {
    const bbox = turf.bbox(polygon);
    const [minLon, minLat, maxLon, maxLat] = bbox;
    
    // Query for buildings and highways (roads/paths)
    const query = `
      [out:json][timeout:25];
      (
        way["building"](${minLat},${minLon},${maxLat},${maxLon});
        way["highway"](${minLat},${minLon},${maxLat},${maxLon});
        relation["building"](${minLat},${minLon},${maxLat},${maxLon});
      );
      out body;
      >;
      out skel qt;
    `;
    
    const url = `https://overpass-api.de/api/interpreter`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`
    });
    
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }
    
    const osmData = await response.json();
    
    // Convert Overpass JSON to GeoJSON
    const geojsonData = osmtogeojson(osmData) as GeoJSON.FeatureCollection;
    
    const buildings: GeoJSON.Feature[] = [];
    const highways: GeoJSON.Feature[] = [];
    
    geojsonData.features.forEach(feature => {
      // Check if it's a building or highway based on properties
      if (feature.properties?.building) {
        buildings.push(feature);
      } else if (feature.properties?.highway) {
        highways.push(feature);
      }
    });

    return {
      buildings: turf.featureCollection(buildings),
      highways: turf.featureCollection(highways)
    };
  }
}
