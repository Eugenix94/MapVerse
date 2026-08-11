import React, { useState } from 'react';
import type { ExtractedGeoData, OsmCategory } from '../lib/OverpassApiService';
import { isSpecialBuilding } from '../lib/OverpassApiService';
import type { ElevationData } from '../lib/ElevationService';
import { MapContainer, TileLayer, GeoJSON, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import Scene3D from './Scene3D';
import * as turf from '@turf/turf';

// Fix Leaflet marker icon asset paths under Vite bundling
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface EditorWorkspaceProps {
  geoData: ExtractedGeoData;
  projectBounds: GeoJSON.Feature<GeoJSON.Polygon>;
  elevationData: ElevationData;
  onClose: () => void;
}

const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ geoData, projectBounds, elevationData, onClose }) => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [visibleLayers, setVisibleLayers] = useState<Set<OsmCategory>>(new Set(['buildings', 'schools', 'bus_stops', 'highways', 'cycleways', 'transport', 'water', 'nature']));

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
          {['buildings', 'schools', 'bus_stops', 'highways', 'cycleways', 'transport', 'water', 'nature'].map((c) => {
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

        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>LEGEND</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', background: '#ffd600', borderRadius: '2px', border: '1px solid #ff6d00', display: 'inline-block' }}></span>
              <span style={{ fontWeight: 600, color: '#ffd600' }}>⭐ Special Landmarks / Named</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', background: '#f44336', borderRadius: '2px', display: 'inline-block' }}></span>
              <span>Standard Buildings</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', background: '#ff1744', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>Schools</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', background: '#9c27b0', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>Bus Stops & Transit</span>
            </div>
          </div>
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

            {visibleLayers.has('water') && (
              <GeoJSON 
                data={geoData.water} 
                style={{ color: '#0077ff', weight: 2, fillColor: '#0077ff', fillOpacity: 0.5 }}
                pointToLayer={(_feature, latlng) => L.circleMarker(latlng, { radius: 6, fillColor: '#0077ff', color: '#ffffff', weight: 1.5, fillOpacity: 0.8 })}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.name || 'Water Feature';
                  layer.bindPopup(`<strong>${name}</strong><br/>Category: Water`);
                }}
              />
            )}
            {visibleLayers.has('nature') && (
              <GeoJSON 
                data={geoData.nature} 
                style={{ color: '#2e7d32', weight: 2, fillColor: '#2e7d32', fillOpacity: 0.5 }}
                pointToLayer={(_feature, latlng) => L.circleMarker(latlng, { radius: 6, fillColor: '#2e7d32', color: '#ffffff', weight: 1.5, fillOpacity: 0.8 })}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.name || 'Natural Feature';
                  layer.bindPopup(`<strong>${name}</strong><br/>Category: Nature/Park`);
                }}
              />
            )}
            {visibleLayers.has('transport') && (
              <GeoJSON 
                data={geoData.transport} 
                style={{ color: '#ff9900', weight: 4 }}
                pointToLayer={(_feature, latlng) => L.circleMarker(latlng, { radius: 6, fillColor: '#ff9900', color: '#ffffff', weight: 1.5, fillOpacity: 0.8 })}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.name || 'Transit Feature';
                  layer.bindPopup(`<strong>${name}</strong><br/>Category: Transport`);
                }}
              />
            )}
            {visibleLayers.has('cycleways') && (
              <GeoJSON 
                data={geoData.cycleways} 
                style={{ color: '#00ff00', weight: 4 }}
                pointToLayer={(_feature, latlng) => L.circleMarker(latlng, { radius: 5, fillColor: '#00ff00', color: '#ffffff', weight: 1.5, fillOpacity: 0.8 })}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.name || 'Cycle Path Feature';
                  layer.bindPopup(`<strong>${name}</strong><br/>Category: Cycleway`);
                }}
              />
            )}
            {visibleLayers.has('highways') && (
              <GeoJSON 
                data={geoData.highways} 
                style={{ color: '#ffeb3b', weight: 4 }}
                pointToLayer={(_feature, latlng) => L.circleMarker(latlng, { radius: 5, fillColor: '#ffeb3b', color: '#ffffff', weight: 1.5, fillOpacity: 0.8 })}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.name || 'Road Feature';
                  layer.bindPopup(`<strong>${name}</strong><br/>Category: Highway`);
                }}
              />
            )}
            {visibleLayers.has('buildings') && (
              <GeoJSON 
                data={geoData.buildings} 
                style={(feature) => {
                  const special = isSpecialBuilding(feature);
                  return {
                    color: special ? '#ff6d00' : '#f44336',
                    weight: special ? 3 : 1,
                    fillColor: special ? '#ffeb3b' : '#f44336',
                    fillOpacity: special ? 0.85 : 0.5
                  };
                }}
                pointToLayer={(feature, latlng) => {
                  const special = isSpecialBuilding(feature);
                  return L.circleMarker(latlng, { 
                    radius: special ? 7.5 : 5, 
                    fillColor: special ? '#ffeb3b' : '#f44336', 
                    color: special ? '#ff6d00' : '#ffffff', 
                    weight: special ? 2 : 1.5, 
                    fillOpacity: 0.9 
                  });
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties || {};
                  const name = p.name || p.operator || (p.building && p.building !== 'yes' ? `Building: ${p.building}` : 'Building');
                  const isSpecial = isSpecialBuilding(feature);
                  if (isSpecial && (p.name || p.building)) {
                    layer.bindTooltip(`<strong>${name}</strong>`, { permanent: false, direction: 'top', className: 'special-building-tooltip' });
                  }
                  layer.bindPopup(`<strong>${name}</strong><br/>Category: ${isSpecial ? `⭐ Special Landmark (${p.building || 'general'})` : 'Standard Building'}`);
                }}
              />
            )}
            {visibleLayers.has('schools') && (
              <GeoJSON 
                data={geoData.schools} 
                style={{ color: '#ff1744', weight: 2, fillColor: '#ff1744', fillOpacity: 0.8 }}
                pointToLayer={(_feature, latlng) => {
                  return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: '#ff1744',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                  });
                }}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.name || 'School / Educational Institution';
                  layer.bindPopup(`<strong>${name}</strong><br/>Type: School`);
                }}
              />
            )}
            {visibleLayers.has('bus_stops') && (
              <GeoJSON 
                data={geoData.bus_stops} 
                style={{ color: '#9c27b0', weight: 2, fillColor: '#9c27b0', fillOpacity: 0.8 }}
                pointToLayer={(_feature, latlng) => {
                  return L.circleMarker(latlng, {
                    radius: 7,
                    fillColor: '#9c27b0',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                  });
                }}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.name || 'Bus Stop / Transit Station';
                  layer.bindPopup(`<strong>${name}</strong><br/>Type: Bus Stop / Transit`);
                }}
              />
            )}
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
