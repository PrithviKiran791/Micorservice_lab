import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Logo } from '../components/common/Logo'
import { HoverBorderGradient } from '../components/ui/hover-border-gradient'
import { SkyLightRaysBackdrop } from '../components/ui/SkyLightRaysBackdrop'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-clip px-4 text-center">
      <SkyLightRaysBackdrop />
      <Logo />
      <span className="mt-10 rounded-full border border-line bg-panel-2 p-4 text-mute">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-mute">The page you are looking for does not exist or has moved.</p>
      <HoverBorderGradient
        as={Link}
        to="/"
        containerClassName="mt-6 rounded-full"
        className="h-10 px-5 text-sm font-medium"
      >
        <span>Go to the home page</span>
      </HoverBorderGradient>
    </div>
  )
}
