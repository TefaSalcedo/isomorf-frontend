'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Euler } from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type {
  BraceElement,
  ColumnElement,
  FootingElement,
  JoistElement,
  GradeBeamElement,
  OpeningElement,
  PileElement,
  ProjectElement,
  RampElement,
  SlabElement,
  StairElement,
  WallElement,
  BeamElement,
} from '@/types/project';

function cmToMeters(value: number): number {
  return value / 100;
}

const SELECT_COLOR = '#22d3ee';

function planCenter(el: ProjectElement): { x: number; z: number } {
  return { x: cmToMeters((el.x1 + el.x2) / 2), z: -cmToMeters((el.y1 + el.y2) / 2) };
}

function planSize(el: ProjectElement): { w: number; d: number } {
  return { w: cmToMeters(Math.abs(el.x2 - el.x1)), d: cmToMeters(Math.abs(el.y2 - el.y1)) };
}

type Selectable = { selected: boolean; onSelect: () => void };

function Mesh({ children, selected, onSelect, ...props }: Selectable & { children: React.ReactNode } & Record<string, unknown>) {
  return (
    <mesh
      castShadow
      receiveShadow
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      {...props}
    >
      {children}
    </mesh>
  );
}

function WallMesh({ wall, selected, onSelect }: { wall: WallElement } & Selectable) {
  const startX = cmToMeters(wall.x1);
  const startZ = -cmToMeters(wall.y1);
  const endX = cmToMeters(wall.x2);
  const endZ = -cmToMeters(wall.y2);
  const x = (startX + endX) / 2;
  const z = (startZ + endZ) / 2;
  const length = Math.hypot(endX - startX, endZ - startZ);
  const height = wall.properties.height ?? 2.5;
  const thickness = wall.properties.thickness ?? 0.15;
  const base = wall.properties.base_elevation ?? 0;

  return (
    <Mesh position={[x, base + height / 2, z]} rotation={[0, wall.rotation, 0]} selected={selected} onSelect={onSelect}>
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color={selected ? SELECT_COLOR : '#64748b'} transparent opacity={0.95} />
    </Mesh>
  );
}

function ColumnMesh({ column, selected, onSelect }: { column: ColumnElement } & Selectable) {
  const x = cmToMeters(column.x1);
  const z = -cmToMeters(column.y1);
  const { width, depth, height, diameter, shape } = column.properties;
  const base = column.properties.base_elevation ?? 0;

  return (
    <Mesh position={[x, base + height / 2, z]} rotation={[0, column.rotation, 0]} selected={selected} onSelect={onSelect}>
      {shape === 'circular' && diameter ? (
        <cylinderGeometry args={[diameter / 2, diameter / 2, height, 24]} />
      ) : (
        <boxGeometry args={[width, height, depth]} />
      )}
      <meshStandardMaterial color={selected ? SELECT_COLOR : '#8b5cf6'} />
    </Mesh>
  );
}

function HorizontalMemberMesh({
  element,
  width,
  height,
  topElevation,
  color,
  selected,
  onSelect,
}: {
  element: ProjectElement;
  width: number;
  height: number;
  topElevation: number;
  color: string;
} & Selectable) {
  const startX = cmToMeters(element.x1);
  const startZ = -cmToMeters(element.y1);
  const endX = cmToMeters(element.x2);
  const endZ = -cmToMeters(element.y2);
  const span = Math.hypot(endX - startX, endZ - startZ);

  return (
    <Mesh
      position={[(startX + endX) / 2, topElevation - height / 2, (startZ + endZ) / 2]}
      rotation={[0, -Math.atan2(endZ - startZ, endX - startX), 0]}
      selected={selected}
      onSelect={onSelect}
    >
      <boxGeometry args={[span, height, width]} />
      <meshStandardMaterial color={selected ? SELECT_COLOR : color} />
    </Mesh>
  );
}

