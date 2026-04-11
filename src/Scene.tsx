import { Float, Line, Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type SceneProps = {
  progress: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, alpha: number) => THREE.MathUtils.lerp(from, to, alpha);
const noise = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
};

const range = (progress: number, start: number, end: number) => clamp((progress - start) / (end - start));
const smooth = (value: number) => value * value * (3 - 2 * value);

function OrbitalShell({ progress }: SceneProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) {
      return;
    }

    const active = smooth(range(progress, 0.16, 0.8));
    group.current.rotation.z = -0.3 + state.clock.elapsedTime * 0.08;
    group.current.rotation.x = 0.5 + Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    group.current.position.set(0, -0.2, -1.4 + active * 0.6);
    group.current.scale.setScalar(0.8 + active * 0.3);
  });

  return (
    <group ref={group}>
      <Line color="#8b7b63" transparent opacity={0.18} lineWidth={0.8} points={ellipsePoints(4.8, 2.15, 80)} />
      <Line color="#728680" transparent opacity={0.14} lineWidth={0.8} points={ellipsePoints(5.4, 2.55, 80)} />
      <Line color="#8b5f47" transparent opacity={0.16} lineWidth={0.8} points={ellipsePoints(3.95, 1.65, 80)} />
    </group>
  );
}

function BackgroundVeils() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) {
      return;
    }

    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.08;
  });

  return (
    <group ref={group} position={[0, 0, -10]}>
      <mesh position={[-3.6, 1.1, 0]} rotation={[0, 0, -0.35]}>
        <planeGeometry args={[7.5, 3.2]} />
        <meshBasicMaterial color="#2f3f42" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[4.2, -0.9, 0.4]} rotation={[0, 0, 0.48]}>
        <planeGeometry args={[8.2, 3.6]} />
        <meshBasicMaterial color="#5f4030" transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function StellarDust() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const array = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i += 1) {
      array[i * 3] = (noise(i * 3 + 1) - 0.5) * 18;
      array[i * 3 + 1] = (noise(i * 3 + 2) - 0.5) * 10;
      array[i * 3 + 2] = -2 - noise(i * 3 + 3) * 12;
    }
    return array;
  }, []);

  useFrame((state) => {
    if (!points.current) {
      return;
    }

    points.current.rotation.z = state.clock.elapsedTime * 0.01;
    points.current.position.z = -1 + Math.sin(state.clock.elapsedTime * 0.06) * 0.4;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#cdb89a"
        size={0.024}
        transparent
        opacity={0.26}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function EarthGrid() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.96, 0.012, 12, 120]} />
        <meshBasicMaterial color="#8f7d67" transparent opacity={0.2} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[2.96, 0.012, 12, 120]} />
        <meshBasicMaterial color="#5f6f74" transparent opacity={0.14} />
      </mesh>
      <mesh rotation={[0.55, 0.15, 0.32]}>
        <torusGeometry args={[3.04, 0.012, 12, 120]} />
        <meshBasicMaterial color="#6d837d" transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

function EarthDataArcs() {
  return (
    <group>
      <Line
        color="#9c8c76"
        transparent
        opacity={0.45}
        lineWidth={1}
        points={[
          [-1.7, 1.1, 2.1],
          [-0.95, 1.45, 2.55],
          [0.1, 1.4, 2.7],
          [1.2, 0.9, 2.2],
        ]}
      />
      <Line
        color="#b06d49"
        transparent
        opacity={0.38}
        lineWidth={1}
        points={[
          [0.9, -0.1, 2.45],
          [1.55, -0.45, 2.62],
          [1.95, -0.95, 2.15],
        ]}
      />
    </group>
  );
}

