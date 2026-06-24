import React, { useState } from 'react';
import type { ExtractedGeoData, OsmCategory } from '../lib/OverpassApiService';
import type { ElevationData } from '../lib/ElevationService';
import { MapContainer, TileLayer, GeoJSON, LayersControl } from 'react-leaflet';
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
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [visibleLayers, setVisibleLayers] = useState<Set<OsmCategory>>(new Set(['buildings', 'highways', 'cycleways', 'transport', 'water', 'nature']));

  const bbox = turf.bbox(projectBounds);
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const centerLon = (bbox[0] + bbox[2]) / 2;

  const toggleLayer = (cat: OsmCategory) => {
    const next = new Set(visibleLayers);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setVisibleLayers(next);
  };

  return (
    <div className="app-layout">
      <div className="app-sidebar animate-slide-up">
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>Workspace</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ textAlign: 'center' }}>&larr; Back to Selection</button>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button 
              onClick={() => setViewMode('2d')} 
              className={`btn ${viewMode === '2d' ? 'btn-active' : 'btn-secondary'}`}
              style={{ flex: 1 }}
            >
              2D Editor
            </button>
            <button 
              onClick={() => setViewMode('3d')}
              className={`btn ${viewMode === '3d' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
            >
              3D Preview
            </button>
          </div>
        </div>

        <h3 style={{ margin: '10px 0 5px 0', fontSize: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '5px' }}>Visible Layers</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['buildings', 'highways', 'cycleways', 'transport', 'water', 'nature'].map((c) => {
            const cat = c as OsmCategory;
            const count = geoData[cat]?.features?.length || 0;
            return (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-color)' }}>
                <input 
                  type="checkbox" 
                  checked={visibleLayers.has(cat)}
                  onChange={() => toggleLayer(cat)}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                <span style={{ textTransform: 'capitalize', flex: 1 }}>{cat}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{count}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="app-main">
        {viewMode === '2d' ? (
          <MapContainer 
            center={[centerLat, centerLon]} 
            zoom={17} 
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Satellite">
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles &copy; Esri'
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="OpenStreetMap">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {visibleLayers.has('water') && <GeoJSON data={geoData.water} style={{ color: '#0077ff', weight: 2, fillColor: '#0077ff', fillOpacity: 0.5 }} />}
            {visibleLayers.has('nature') && <GeoJSON data={geoData.nature} style={{ color: '#2e7d32', weight: 2, fillColor: '#2e7d32', fillOpacity: 0.5 }} />}
            {visibleLayers.has('transport') && <GeoJSON data={geoData.transport} style={{ color: '#ff9900', weight: 4 }} />}
            {visibleLayers.has('cycleways') && <GeoJSON data={geoData.cycleways} style={{ color: '#00ff00', weight: 4 }} />}
            {visibleLayers.has('highways') && <GeoJSON data={geoData.highways} style={{ color: '#ffeb3b', weight: 4 }} />}
            {visibleLayers.has('buildings') && <GeoJSON data={geoData.buildings} style={{ color: '#f44336', weight: 1, fillColor: '#f44336', fillOpacity: 0.5 }} />}
          </MapContainer>
        ) : (
          <Scene3D 
            geoData={geoData} 
            center={[centerLon, centerLat]} 
            bbox={bbox as [number, number, number, number]} 
            elevationData={elevationData}
            visibleLayers={visibleLayers}
          />
        )}
      </div>
    </div>
  );
};

export default EditorWorkspace;
