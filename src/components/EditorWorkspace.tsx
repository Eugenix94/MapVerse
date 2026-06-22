import React, { useState } from 'react';
import type { ExtractedGeoData } from '../lib/OverpassApiService';
import type { ElevationData } from '../lib/ElevationService';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Scene3D from './Scene3D';
import * as turf from '@turf/turf';

interface EditorWorkspaceProps {
  geoData: ExtractedGeoData;
  projectBounds: GeoJSON.Feature<GeoJSON.Polygon>;
  elevationData: ElevationData;
  onClose: () => void;
}

const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ geoData, projectBounds, elevationData, onClose }) => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  const bbox = turf.bbox(projectBounds);
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const centerLon = (bbox[0] + bbox[2]) / 2;

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '8px'
  };

  const inactiveButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#555'
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '15px', backgroundColor: '#222', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={onClose} style={buttonStyle}>&larr; Back to Selection</button>
          <span style={{ marginLeft: '15px', fontWeight: 'bold' }}>
            Editor Workspace ({geoData.buildings.features.length} Buildings, {geoData.highways.features.length} Roads)
          </span>
        </div>
        <div>
          <button 
            onClick={() => setViewMode('2d')} 
            style={viewMode === '2d' ? buttonStyle : inactiveButtonStyle}
          >
            2D Editor
          </button>
          <button 
            onClick={() => setViewMode('3d')}
            style={viewMode === '3d' ? buttonStyle : inactiveButtonStyle}
          >
            3D Preview
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {viewMode === '2d' ? (
          <MapContainer 
            center={[centerLat, centerLon]} 
            zoom={17} 
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; Esri'
            />
            {/* Render HighWays (Roads) */}
            <GeoJSON 
              data={geoData.highways} 
              style={{ color: '#ffeb3b', weight: 4 }} 
            />
            {/* Render Buildings */}
            <GeoJSON 
              data={geoData.buildings} 
              style={{ color: '#f44336', weight: 1, fillColor: '#f44336', fillOpacity: 0.5 }} 
            />
          </MapContainer>
        ) : (
          <Scene3D 
            geoData={geoData} 
            center={[centerLon, centerLat]} 
            bbox={bbox as [number, number, number, number]} 
            elevationData={elevationData}
          />
        )}
      </div>
    </div>
  );
};

export default EditorWorkspace;
