import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Points, PointMaterial, Line, Float } from "@react-three/drei";
import * as THREE from "three";

/* ---- helpers ---- */
const cssVar = (n: string, fb: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;

/* ---- background dust for depth ---- */
function Dust({ count = 700 }) {
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(7, 13);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(THREE.MathUtils.randFloatSpread(2));
      p[i * 3 + 0] = r * Math.sin(ph) * Math.cos(th);
      p[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      p[i * 3 + 2] = r * Math.cos(ph);
    }
    return p;
  }, [count]);
  return (
    <group>
      <Points positions={positions} stride={3}>
        <PointMaterial size={0.018} transparent opacity={0.22} depthWrite={false} />
      </Points>
    </group>
  );
}

/* ---- 1) ATOM ORBIT (education/science vibe) ---- */
function AtomOrbit({
  colorNucleus,
  colorElectron,
  position = [-3.2, 0.9, -2] as [number, number, number],
  nucleus = 0.7,
  radius = 1.6,
}: {
  colorNucleus: string;
  colorElectron: string;
  position?: [number, number, number];
  nucleus?: number;
  radius?: number;
}) {
  const g1 = useRef<THREE.Group>(null!);
  const g2 = useRef<THREE.Group>(null!);
  const g3 = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    g1.current.rotation.y = t * 0.8;
    g2.current.rotation.x = t * 1.0;
    g3.current.rotation.z = t * 0.6;
  });

  return (
    <group position={position}>
      {/* nucleus */}
      <mesh>
        <icosahedronGeometry args={[nucleus, 1]} />
        <meshPhysicalMaterial
          color={colorNucleus}
          roughness={0.2}
          metalness={0.3}
          clearcoat={0.6}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* orbit rings (thin, subtle) */}
      {[g1, g2, g3].map((ref, i) => (
        <group ref={ref} key={i}>
          <mesh rotation={[i === 0 ? 0 : Math.PI / 2, 0, i === 2 ? Math.PI / 2 : 0]}>
            <torusGeometry args={[radius, 0.01, 8, 64]} />
            <meshBasicMaterial color={colorElectron} transparent opacity={0.35} />
          </mesh>
          {/* electron */}
          <mesh position={[radius, 0, 0]}>
            <sphereGeometry args={[0.12, 24, 24]} />
            <meshStandardMaterial color={colorElectron} emissive={new THREE.Color(colorElectron).multiplyScalar(0.15)} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---- 2) NETWORK GRAPH (skills/people graph) ---- */
function NetworkGraph({
  colorNode,
  colorLink,
  position = [3.2, 1.0, -2.5] as [number, number, number],
  nodes = 12,
}: {
  colorNode: string;
  colorLink: string;
  position?: [number, number, number];
  nodes?: number;
}) {
  const pts = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < nodes; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const r = 1.6 + Math.random() * 0.6;
      arr.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r));
    }
    return arr;
  }, [nodes]);

  // connect each node to its nearest 2 neighbors
  const edges = useMemo(() => {
    const lines: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < pts.length; i++) {
      const distances = pts.map((p, j) => ({ j, d: i === j ? Infinity : pts[i].distanceTo(p) }));
      distances.sort((a, b) => a.d - b.d);
      for (let k = 0; k < 2; k++) lines.push([pts[i], pts[distances[k].j]]);
    }
    return lines;
  }, [pts]);

  // gentle rotation
  const grp = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => (grp.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.2) * 0.15));

  return (
    <group position={position} ref={grp}>
      {edges.map(([a, b], i) => (
        <Line key={i} points={[a, b]} color={colorLink} lineWidth={1} transparent opacity={0.35} />
      ))}
      {pts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={colorNode} emissive={new THREE.Color(colorNode).multiplyScalar(0.1)} />
        </mesh>
      ))}
    </group>
  );
}

/* ---- 3) LAYERED SHEETS (resume/portfolio pages) ---- */
function LayeredSheets({
  color = "#ffffff",
  position = [-2.6, -1.8, -2.2] as [number, number, number],
}: {
  color?: string;
  position?: [number, number, number];
}) {
  const rot = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    rot.current.rotation.z = Math.sin(t * 0.25) * 0.06;
  });

  return (
    <group position={position} ref={rot}>
      {[0, 1, 2].map((i) => (
        <Float key={i} speed={1} rotationIntensity={0.2} floatIntensity={0.2}>
          <mesh position={[i * 0.18, i * 0.16, -i * 0.06]} rotation={[-0.15, 0.25, -0.2]}>
            <boxGeometry args={[2.2, 1.3, 0.02]} />
            <meshPhysicalMaterial
              color={color}
              roughness={0.35}
              metalness={0.1}
              clearcoat={0.6}
              transparent
              opacity={0.18}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

/* ---- SCENE ---- */
export default function R3FScene() {
  const orange = cssVar("--accent-orange", "#fb923c");
  const blue = cssVar("--accent-blue", "#60a5fa");
  const purple = cssVar("--accent-purple", "#c084fc");

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 11], fov: 52 }}>
      <Suspense fallback={null}>
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 6, 6]} intensity={0.8} />
        <Environment preset="city" />

        {/* education/scientific/job-search motifs */}
        <AtomOrbit colorNucleus={orange} colorElectron={orange} />
        <NetworkGraph colorNode={blue} colorLink={blue} />
        <LayeredSheets color={purple} />

        <Dust count={800} />
      </Suspense>
    </Canvas>
  );
}
