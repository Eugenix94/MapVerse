import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, useTexture } from '@react-three/drei';
import { Suspense } from 'react';
import * as THREE from 'three';
import type { ExtractedGeoData } from '../lib/OverpassApiService';
import * as d3 from 'd3-geo';

interface Scene3DProps {
  geoData: ExtractedGeoData;
  center: [number, number]; // [lon, lat]
  bbox: [number, number, number, number];
}

const BuildingMesh = ({ feature, projection }: { feature: any; projection: d3.GeoProjection }) => {
  const geometry = useMemo(() => {
    if (!feature.geometry) return null;
    
    let coordinates = [];
    if (feature.geometry.type === 'Polygon') {
        coordinates = feature.geometry.coordinates[0];
    } else if (feature.geometry.type === 'MultiPolygon') {
        coordinates = feature.geometry.coordinates[0][0]; // naive for MVP
    } else {
        return null;
    }

    let height = 10; // default
    if (feature.properties?.height) {
      height = parseFloat(feature.properties.height);
    } else if (feature.properties?.['building:levels']) {
      height = parseFloat(feature.properties['building:levels']) * 3; // ~3m per level
    }

    const shape = new THREE.Shape();
    coordinates.forEach((coord: number[], index: number) => {
      const projected = projection(coord as [number, number]);
      if (projected) {
        if (index === 0) shape.moveTo(projected[0], -projected[1]); // -y because projection Y goes down
        else shape.lineTo(projected[0], -projected[1]);
      }
    });

    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.rotateX(-Math.PI / 2); // Rotate so depth is up (Y axis)
    
    return geom;

  }, [feature, projection]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#eeeeee" roughness={0.8} />
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#333333" />
      </lineSegments>
    </mesh>
  );
};

const RoadMesh = ({ feature, projection }: { feature: any; projection: d3.GeoProjection }) => {
    // Simple road rendering as lines for MVP
    const geometry = useMemo(() => {
        if (!feature.geometry || feature.geometry.type !== 'LineString') return null;
        
        const points: THREE.Vector3[] = [];
        feature.geometry.coordinates.forEach((coord: number[]) => {
            const projected = projection(coord as [number, number]);
            if (projected) {
                points.push(new THREE.Vector3(projected[0], 0.1, -projected[1]));
            }
        });
        
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [feature, projection]);

    if (!geometry) return null;

    return (
        <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffeb3b, linewidth: 3 }))} />
    );
};

const GroundPlane = ({ bbox, projection }: { bbox: [number, number, number, number], projection: d3.GeoProjection }) => {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const topLeft = projection([minLon, maxLat]);
    const bottomRight = projection([maxLon, minLat]);
    
    if (!topLeft || !bottomRight) return null;

    const width = bottomRight[0] - topLeft[0];
    const height = bottomRight[1] - topLeft[1];

    // Esri World Imagery Export URL
    // size is width, height in pixels (1024x1024 for sharp texture)
    const imageUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&imageSR=3857&size=1024,1024&format=jpg&f=image`;
    
    const texture = useTexture(imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial map={texture} />
        </mesh>
    );
};

const Scene3D: React.FC<Scene3DProps> = ({ geoData, center, bbox }) => {
  // Use a pseudo-mercator projection tailored to our center point.
  // We scale it so 1 unit is roughly 1 meter.
  // Mercator scale factor at latitude: scale = R * cos(lat)
  // For d3-geo, a scale of roughly 6378137 (Earth radius in meters) gives us ~1 unit = 1 meter at equator.
  // We need to divide by Math.cos(center[1] * Math.PI / 180) for local accuracy.
  
  const projection = useMemo(() => {
    const scale = 6378137 / (2 * Math.PI) / Math.cos(center[1] * Math.PI / 180);
    return d3.geoMercator()
      .center(center)
      .scale(scale)
      .translate([0, 0]);
  }, [center]);

  return (
    <Canvas camera={{ position: [0, 100, 100], fov: 60 }} style={{ background: '#87CEEB' }}>
      <Sky sunPosition={[100, 20, 100]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[50, 100, 50]} intensity={1.5} castShadow />
      
      {/* Ground plane with Satellite Imagery */}
      <Suspense fallback={
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#4caf50" />
        </mesh>
      }>
        <GroundPlane bbox={bbox} projection={projection} />
      </Suspense>

      <group>
        {geoData.buildings.features.map((feature, i) => (
          <BuildingMesh key={`bldg-${i}`} feature={feature} projection={projection} />
        ))}
        {geoData.highways.features.map((feature, i) => (
          <RoadMesh key={`road-${i}`} feature={feature} projection={projection} />
        ))}
      </group>

      <OrbitControls makeDefault />
    </Canvas>
  );
};

export default Scene3D;
