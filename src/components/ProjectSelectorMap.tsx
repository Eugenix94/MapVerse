import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { OsmCategory } from '../lib/OverpassApiService';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface ProjectSelectorMapProps {
  onPolygonDrawn: (polygon: GeoJSON.Feature<GeoJSON.Polygon>, categories: OsmCategory[]) => void;
}

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    satellite: {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Esri'
    },
    terrain: {
      type: 'raster-dem' as const,
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      encoding: 'terrarium' as const,
      tileSize: 256,
      bounds: [-180, -85, 180, 85] as [number, number, number, number]
    }
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster' as const,
      source: 'satellite'
    }
  ],
  terrain: {
    source: 'terrain',
    exaggeration: 1.5
  }
};

const ProjectSelectorMap: React.FC<ProjectSelectorMapProps> = ({ onPolygonDrawn }) => {
  const cataniaCenter: [number, number] = [37.5078, 15.0830];
  const [map, setMap] = useState<L.Map | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<OsmCategory>>(new Set(['buildings', 'schools', 'bus_stops', 'highways', 'nature', 'water', 'transport', 'cycleways']));
  const [sandboxViewMode, setSandboxViewMode] = useState<'2d' | '3d'>('2d');
  
  // Track map view state for sync between 2D Leaflet and 3D MapLibre
  const [mapCenter, setMapCenter] = useState<[number, number]>(cataniaCenter);
  const [mapZoom, setMapZoom] = useState<number>(15);

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

    const onMove = () => {
      const center = map.getCenter();
      setMapCenter([center.lat, center.lng]);
      setMapZoom(map.getZoom());
    };
    map.on('moveend', onMove);

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
      map.off('moveend', onMove);
    };
  }, [map, selectedCategories, onPolygonDrawn]);

  return (
    <div className="app-layout">
      <div className="app-sidebar animate-slide-up">
        <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>MapVerse Sandbox</h1>
        <p style={{ margin: '0 0 15px 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Draw a polygon or rectangle on the map to extract urban data.</p>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button 
            onClick={() => setSandboxViewMode('2d')} 
            className={`btn ${sandboxViewMode === '2d' ? 'btn-active' : 'btn-secondary'}`}
            style={{ flex: 1 }}
          >
            2D Map
          </button>
          <button 
            onClick={() => setSandboxViewMode('3d')}
            className={`btn ${sandboxViewMode === '3d' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
          >
            3D Globe
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: '10px 0 5px 0', fontSize: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '5px' }}>Features to Extract</h3>
          {['buildings', 'schools', 'bus_stops', 'highways', 'cycleways', 'transport', 'water', 'nature'].map(cat => (
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
        {sandboxViewMode === '2d' ? (
          <MapContainer 
            center={mapCenter} 
            zoom={mapZoom} 
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
        ) : (
          <div style={{ width: '100%', height: '100%', cursor: 'grab', background: '#000', position: 'relative' }}>
            <Map
              initialViewState={{
                longitude: mapCenter[1],
                latitude: mapCenter[0],
                zoom: mapZoom,
                pitch: 45,
                bearing: 0
              }}
              onMove={evt => {
                setMapCenter([evt.viewState.latitude, evt.viewState.longitude]);
                setMapZoom(evt.viewState.zoom);
              }}
              mapLib={maplibregl}
              mapStyle={MAP_STYLE}
              style={{ width: '100%', height: '100%' }}
              maxPitch={85}
              terrain={{ source: 'terrain', exaggeration: 1.5 }}
            />
            <div style={{ position: 'absolute', bottom: '20px', width: '100%', textAlign: 'center', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', pointerEvents: 'none', zIndex: 10 }}>
              Use Right-Click + Drag or Ctrl + Drag to inspect slopes. Switch back to the 2D Map to draw an extraction polygon.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSelectorMap;
