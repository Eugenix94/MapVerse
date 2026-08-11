import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

export type OsmCategory = 'buildings' | 'highways' | 'cycleways' | 'transport' | 'water' | 'nature' | 'schools' | 'bus_stops';

export interface ExtractedGeoData {
  buildings: GeoJSON.FeatureCollection;
  highways: GeoJSON.FeatureCollection;
  cycleways: GeoJSON.FeatureCollection;
  transport: GeoJSON.FeatureCollection;
  water: GeoJSON.FeatureCollection;
  nature: GeoJSON.FeatureCollection;
  schools: GeoJSON.FeatureCollection;
  bus_stops: GeoJSON.FeatureCollection;
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
      nature: `way["leisure"="park"](${minLat},${minLon},${maxLat},${maxLon}); way["natural"="wood"](${minLat},${minLon},${maxLat},${maxLon}); relation["leisure"="park"](${minLat},${minLon},${maxLat},${maxLon});`,
      schools: `node["amenity"="school"](${minLat},${minLon},${maxLat},${maxLon}); way["amenity"="school"](${minLat},${minLon},${maxLat},${maxLon}); relation["amenity"="school"](${minLat},${minLon},${maxLat},${maxLon}); way["building"="school"](${minLat},${minLon},${maxLat},${maxLon}); relation["building"="school"](${minLat},${minLon},${maxLat},${maxLon});`,
      bus_stops: `node["highway"="bus_stop"](${minLat},${minLon},${maxLat},${maxLon}); node["amenity"="bus_station"](${minLat},${minLon},${maxLat},${maxLon}); way["amenity"="bus_station"](${minLat},${minLon},${maxLat},${maxLon}); relation["amenity"="bus_station"](${minLat},${minLon},${maxLat},${maxLon}); node["public_transport"="platform"]["bus"="yes"](${minLat},${minLon},${maxLat},${maxLon}); node["public_transport"="stop_position"]["bus"="yes"](${minLat},${minLon},${maxLat},${maxLon});`
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
    
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (const url of endpoints) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `data=${encodeURIComponent(query)}`
        });
        
        if (response.ok) {
          break; // Success!
        } else {
          lastError = new Error(`Overpass API error on ${url}: ${response.status} ${response.statusText}`);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Failed to fetch from ${url}, trying next...`, err);
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('All Overpass API endpoints failed');
    }
    
    const osmData = await response.json();
    
    // Convert Overpass JSON to GeoJSON
    let parseOsmtogeojson = osmtogeojson;
    if (typeof parseOsmtogeojson !== 'function' && typeof (parseOsmtogeojson as any).default === 'function') {
      parseOsmtogeojson = (parseOsmtogeojson as any).default;
    }
    const geojsonData = (parseOsmtogeojson as Function)(osmData) as GeoJSON.FeatureCollection;
    
    const result: ExtractedGeoData = {
      buildings: turf.featureCollection([]),
      highways: turf.featureCollection([]),
      cycleways: turf.featureCollection([]),
      transport: turf.featureCollection([]),
      water: turf.featureCollection([]),
      nature: turf.featureCollection([]),
      schools: turf.featureCollection([]),
      bus_stops: turf.featureCollection([])
    };
    
    geojsonData.features.forEach(feature => {
      const p = feature.properties || {};
      
      // Categorize exclusively into the first matching category selected
      if (categories.includes('schools') && (p.amenity === 'school' || p.building === 'school')) {
        result.schools.features.push(feature);
      } else if (categories.includes('bus_stops') && (p.highway === 'bus_stop' || p.amenity === 'bus_station' || (p.public_transport && p.bus === 'yes'))) {
        result.bus_stops.features.push(feature);
      } else if (categories.includes('buildings') && p.building) {
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

export const isSpecialBuilding = (feature: any): boolean => {
  if (!feature || !feature.properties) return false;
  const p = feature.properties;
  
  // If it has a specific name or operator tag, it's special
  if (p.name || p.operator || p['addr:housename']) return true;
  
  // List of generic building types
  const genericTypes = ['yes', 'house', 'residential', 'apartments', 'garage', 'garages', 'shed', 'terrace', 'detached', 'static_caravan', 'cabin', 'roof', 'service', 'building'];
  const buildingType = p.building ? String(p.building).toLowerCase().trim() : '';
  if (buildingType && !genericTypes.includes(buildingType)) {
    return true;
  }
  
  // If it has amenity, historic, tourism, or landmark tags, it is special
  if (p.amenity || p.historic || p.tourism || p.office || p.government || p.shop || p.craft || p.leisure || p.religion || p.healthcare || p.sport || p.public_building || p.diplomatic) {
    return true;
  }
  
  return false;
};
