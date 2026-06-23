import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, useTexture, Line, Html, BakeShadows } from '@react-three/drei';
import { Suspense } from 'react';
import * as THREE from 'three';
import type { ExtractedGeoData } from '../lib/OverpassApiService';
import type { ElevationData } from '../lib/ElevationService';
import { ElevationService } from '../lib/ElevationService';
import * as d3 from 'd3-geo';
import * as turf from '@turf/turf';

interface Scene3DProps {
  geoData: ExtractedGeoData;
  center: [number, number]; // [lon, lat]
  bbox: [number, number, number, number];
  elevationData: ElevationData;
}

const BuildingMesh = ({ feature, projection, elevationData, bbox }: { feature: any; projection: d3.GeoProjection; elevationData: ElevationData; bbox: [number, number, number, number] }) => {
  const [hovered, setHovered] = useState(false);
  
  const center = useMemo(() => {
    try {
        const centerPoint = turf.center(feature);
        return centerPoint.geometry.coordinates as [number, number];
    } catch (e) {
        return feature.geometry.coordinates[0][0] as [number, number];
    }
  }, [feature]);

  const baseElevation = useMemo(() => {
    return ElevationService.getInterpolatedElevation(center[0], center[1], bbox, elevationData);
  }, [center, bbox, elevationData]);

  const { geometry, height, levels, projectedCenter } = useMemo(() => {
    if (!feature.geometry) return { geometry: null, height: 10, levels: 'Unknown', projectedCenter: [0,0,0] };
    
    let coordinates = [];
    if (feature.geometry.type === 'Polygon') {
        coordinates = feature.geometry.coordinates[0];
    } else if (feature.geometry.type === 'MultiPolygon') {
        coordinates = feature.geometry.coordinates[0][0]; // naive for MVP
    } else {
        return { geometry: null, height: 10, levels: 'Unknown', projectedCenter: [0,0,0] };
    }

    let h = 10;
    let l = 'Unknown';
    if (feature.properties?.height) {
      h = parseFloat(feature.properties.height);
    } else if (feature.properties?.['building:levels']) {
      l = feature.properties['building:levels'];
      h = parseFloat(l) * 3; // ~3m per level
    }

    const shape = new THREE.Shape();
    coordinates.forEach((coord: number[], index: number) => {
      const projected = projection(coord as [number, number]);
      if (projected) {
        if (index === 0) shape.moveTo(projected[0], -projected[1]);
        else shape.lineTo(projected[0], -projected[1]);
      }
    });

    const extrudeSettings = {
      depth: h,
      bevelEnabled: false,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.rotateX(-Math.PI / 2); // Rotate so depth is up (Y axis)
    
    const pCenter = projection(center);
    const pC = pCenter ? [pCenter[0], h + 2, -pCenter[1]] : [0, h + 2, 0];

    return { geometry: geom, height: h, levels: l, projectedCenter: pC };

  }, [feature, projection, center]);

  const color = useMemo(() => {
    // Subtle color variation based on height
    const v = Math.min(255, 150 + height * 1.5);
    return new THREE.Color(`rgb(${Math.floor(v)}, ${Math.floor(v)}, ${Math.floor(v)})`);
  }, [height]);

  if (!geometry) return null;

  return (
    <mesh 
      geometry={geometry} 
      position={[0, baseElevation, 0]} 
      castShadow 
      receiveShadow
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial 
        color={hovered ? '#4caf50' : color} 
        roughness={0.7} 
        metalness={0.2}
        emissive={hovered ? '#2e7d32' : '#000000'}
      />
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color={hovered ? '#ffffff' : '#444444'} linewidth={1} />
      </lineSegments>
      {hovered && (
        <Html position={projectedCenter as [number, number, number]} center zIndexRange={[100, 0]}>
          <div className="glass-panel" style={{ padding: '8px 12px', color: 'white', whiteSpace: 'nowrap', fontSize: '13px', pointerEvents: 'none' }}>
            <strong style={{ color: '#4caf50' }}>{feature.properties?.name || 'Building'}</strong><br/>
            <span style={{ color: '#ccc' }}>Height: {height}m</span><br/>
            <span style={{ color: '#ccc' }}>Levels: {levels}</span>
          </div>
        </Html>
      )}
    </mesh>
  );
};

const GenericLineMesh = ({ feature, projection, elevationData, bbox, color, lineWidth }: { feature: any; projection: d3.GeoProjection; elevationData: ElevationData; bbox: [number, number, number, number], color: string, lineWidth: number }) => {
    const points = useMemo(() => {
        if (!feature.geometry || feature.geometry.type !== 'LineString') return null;
        
        const pts: THREE.Vector3[] = [];
        feature.geometry.coordinates.forEach((coord: number[]) => {
            const projected = projection(coord as [number, number]);
            if (projected) {
                const elev = ElevationService.getInterpolatedElevation(coord[0], coord[1], bbox, elevationData);
                pts.push(new THREE.Vector3(projected[0], elev + 0.5, -projected[1]));
            }
        });
        
        return pts;
    }, [feature, projection, elevationData, bbox]);

    if (!points || points.length < 2) return null;

    return (
      <Line 
        points={points} 
        color={color} 
        lineWidth={lineWidth} 
        dashed={false} 
        transparent 
        opacity={0.8} 
      />
    );
};

const FlatPolygonMesh = ({ feature, projection, elevationData, bbox, color, heightOffset = 0.2 }: any) => {
    const { geometry, centerElevation } = useMemo(() => {
        if (!feature.geometry) return { geometry: null, centerElevation: 0 };
        
        let coordinates = [];
        if (feature.geometry.type === 'Polygon') {
            coordinates = feature.geometry.coordinates[0];
        } else if (feature.geometry.type === 'MultiPolygon') {
            coordinates = feature.geometry.coordinates[0][0]; // MVP
        } else {
            return { geometry: null, centerElevation: 0 };
        }

        const shape = new THREE.Shape();
        coordinates.forEach((coord: number[], index: number) => {
            const projected = projection(coord as [number, number]);
            if (projected) {
                if (index === 0) shape.moveTo(projected[0], -projected[1]);
                else shape.lineTo(projected[0], -projected[1]);
            }
        });

        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(-Math.PI / 2);

        let center = [0,0];
        try { center = turf.center(feature).geometry.coordinates as [number, number]; } catch(e){}
        const elev = ElevationService.getInterpolatedElevation(center[0], center[1], bbox, elevationData);

        return { geometry: geom, centerElevation: elev };
    }, [feature, projection, bbox, elevationData]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} position={[0, centerElevation + heightOffset, 0]} receiveShadow>
            <meshStandardMaterial color={color} roughness={0.8} transparent opacity={0.8} />
        </mesh>
    );
};

