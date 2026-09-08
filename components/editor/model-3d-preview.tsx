'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ProjectElement, WallElement, ColumnElement } from '@/types/project';

function cmToMeters(value: number): number {
  return value / 100;
}

function wallLengthMeters(wall: WallElement): number {
  return cmToMeters(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1));
}

function WallMesh({ wall }: { wall: WallElement }) {
  const startX = cmToMeters(wall.x1);
  const startZ = -cmToMeters(wall.y1);
  const endX = cmToMeters(wall.x2);
  const endZ = -cmToMeters(wall.y2);
  const x = (startX + endX) / 2;
  const z = (startZ + endZ) / 2;
  const length = wallLengthMeters(wall);
  const height = wall.properties.height ?? 2.5;
  const thickness = wall.properties.thickness ?? 0.15;

  return (
    <mesh position={[x, height / 2, z]} rotation={[0, wall.rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color="#475569" transparent opacity={0.95} />
    </mesh>
  );
}

function ColumnMesh({ column }: { column: ColumnElement }) {
  const x = cmToMeters(column.x1);
  const z = -cmToMeters(column.y1);
  const { width, depth, height } = column.properties;

  return (
    <mesh position={[x, height / 2, z]} rotation={[0, column.rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color="#334155" />
    </mesh>
  );
}

function sceneBounds(elements: ProjectElement[]) {
  if (elements.length === 0) {
    return { center: { x: 0, z: 0 }, size: 20 };
  }
  const xs: number[] = [];
  const zs: number[] = [];
  for (const el of elements) {
    xs.push(cmToMeters(el.x1), cmToMeters(el.x2));
    zs.push(-cmToMeters(el.y1), -cmToMeters(el.y2));
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  const size = Math.max(maxX - minX, maxZ - minZ, 10);
  return { center, size };
}

export function Model3DPreview({ elements }: { elements: ProjectElement[] }) {
  const walls = useMemo(
    () => elements.filter((el) => el.element_type === 'wall') as WallElement[],
    [elements],
  );
  const columns = useMemo(
    () => elements.filter((el) => el.element_type === 'column') as ColumnElement[],
    [elements],
  );
  const bounds = useMemo(() => sceneBounds(elements), [elements]);
  const cameraDistance = Math.max(bounds.size * 1.2, 8);
  const cameraY = Math.max(bounds.size * 0.6, 6);

  return (
    <div className="relative h-full w-full bg-slate-50">
      <Canvas
        camera={{
          position: [bounds.center.x + cameraDistance, cameraY, bounds.center.z + cameraDistance],
          fov: 45,
        }}
        shadows
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[bounds.center.x + 10, cameraY + 10, bounds.center.z + 10]}
          intensity={1.2}
          castShadow
        />
        <gridHelper args={[bounds.size, 20, '#94a3b8', '#e2e8f0']} position={[bounds.center.x, 0, bounds.center.z]} />
        {walls.map((wall) => (
          <WallMesh key={wall.id} wall={wall} />
        ))}
        {columns.map((column) => (
          <ColumnMesh key={column.id} column={column} />
        ))}
        <OrbitControls makeDefault target={[bounds.center.x, 1, bounds.center.z]} />
      </Canvas>
    </div>
  );
}
