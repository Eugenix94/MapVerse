import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { OsmCategory } from '../lib/OverpassApiService';

interface ProjectSelectorMapProps {
  onPolygonDrawn: (polygon: GeoJSON.Feature<GeoJSON.Polygon>, categories: OsmCategory[]) => void;
}

const ProjectSelectorMap: React.FC<ProjectSelectorMapProps> = ({ onPolygonDrawn }) => {
  const cataniaCenter: [number, number] = [37.5078, 15.0830];
  const [map, setMap] = useState<L.Map | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<OsmCategory>>(new Set(['buildings', 'highways', 'nature', 'water', 'transport', 'cycleways']));

  useEffect(() => {
    if (!map) return;

    map.pm.addControls({
      position: 'topright',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
    });

    map.on('pm:create', (e: any) => {
      const layer = e.layer;
      const geojson = layer.toGeoJSON();
      onPolygonDrawn(geojson, Array.from(selectedCategories));
    });

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
    };
  }, [map, selectedCategories, onPolygonDrawn]);

  return (
    <div className="app-layout">
      <div className="app-sidebar animate-slide-up">
        <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>MapVerse Sandbox</h1>
        <p style={{ margin: '0 0 15px 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Draw a polygon or rectangle on the map to extract urban data.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: '10px 0 5px 0', fontSize: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '5px' }}>Features to Extract</h3>
          {['buildings', 'highways', 'cycleways', 'transport', 'water', 'nature'].map(cat => (
             <label key={cat} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-color)' }}>
               <input 
                 type="checkbox" 
                 checked={selectedCategories.has(cat as OsmCategory)}
                 onChange={(e) => {
                   const next = new Set(selectedCategories);
                   if (e.target.checked) next.add(cat as OsmCategory);
                   else next.delete(cat as OsmCategory);
                   setSelectedCategories(next);
                 }}
                 style={{ marginRight: '8px', cursor: 'pointer' }}
               />
               <span style={{ textTransform: 'capitalize' }}>{cat}</span>
             </label>
           ))}
        </div>
      </div>

      <div className="app-main">
        <MapContainer 
          center={cataniaCenter} 
          zoom={15} 
          style={{ height: '100%', width: '100%', zIndex: 1 }}
          ref={setMap}
        >
          <LayersControl position="topleft">
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
        </MapContainer>
      </div>
    </div>
  );
};

export default ProjectSelectorMap;