function CubeSatFramework() {
  const panelOffsets = [-1.08, 1.08];
  const supportPosts = [
    [-0.36, -0.36],
    [-0.36, 0.36],
    [0.36, -0.36],
    [0.36, 0.36],
  ] as const;

  return (
    <group>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(0.95, 0.95, 1.35)]} />
        <lineBasicMaterial color="#c5b9a5" transparent opacity={0.38} />
      </lineSegments>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.84, 0.84, 1.22]} />
        <meshPhysicalMaterial color="#d8d6cf" metalness={0.9} roughness={0.22} clearcoat={0.6} clearcoatRoughness={0.25} />
      </mesh>
      <mesh position={[0, 0.03, 0.68]}>
        <boxGeometry args={[0.57, 0.57, 0.06]} />
        <meshStandardMaterial color="#11141c" emissive="#3d4352" emissiveIntensity={0.28} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.76, 0.11, 0.86]} />
        <meshStandardMaterial color="#c8c1b4" emissive="#62564a" emissiveIntensity={0.35} metalness={0.62} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.46, 0]}>
        <boxGeometry args={[0.9, 0.1, 1.0]} />
        <meshStandardMaterial color="#636a73" metalness={0.5} roughness={0.42} />
      </mesh>

      {supportPosts.map(([x, z]) => (
        <mesh key={`post-${x}-${z}`} position={[x, 0.02, z]}>
          <cylinderGeometry args={[0.028, 0.028, 1.18, 10]} />
          <meshStandardMaterial color="#aba497" metalness={0.85} roughness={0.24} />
        </mesh>
      ))}

      {panelOffsets.map((x) => (
        <group key={`panel-${x}`} position={[x, 0, 0]}>
          <mesh>
            <boxGeometry args={[1.15, 0.05, 0.72]} />
            <meshStandardMaterial color="#9f6d41" emissive="#6a4428" emissiveIntensity={0.24} metalness={0.45} roughness={0.4} />
          </mesh>
          {[-0.23, 0, 0.23].map((z) => (
            <Line key={`panel-row-${x}-${z}`} color="#d9c6ab" transparent opacity={0.26} lineWidth={0.9} points={[[-0.52, 0.03, z], [0.52, 0.03, z]]} />
          ))}
          {[-0.35, 0, 0.35].map((gridX) => (
            <Line
              key={`panel-col-${x}-${gridX}`}
              color="#d9c6ab"
              transparent
              opacity={0.18}
              lineWidth={0.9}
              points={[[gridX, 0.03, -0.33], [gridX, 0.03, 0.33]]}
            />
          ))}
        </group>
      ))}

      <mesh position={[0, 0.62, -0.35]} rotation={[0.6, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 12]} />
        <meshStandardMaterial color="#d7e2f5" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0.16, -0.25, 0.92]}>
        <coneGeometry args={[0.08, 0.26, 12]} />
        <meshBasicMaterial color="#e4c79f" transparent opacity={0.48} />
      </mesh>
      <mesh position={[-0.16, -0.25, 0.92]}>
        <coneGeometry args={[0.08, 0.26, 12]} />
        <meshBasicMaterial color="#e4c79f" transparent opacity={0.48} />
      </mesh>
      <mesh position={[0, -0.08, 0.84]}>
        <torusGeometry args={[0.21, 0.016, 10, 40]} />
        <meshBasicMaterial color="#c9b28f" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function ThrusterTrail({ progress }: SceneProps) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const array = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i += 1) {
      const radius = noise(i * 3 + 11) * 0.08;
      const angle = noise(i * 3 + 12) * Math.PI * 2;
      const depth = noise(i * 3 + 13) * 1.3;
      array[i * 3] = Math.cos(angle) * radius;
      array[i * 3 + 1] = Math.sin(angle) * radius;
      array[i * 3 + 2] = 0.9 + depth;
    }
    return array;
  }, []);

  useFrame((state) => {
    if (!points.current) {
      return;
    }

    const active = smooth(range(progress, 0.34, 0.78));
    points.current.rotation.z = state.clock.elapsedTime * 0.7;
    const material = points.current.material as THREE.PointsMaterial;
    material.opacity = 0.05 + active * 0.42;
    material.size = 0.016 + active * 0.028;
  });

  return (
    <points ref={points} position={[0, -0.24, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#f4b784" transparent opacity={0.2} size={0.024} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function ellipsePoints(xRadius: number, yRadius: number, segments: number) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return [Math.cos(angle) * xRadius, Math.sin(angle) * yRadius, 0] as [number, number, number];
  });
}

