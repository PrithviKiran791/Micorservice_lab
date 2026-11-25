import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Logo } from '../components/common/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo />
      <span className="mt-10 rounded-full border border-line bg-panel-2 p-4 text-mute">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-mute">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand-600">
        Go to the home page
      </Link>
    </div>
  )
}
