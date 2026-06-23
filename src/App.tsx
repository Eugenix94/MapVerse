import { useState } from 'react';
import ProjectSelectorMap from './components/ProjectSelectorMap';
import EditorWorkspace from './components/EditorWorkspace';
import { OverpassApiService } from './lib/OverpassApiService';
import type { ExtractedGeoData, OsmCategory } from './lib/OverpassApiService';
import { ElevationService } from './lib/ElevationService';
import type { ElevationData } from './lib/ElevationService';
import * as turf from '@turf/turf';
import './App.css';

function App() {
  const [mode, setMode] = useState<'selecting' | 'loading' | 'editing'>('selecting');
  const [projectBounds, setProjectBounds] = useState<GeoJSON.Feature<GeoJSON.Polygon> | null>(null);
  const [geoData, setGeoData] = useState<ExtractedGeoData | null>(null);
  const [elevationData, setElevationData] = useState<ElevationData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePolygonDrawn = async (polygon: GeoJSON.Feature<GeoJSON.Polygon>, categories: OsmCategory[]) => {
    setProjectBounds(polygon);
    setMode('loading');
    
    try {
      const bbox = turf.bbox(polygon) as [number, number, number, number];
      const [data, elevData] = await Promise.all([
        OverpassApiService.fetchFeaturesForPolygon(polygon, categories),
        ElevationService.fetchElevationGrid(bbox)
      ]);
      setGeoData(data);
      setElevationData(elevData);
      setMode('editing');
    } catch (error) {
      console.error("Failed to fetch data:", error);
      showToast("Failed to fetch data from Overpass API. See console for details.");
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
    <div style={{ width: '100vw', height: '100dvh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      {mode === 'selecting' && (
        <div className="animate-fade-in" style={{ height: '100%' }}>
          <ProjectSelectorMap onPolygonDrawn={handlePolygonDrawn} />
        </div>
      )}
      
      {mode === 'loading' && (
        <div className="loading-container animate-fade-in">
          <div className="loading-card glass-panel">
            <div className="loading-spinner"></div>
            <h2 className="loading-title">Extracting Urban Data</h2>
            <p className="loading-subtitle">Querying OpenStreetMap & Elevation API...</p>
          </div>
        </div>
      )}

      {mode === 'editing' && geoData && projectBounds && elevationData && (
        <div className="animate-fade-in" style={{ height: '100%' }}>
          <EditorWorkspace 
            geoData={geoData} 
            projectBounds={projectBounds} 
            elevationData={elevationData}
            onClose={handleCloseEditor} 
          />
        </div>
      )}

      {toastMessage && (
        <div className="toast-container">
          <div className="toast">{toastMessage}</div>
        </div>
      )}
    </div>
  );
}

export default App;