function CubeSat({ progress }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const signal = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) {
      return;
    }

    const t = state.clock.elapsedTime;
    const entry = smooth(range(progress, 0.38, 0.58));
    const exploded = smooth(range(progress, 0.5, 0.7));
    const retreat = smooth(range(progress, 0.78, 0.95));
    const reveal = smooth(range(progress, 0.32, 0.5));

    group.current.position.x = lerp(7.2, 0.4, reveal) + retreat * 2.6;
    group.current.position.y = Math.sin(t * 0.7) * 0.18 + lerp(-1.1, 0.28, exploded) - retreat * 0.7;
    group.current.position.z = lerp(2.8, -1.7, entry) + retreat * 2.6;
    group.current.rotation.x = 0.4 + t * 0.15;
    group.current.rotation.y = 0.25 + t * 0.22;
    group.current.rotation.z = Math.sin(t * 0.35) * 0.12;
    group.current.scale.setScalar(0.92 + reveal * 0.16 + exploded * 0.25 - retreat * 0.2);

    if (signal.current) {
      signal.current.rotation.z = t * 0.4;
      signal.current.scale.setScalar(0.85 + Math.sin(t * 2.2) * 0.08 + smooth(range(progress, 0.62, 0.82)) * 0.3);
    }
  });

  return (
    <group ref={group}>
      <CubeSatFramework />
      <ThrusterTrail progress={progress} />
      <group ref={signal} position={[0, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.35, 0.016, 12, 80]} />
          <meshBasicMaterial color="#8d7d66" transparent opacity={0.11} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.45, 0]}>
          <torusGeometry args={[1.68, 0.016, 12, 80]} />
          <meshBasicMaterial color="#9d6a4a" transparent opacity={0.1} />
        </mesh>
      </group>
    </group>
  );
}

function AnomalyParticles({ progress }: SceneProps) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const array = new Float32Array(600 * 3);

    for (let i = 0; i < 600; i += 1) {
      const radius = 1.3 + noise(i * 3 + 21) * 0.65;
      const angle = noise(i * 3 + 22) * Math.PI * 1.4 - Math.PI * 0.65;
      const spread = (noise(i * 3 + 23) - 0.5) * 0.8;

      array[i * 3] = Math.cos(angle) * radius + 1.35;
      array[i * 3 + 1] = Math.sin(angle) * radius * 0.45 - 0.65 + spread * 0.4;
      array[i * 3 + 2] = spread;
    }

    return array;
  }, []);

  useFrame((state) => {
    if (!points.current) {
      return;
    }

    const active = smooth(range(progress, 0.24, 0.56));
    points.current.rotation.z = state.clock.elapsedTime * 0.08;
    points.current.position.z = -0.2 + active * 0.8;
    (points.current.material as THREE.PointsMaterial).opacity = 0.15 + active * 0.85;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#b46b43"
        size={0.045}
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function DataLines({ progress }: SceneProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) {
      return;
    }

    const active = smooth(range(progress, 0.66, 0.88));
    group.current.position.set(lerp(4.5, 1.9, active), lerp(-1.8, -0.7, active), -1.6);
    group.current.rotation.y = -0.6 + active * 0.2;
    group.current.scale.setScalar(0.6 + active * 0.55);
    group.current.children.forEach((child, index) => {
      child.position.y = Math.sin(state.clock.elapsedTime * 1.5 + index) * 0.04;
    });
  });

  return (
    <group ref={group}>
      <Line
        color="#6b7f7a"
        lineWidth={1.6}
        transparent
        opacity={0.95}
        points={[
          [-1.25, 0.2, 0],
          [-0.8, 0.55, 0],
          [-0.3, 0.1, 0],
          [0.15, 0.65, 0],
          [0.75, -0.1, 0],
          [1.25, 0.3, 0],
        ]}
      />
      <Line
        color="#b56f48"
        lineWidth={1.2}
        transparent
        opacity={0.8}
        points={[
          [-1.25, -0.55, 0],
          [-0.75, -0.15, 0],
          [-0.15, -0.8, 0],
          [0.3, -0.2, 0],
          [0.95, -0.5, 0],
          [1.25, -0.05, 0],
        ]}
      />
      <mesh position={[-0.85, -1.1, 0]}>
        <planeGeometry args={[1.1, 0.85]} />
        <meshBasicMaterial color="#6b7f7a" transparent opacity={0.06} />
      </mesh>
      <mesh position={[0.65, -1.05, 0.1]}>
        <planeGeometry args={[1.15, 0.9]} />
        <meshBasicMaterial color="#b56f48" transparent opacity={0.08} />
      </mesh>
      <Line
        color="#bcb2a1"
        transparent
        opacity={0.55}
        lineWidth={0.9}
        points={[
          [-1.2, 1.05, 0],
          [-0.45, 1.15, 0],
          [0.2, 1.05, 0],
          [0.95, 1.12, 0],
        ]}
      />
    </group>
  );
}

