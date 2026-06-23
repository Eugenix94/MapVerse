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



  return (
    <div style={{ height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="editor-toolbar glass-panel animate-slide-up">
        <div className="toolbar-stats">
          <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>
            Editor Workspace
          </span>
          <br/>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {geoData.buildings.features.length} Buildings, {geoData.highways.features.length} Roads, {geoData.cycleways.features.length} Cycleways, {geoData.transport.features.length} Transport, {geoData.water.features.length} Water, {geoData.nature.features.length} Nature
          </span>
        </div>
        <div className="toolbar-actions">
          <button onClick={onClose} className="btn btn-secondary">&larr; Back</button>
          <button 
            onClick={() => setViewMode('2d')} 
            className={`btn ${viewMode === '2d' ? 'btn-active' : 'btn-secondary'}`}
          >
            2D Editor
          </button>
          <button 
            onClick={() => setViewMode('3d')}
            className={`btn ${viewMode === '3d' ? 'btn-primary' : 'btn-secondary'}`}
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
            {/* Render Water */}
            <GeoJSON 
              data={geoData.water} 
              style={{ color: '#0077ff', weight: 2, fillColor: '#0077ff', fillOpacity: 0.5 }} 
            />
            {/* Render Nature */}
            <GeoJSON 
              data={geoData.nature} 
              style={{ color: '#2e7d32', weight: 2, fillColor: '#2e7d32', fillOpacity: 0.5 }} 
            />
            {/* Render Transport */}
            <GeoJSON 
              data={geoData.transport} 
              style={{ color: '#ff9900', weight: 4 }} 
            />
            {/* Render Cycleways */}
            <GeoJSON 
              data={geoData.cycleways} 
              style={{ color: '#00ff00', weight: 4 }} 
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