function BraceMesh({ brace, selected, onSelect }: { brace: BraceElement } & Selectable) {
  const { x, z } = planCenter(brace);
  const planLen = cmToMeters(brace.length);
  const { width, depth, bottom_z, top_z } = brace.properties;
  const dz = top_z - bottom_z;
  const len3d = Math.hypot(planLen, dz);
  const yaw = -Math.atan2(-cmToMeters(brace.y2 - brace.y1), cmToMeters(brace.x2 - brace.x1));
  const pitch = Math.atan2(dz, planLen);

  return (
    <Mesh position={[x, (bottom_z + top_z) / 2, z]} rotation={new Euler(0, yaw, pitch, 'YZX')} selected={selected} onSelect={onSelect}>
      <boxGeometry args={[len3d, width, depth]} />
      <meshStandardMaterial color={selected ? SELECT_COLOR : '#fb7185'} />
    </Mesh>
  );
}

function SlabMesh({ slab, selected, onSelect }: { slab: SlabElement } & Selectable) {
  const { x, z } = planCenter(slab);
  const { w, d } = planSize(slab);
  const { thickness, top_elevation } = slab.properties;

  return (
    <Mesh position={[x, top_elevation - thickness / 2, z]} selected={selected} onSelect={onSelect}>
      <boxGeometry args={[w, thickness, d]} />
      <meshStandardMaterial color={selected ? SELECT_COLOR : '#475569'} transparent opacity={0.85} />
    </Mesh>
  );
}

function FootingMesh({ footing, selected, onSelect }: { footing: FootingElement } & Selectable) {
  const { x, z } = planCenter(footing);
  const { w, d } = planSize(footing);
  const { depth, top_elevation } = footing.properties;

  return (
    <Mesh position={[x, top_elevation - depth / 2, z]} selected={selected} onSelect={onSelect}>
      <boxGeometry args={[w, depth, d]} />
      <meshStandardMaterial color={selected ? SELECT_COLOR : '#92400e'} />
    </Mesh>
  );
}

