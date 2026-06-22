import { useState } from 'react';
import ProjectSelectorMap from './components/ProjectSelectorMap';
import EditorWorkspace from './components/EditorWorkspace';
import { OverpassApiService } from './lib/OverpassApiService';
import type { ExtractedGeoData } from './lib/OverpassApiService';
import { ElevationService } from './lib/ElevationService';
import type { ElevationData } from './lib/ElevationService';
import * as turf from '@turf/turf';
import { Loader2 } from 'lucide-react';
import './App.css';

function App() {
  const [mode, setMode] = useState<'selecting' | 'loading' | 'editing'>('selecting');
  const [projectBounds, setProjectBounds] = useState<GeoJSON.Feature<GeoJSON.Polygon> | null>(null);
  const [geoData, setGeoData] = useState<ExtractedGeoData | null>(null);
  const [elevationData, setElevationData] = useState<ElevationData | null>(null);

  const handlePolygonDrawn = async (polygon: GeoJSON.Feature<GeoJSON.Polygon>) => {
    setProjectBounds(polygon);
    setMode('loading');
    
    try {
      const bbox = turf.bbox(polygon) as [number, number, number, number];
      const [data, elevData] = await Promise.all([
        OverpassApiService.fetchFeaturesForPolygon(polygon),
        ElevationService.fetchElevationGrid(bbox)
      ]);
      setGeoData(data);
      setElevationData(elevData);
      setMode('editing');
    } catch (error) {
      console.error("Failed to fetch data:", error);
      alert("Failed to fetch data from Overpass API. See console for details.");
      setMode('selecting');
    }
  };

  const handleCloseEditor = () => {
    setMode('selecting');
    setProjectBounds(null);
    setGeoData(null);
    setElevationData(null);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {mode === 'selecting' && (
        <ProjectSelectorMap onPolygonDrawn={handlePolygonDrawn} />
      )}
      
      {mode === 'loading' && (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', height: '100%', backgroundColor: '#f5f5f5' 
        }}>
          <Loader2 size={64} color="#4caf50" className="spinner" />
          <h2 style={{ marginTop: '20px', color: '#333', fontFamily: 'sans-serif' }}>Extracting Urban Data...</h2>
          <p style={{ color: '#666', fontFamily: 'sans-serif' }}>Querying OpenStreetMap via Overpass API</p>
        </div>
      )}

      {mode === 'editing' && geoData && projectBounds && elevationData && (
        <EditorWorkspace 
          geoData={geoData} 
          projectBounds={projectBounds} 
          elevationData={elevationData}
          onClose={handleCloseEditor} 
        />
      )}
    </div>
  );
}

export default App;