function SystemsNodes({ progress }: SceneProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) {
      return;
    }

    const active = smooth(range(progress, 0.56, 0.76));
    group.current.position.set(lerp(-4.5, 0.2, active), lerp(1.8, 0.55, active), -1.5);
    group.current.rotation.z = state.clock.elapsedTime * 0.16;
    group.current.scale.setScalar(0.55 + active * 0.55);
  });

  return (
    <group ref={group}>
      <Line color="#8f8578" lineWidth={1} points={[[0, 0.95, 0], [-0.82, -0.55, 0], [0.82, -0.55, 0], [0, 0.95, 0]]} />
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color="#8b7a63" emissive="#4a4237" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[-0.82, -0.55, 0]}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color="#a46748" emissive="#55362a" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0.82, -0.55, 0]}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color="#d6d0c6" emissive="#605a53" emissiveIntensity={0.22} />
      </mesh>
    </group>
  );
}

export default function Scene({ progress }: SceneProps) {
  const earth = useRef<THREE.Group>(null);
  const titleLight = useRef<THREE.PointLight>(null);
  const starField = useRef<THREE.Group>(null);
  const atmosphere = useRef<THREE.Mesh>(null);
  const anomalyGlow = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const title = smooth(range(progress, 0.04, 0.2));
    const orbit = smooth(range(progress, 0.14, 0.36));
    const anomaly = smooth(range(progress, 0.28, 0.54));
    const finalFade = smooth(range(progress, 0.82, 1));
    const missionGlow = smooth(range(progress, 0.08, 0.72));

    if (starField.current) {
      starField.current.rotation.z = t * 0.015;
      starField.current.position.z = -6 + progress * 4;
    }

    if (earth.current) {
      earth.current.position.set(lerp(0, -1.8, orbit), lerp(-5.6, -1.9, orbit), lerp(-8, -3.2, orbit));
      earth.current.rotation.z = -0.28 + anomaly * 0.22;
      earth.current.rotation.y = t * 0.12 + anomaly * 0.55;
    }

    if (atmosphere.current) {
      (atmosphere.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + orbit * 0.45 - finalFade * 0.2;
    }

    if (anomalyGlow.current) {
      anomalyGlow.current.rotation.z = -0.35 + t * 0.05;
      anomalyGlow.current.scale.setScalar(0.6 + anomaly * 0.55);
      (anomalyGlow.current.material as THREE.MeshBasicMaterial).opacity = anomaly * 0.6;
    }

    if (titleLight.current) {
      titleLight.current.intensity = 1.2 + title * 2.2 + missionGlow * 0.35 - finalFade * 0.5;
    }
  });

  return (
    <>
      <color attach="background" args={["#07090c"]} />
      <fog attach="fog" args={["#07090c", 10, 28]} />

      <BackgroundVeils />
      <StellarDust />
      <group ref={starField}>
        <Stars radius={120} depth={60} count={9000} factor={4.5} saturation={0} fade speed={0.35} />
      </group>
      <OrbitalShell progress={progress} />

      <ambientLight intensity={0.55} color="#d0c6b7" />
      <directionalLight position={[4, 3, 5]} intensity={1.35} color="#f1ebdf" />
      <pointLight ref={titleLight} position={[0, 1.5, 4]} intensity={1.6} color="#cfb79c" />
      <pointLight position={[2.4, -1.4, 2]} intensity={1.35} color="#9f6b48" />
      <pointLight position={[-3.2, 1.6, -1.8]} intensity={0.9} color="#6c8a83" />

      <Float speed={0.9} rotationIntensity={0.15} floatIntensity={0.2}>
        <group ref={earth}>
          <mesh>
            <sphereGeometry args={[2.9, 64, 64]} />
            <meshStandardMaterial color="#172026" roughness={0.96} metalness={0.06} />
          </mesh>
          <EarthGrid />
          <EarthDataArcs />
          <mesh ref={atmosphere} scale={1.06}>
            <sphereGeometry args={[2.9, 64, 64]} />
            <meshBasicMaterial color="#7f8b86" transparent opacity={0.18} side={THREE.BackSide} />
          </mesh>
          <mesh position={[-0.9, 1.05, 2.2]} rotation={[0.25, -0.35, 0.3]}>
            <planeGeometry args={[2.8, 0.55]} />
            <meshBasicMaterial color="#c5b6a0" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh ref={anomalyGlow} position={[1.4, -0.65, 2.15]}>
            <circleGeometry args={[1.15, 64]} />
            <meshBasicMaterial color="#a95f3d" transparent opacity={0.16} />
          </mesh>
        </group>
      </Float>

      <AnomalyParticles progress={progress} />
      <CubeSat progress={progress} />
      <SystemsNodes progress={progress} />
      <DataLines progress={progress} />
    </>
  );
}
