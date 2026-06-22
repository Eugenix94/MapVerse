import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

interface ProjectSelectorMapProps {
  onPolygonDrawn: (polygon: GeoJSON.Feature<GeoJSON.Polygon>) => void;
}

const ProjectSelectorMap: React.FC<ProjectSelectorMapProps> = ({ onPolygonDrawn }) => {
  const cataniaCenter: [number, number] = [37.5078, 15.0830];
  const [map, setMap] = useState<L.Map | null>(null);

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
      onPolygonDrawn(geojson);
    });

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
    };
  }, [map, onPolygonDrawn]);

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer 
        center={cataniaCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        ref={setMap}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        />
      </MapContainer>
      
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50px',
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#333' }}>Catania Sandbox</h1>
        <p style={{ margin: 0, color: '#666' }}>Draw a polygon or rectangle on the map to extract the data and enter the Editor Workspace.</p>
      </div>
    </div>
  );
};

export default ProjectSelectorMap;
