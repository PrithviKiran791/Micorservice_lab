import LightRays from './LightRays'

/** Fixed sky-tinted LightRays backdrop used across dashboard and internal pages (everything except home and auth). */
export function SkyLightRaysBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Mixed sky-colour atmospheric base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(85% 55% at 50% 0%, rgba(56, 118, 186, 0.32) 0%, rgba(56, 189, 248, 0.12) 42%, rgba(10, 16, 32, 0.98) 100%), linear-gradient(180deg, #0b1b36 0%, #0a1428 48%, #0a1020 100%)'
        }}
      />
      <LightRays
        raysOrigin="top-center"
        raysColor="#7dd3fc"
        raysSpeed={0.9}
        lightSpread={0.65}
        rayLength={3}
        glow={0.32}
        haze={0.25}
        followMouse
        mouseInfluence={0.1}
        rayDensity={1}
        tilt={0}
        raySharpness={0.35}
        atmosphere={1}
        intensity={0.78}
        fadeDistance={1.15}
        saturation={1.25}
        noiseAmount={0}
        distortion={0}
        pulsating={false}
        cursorShadow
        clickPulse
        intro
        lightMode={false}
        opacity={0.62}
        className="h-full w-full"
      />
      {/* Subtle scrim so top headings and subtitles stay crisp over the sky-ray source */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10, 16, 32, 0.48) 0%, rgba(10, 16, 32, 0.14) 32%, rgba(10, 16, 32, 0.35) 100%)'
        }}
      />
    </div>
  )
}