const GroundPlane = ({ bbox, projection, elevationData }: { bbox: [number, number, number, number], projection: d3.GeoProjection, elevationData: ElevationData }) => {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const topLeft = projection([minLon, maxLat]);
    const bottomRight = projection([maxLon, minLat]);
    
    if (!topLeft || !bottomRight) return null;

    const width = bottomRight[0] - topLeft[0];
    const height = bottomRight[1] - topLeft[1];

    const geometry = useMemo(() => {
        const [gridWidth, gridHeight] = elevationData.gridSize;
        const geom = new THREE.PlaneGeometry(width, height, gridWidth - 1, gridHeight - 1);
        
        const positions = geom.attributes.position.array;
        for (let i = 0; i < elevationData.elevations.length; i++) {
            positions[i * 3 + 2] = elevationData.elevations[i];
        }
        geom.computeVertexNormals();
        return geom;
    }, [width, height, elevationData]);

    const imageUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&imageSR=3857&size=1024,1024&format=jpg&f=image`;
    
    const texture = useTexture(imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <primitive object={geometry} attach="geometry" />
            <meshStandardMaterial map={texture} roughness={0.9} />
        </mesh>
    );
};

const Scene3D: React.FC<Scene3DProps> = ({ geoData, center, bbox, elevationData }) => {
  const projection = useMemo(() => {
    const scale = 6378137 / (2 * Math.PI) / Math.cos(center[1] * Math.PI / 180);
    return d3.geoMercator()
      .center(center)
      .scale(scale)
      .translate([0, 0]);
  }, [center]);

  return (
    <Canvas shadows camera={{ position: [0, 150, 150], fov: 60 }} style={{ background: '#121212' }}>
      <BakeShadows />
      <Sky sunPosition={[100, 20, 100]} turbidity={0.3} rayleigh={0.5} />
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[100, 200, 100]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-camera-far={1000} 
        shadow-camera-left={-300} 
        shadow-camera-right={300} 
        shadow-camera-top={300} 
        shadow-camera-bottom={-300} 
      />
      
      <Suspense fallback={
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      }>
        <GroundPlane bbox={bbox} projection={projection} elevationData={elevationData} />
      </Suspense>

      <group>
        {geoData.buildings.features.map((feature, i) => (
          <BuildingMesh key={`bldg-${i}`} feature={feature} projection={projection} elevationData={elevationData} bbox={bbox} />
        ))}
        {geoData.highways.features.map((feature, i) => (
          <GenericLineMesh key={`road-${i}`} feature={feature} projection={projection} elevationData={elevationData} bbox={bbox} color="#00e5ff" lineWidth={2} />
        ))}
        {geoData.cycleways.features.map((feature, i) => (
          <GenericLineMesh key={`cycle-${i}`} feature={feature} projection={projection} elevationData={elevationData} bbox={bbox} color="#00ff00" lineWidth={3} />
        ))}
        {geoData.transport.features.map((feature, i) => (
          <GenericLineMesh key={`trans-${i}`} feature={feature} projection={projection} elevationData={elevationData} bbox={bbox} color="#ff9900" lineWidth={4} />
        ))}
        {geoData.water.features.map((feature, i) => {
           if (feature.geometry.type === 'LineString') return <GenericLineMesh key={`wline-${i}`} feature={feature} projection={projection} elevationData={elevationData} bbox={bbox} color="#0077ff" lineWidth={5} />;
           return <FlatPolygonMesh key={`wpoly-${i}`} feature={feature} projection={projection} elevationData={elevationData} bbox={bbox} color="#0077ff" heightOffset={0.3} />;
        })}
        {geoData.nature.features.map((feature, i) => {
           if (feature.geometry?.type === 'LineString') return null; // Only render polygons for nature
           return <FlatPolygonMesh key={`npoly-${i}`} feature={feature} projection={projection} elevationData={elevationData} bbox={bbox} color="#2e7d32" heightOffset={0.2} />;
        })}
      </group>

      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  );
};

export default Scene3D;