function StairMesh({ stair, selected, onSelect }: { stair: StairElement } & Selectable) {
  const { x, z } = planCenter(stair);
  const { w, d } = planSize(stair);
  const { step_count, tread, riser, base_elevation, run_axis } = stair.properties;
  const axis = run_axis === 'y' ? 'y' : 'x';
  const run = axis === 'x' ? w : d;
  const width = axis === 'x' ? d : w;
  const stepRun = run / step_count;

  return (
    <group position={[x, base_elevation, z]} rotation={[0, axis === 'x' ? 0 : Math.PI / 2, 0]}>
      {Array.from({ length: step_count }, (_, i) => (
        <mesh
          key={i}
          position={[-run / 2 + stepRun * (i + 0.5), riser * (i + 0.5), 0]}
          castShadow
          receiveShadow
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <boxGeometry args={[stepRun || tread, riser, width]} />
          <meshStandardMaterial color={selected ? SELECT_COLOR : '#34d399'} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function RampMesh({ ramp, selected, onSelect }: { ramp: RampElement } & Selectable) {
  const { x, z } = planCenter(ramp);
  const { w, d } = planSize(ramp);
  const { slope_percent, thickness, base_elevation } = ramp.properties;
  const alongX = w >= d;
  const run = alongX ? w : d;
  const width = alongX ? d : w;
  const pitch = Math.atan((slope_percent / 100));
  const lift = run * (slope_percent / 100);

  return (
    <Mesh
      position={[x, base_elevation + lift / 2 + thickness / 2, z]}
      rotation={[0, alongX ? 0 : Math.PI / 2, pitch, 'YZX']}
      selected={selected}
      onSelect={onSelect}
    >
      <boxGeometry args={[Math.hypot(run, lift), thickness, width]} />
      <meshStandardMaterial color={selected ? SELECT_COLOR : '#f472b6'} transparent opacity={0.9} />
    </Mesh>
  );
}

function OpeningMesh({ opening, selected, onSelect }: { opening: OpeningElement } & Selectable) {
  const { x, z } = planCenter(opening);
  const { w, d } = planSize(opening);
  const y = 2.5;
  const h = w / 2;
  const v = d / 2;
  const points = new Float32Array([
    -h, 0, -v, h, 0, -v,
    h, 0, -v, h, 0, v,
    h, 0, v, -h, 0, v,
    -h, 0, v, -h, 0, -v,
  ]);

  return (
    <group position={[x, y, z]}>
      <lineSegments
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={selected ? SELECT_COLOR : '#94a3b8'} />
      </lineSegments>
    </group>
  );
}

function PileMesh({ pile, selected, onSelect }: { pile: PileElement } & Selectable) {
  const x = cmToMeters(pile.x1);
  const z = -cmToMeters(pile.y1);
  const { diameter, pile_length, top_elevation } = pile.properties;

  return (
    <Mesh position={[x, top_elevation - pile_length / 2, z]} selected={selected} onSelect={onSelect}>
      <cylinderGeometry args={[diameter / 2, diameter / 2, pile_length, 20]} />
      <meshStandardMaterial color={selected ? SELECT_COLOR : '#f97316'} />
    </Mesh>
  );
}

function ElementMesh({ element, selectedIds, onSelectElement }: { element: ProjectElement; selectedIds: string[]; onSelectElement?: (id: string) => void }) {
  const props = {
    selected: selectedIds.includes(element.id),
    onSelect: () => onSelectElement?.(element.id),
  };
  switch (element.element_type) {
    case 'wall':
      return <WallMesh wall={element} {...props} />;
    case 'column':
      return <ColumnMesh column={element} {...props} />;
    case 'beam': {
      const p = element.properties;
      return <HorizontalMemberMesh element={element} width={p.width} height={p.height} topElevation={p.top_elevation ?? 2.5} color="#64748b" {...props} />;
    }
    case 'joist': {
      const p = (element as JoistElement).properties;
      return <HorizontalMemberMesh element={element} width={p.width} height={p.height} topElevation={p.top_elevation ?? 2.5} color="#7dd3fc" {...props} />;
    }
    case 'grade_beam': {
      const p = (element as GradeBeamElement).properties;
      return <HorizontalMemberMesh element={element} width={p.width} height={p.height} topElevation={p.top_elevation ?? 0} color="#c4b5fd" {...props} />;
    }
    case 'brace':
      return <BraceMesh brace={element as BraceElement} {...props} />;
    case 'slab':
      return <SlabMesh slab={element as SlabElement} {...props} />;
    case 'footing':
      return <FootingMesh footing={element as FootingElement} {...props} />;
    case 'stair':
      return <StairMesh stair={element as StairElement} {...props} />;
    case 'ramp':
      return <RampMesh ramp={element as RampElement} {...props} />;
    case 'pile':
      return <PileMesh pile={element as PileElement} {...props} />;
    case 'opening':
      return <OpeningMesh opening={element as OpeningElement} {...props} />;
    default:
      return null;
  }
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

export function Model3DPreview({
  elements,
  selectedIds = [],
  onSelectElement,
}: {
  elements: ProjectElement[];
  selectedIds?: string[];
  onSelectElement?: (id: string) => void;
}) {
  const t = useTranslations('editor.canvas');
  const renderable = useMemo(
    () => elements.filter((el) => el.element_type !== 'door' && el.element_type !== 'window'),
    [elements],
  );
  const bounds = useMemo(() => sceneBounds(elements), [elements]);
  const cameraDistance = Math.max(bounds.size * 1.2, 8);
  const cameraY = Math.max(bounds.size * 0.6, 6);

  return (
    <div
      className="relative h-full w-full bg-slate-950"
      role="application"
      aria-label={t('label3d')}
      aria-describedby="canvas-3d-help"
    >
      <p id="canvas-3d-help" className="sr-only">{t('help3d')}</p>
      <p className="sr-only" role="status" aria-live="polite">
        {t('status3d', { elements: elements.length, selected: selectedIds.length })}
      </p>
      <Canvas
        camera={{
          position: [bounds.center.x + cameraDistance, cameraY, bounds.center.z + cameraDistance],
          fov: 45,
        }}
        shadows="percentage"
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[bounds.center.x + 10, cameraY + 10, bounds.center.z + 10]}
          intensity={1.2}
          castShadow
        />
        <gridHelper args={[bounds.size, 20, '#334155', '#1e293b']} position={[bounds.center.x, 0, bounds.center.z]} />
        {renderable.map((element) => (
          <ElementMesh key={element.id} element={element} selectedIds={selectedIds} onSelectElement={onSelectElement} />
        ))}
        <OrbitControls makeDefault target={[bounds.center.x, 1, bounds.center.z]} />
      </Canvas>
    </div>
  );
}
