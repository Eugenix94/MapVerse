import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

export type OsmCategory = 'buildings' | 'highways' | 'cycleways' | 'transport' | 'water' | 'nature';

export interface ExtractedGeoData {
  buildings: GeoJSON.FeatureCollection;
  highways: GeoJSON.FeatureCollection;
  cycleways: GeoJSON.FeatureCollection;
  transport: GeoJSON.FeatureCollection;
  water: GeoJSON.FeatureCollection;
  nature: GeoJSON.FeatureCollection;
}

export class OverpassApiService {
  /**
   * Fetches OSM data within a bounding box using Overpass API and converts to GeoJSON.
   * @param polygon User drawn polygon in GeoJSON format.
   */
  static async fetchFeaturesForPolygon(polygon: GeoJSON.Feature<GeoJSON.Polygon>, categories: OsmCategory[] = ['buildings', 'highways']): Promise<ExtractedGeoData> {
    const bbox = turf.bbox(polygon);
    const [minLon, minLat, maxLon, maxLat] = bbox;
    
    if (categories.length === 0) {
      throw new Error("No categories selected.");
    }

    const categoryQueries: Record<OsmCategory, string> = {
      buildings: `way["building"](${minLat},${minLon},${maxLat},${maxLon}); relation["building"](${minLat},${minLon},${maxLat},${maxLon});`,
      highways: `way["highway"]["highway"!="cycleway"](${minLat},${minLon},${maxLat},${maxLon});`,
      cycleways: `way["highway"="cycleway"](${minLat},${minLon},${maxLat},${maxLon}); way["cycleway"](${minLat},${minLon},${maxLat},${maxLon});`,
      transport: `way["railway"](${minLat},${minLon},${maxLat},${maxLon}); node["public_transport"](${minLat},${minLon},${maxLat},${maxLon});`,
      water: `way["natural"="water"](${minLat},${minLon},${maxLat},${maxLon}); way["waterway"](${minLat},${minLon},${maxLat},${maxLon}); relation["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});`,
      nature: `way["leisure"="park"](${minLat},${minLon},${maxLat},${maxLon}); way["natural"="wood"](${minLat},${minLon},${maxLat},${maxLon}); relation["leisure"="park"](${minLat},${minLon},${maxLat},${maxLon});`
    };

    let queryStatements = '';
    categories.forEach(cat => {
      queryStatements += `\n        ${categoryQueries[cat]}`;
    });

    const query = `
      [out:json][timeout:25];
      (${queryStatements}
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
    
    const result: ExtractedGeoData = {
      buildings: turf.featureCollection([]),
      highways: turf.featureCollection([]),
      cycleways: turf.featureCollection([]),
      transport: turf.featureCollection([]),
      water: turf.featureCollection([]),
      nature: turf.featureCollection([])
    };
    
    geojsonData.features.forEach(feature => {
      const p = feature.properties || {};
      
      // Categorize exclusively into the first matching category selected
      if (categories.includes('buildings') && p.building) {
        result.buildings.features.push(feature);
      } else if (categories.includes('cycleways') && (p.highway === 'cycleway' || p.cycleway)) {
        result.cycleways.features.push(feature);
      } else if (categories.includes('highways') && p.highway && p.highway !== 'cycleway') {
        result.highways.features.push(feature);
      } else if (categories.includes('transport') && (p.railway || p.public_transport)) {
        result.transport.features.push(feature);
      } else if (categories.includes('water') && (p.natural === 'water' || p.waterway)) {
        result.water.features.push(feature);
      } else if (categories.includes('nature') && (p.leisure === 'park' || p.natural === 'wood')) {
        result.nature.features.push(feature);
      }
    });

    return result;
  }
}
