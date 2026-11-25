'use client';

import {
  createContext,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarLinkItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  className,
  children,
  showMobileBar = false,
}: {
  className?: string;
  children?: ReactNode;
  showMobileBar?: boolean;
}) => {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar className={className} showBar={showMobileBar}>
        {children}
      </MobileSidebar>
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: ComponentProps<typeof motion.aside>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.aside
      aria-label="Main navigation"
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/12 bg-slate-950/60 px-3 py-4 backdrop-blur-xl shadow-[8px_0_32px_rgba(2,6,23,0.35)] lg:flex',
        className,
      )}
      initial={false}
      animate={{
        width: animate ? (open ? 260 : 72) : 260,
      }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.aside>
  );
};

export const MobileSidebar = ({
  className,
  children,
  showBar = false,
}: {
  className?: string;
  children?: ReactNode;
  showBar?: boolean;
}) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      {showBar && (
        <div className="flex h-14 w-full flex-row items-center justify-between border-b border-white/12 bg-slate-950/65 px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 text-ink hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              aria-label="Mobile navigation"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className={cn(
                'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between border-r border-white/15 bg-slate-950/85 p-5 backdrop-blur-2xl shadow-2xl',
                className,
              )}
            >
              <button
                type="button"
                className="absolute right-4 top-4 z-50 rounded-lg p-1.5 text-mute transition hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              {children}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
}: {
  link: SidebarLinkItem;
  className?: string;
}) => {
  const { open, setOpen, animate } = useSidebar();

  return (
    <NavLink
      to={link.href}
      onClick={() => {
        link.onClick?.();
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setOpen(false);
        }
      }}
      title={!open ? link.label : undefined}
      className={({ isActive }) =>
        cn(
          'group/sidebar relative flex items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'border border-brand/40 bg-brand/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
            : 'border border-transparent text-mute hover:border-white/10 hover:bg-white/8 hover:text-white',
          className,
        )
      }
    >
      <span className="relative flex shrink-0 items-center justify-center">{link.icon}</span>

      <motion.span
        initial={false}
        animate={{
          display: animate ? (open ? 'flex' : 'none') : 'flex',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.16 }}
        className="!m-0 flex flex-1 items-center justify-between gap-2 whitespace-pre !p-0 transition duration-150 group-hover/sidebar:translate-x-0.5"
      >
        <span className="truncate">{link.label}</span>
        {link.badge}
      </motion.span>
    </NavLink>
  );
};
