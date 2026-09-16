import { useCallback, useEffect, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cva } from 'class-variance-authority';
import { cn } from './utils/cn';
import { scChildren } from './utils/scText.jsx';

const tooltipContentVariants = cva(
  [
    'rounded-md border shadow-lg',
    'text-content',
    'data-[state=delayed-open]:animate-fade-in',
    'data-[state=closed]:animate-fade-out',
    'data-[side=bottom]:translate-y-0',
    'z-50',
  ].join(' '),
  {
    variants: {
      tone: {
        default: 'bg-surface-raised border-line',
        warning: 'bg-surface-raised border-amber-500/40',
        danger: 'bg-surface-raised border-safety-orange/40',
      },
      size: {
        sm: 'px-fluid-sm py-1 text-fluid-label',
        md: 'px-fluid-sm py-1.5 text-fluid-body',
      },
    },
    defaultVariants: {
      tone: 'default',
      size: 'md',
    },
  },
);

const TOOLTIP_ARROW_CLASS = 'fill-surface-raised';

const EDGE_PADDING_PX = 8;
const CREASE_PROXIMITY_PX = 40;
const CREASE_ALIGN_OFFSET_PX = 24;

function readPosture() {
  if (typeof document === 'undefined') return 'even';
  return document.documentElement.dataset.posture || 'even';
}

function usePostureBand() {
  const [band, setBand] = useState(readPosture);
  useEffect(() => {
    const sync = () => setBand(readPosture());
    sync();
    window.addEventListener('posturechange', sync);
    return () => window.removeEventListener('posturechange', sync);
  }, []);
  return band;
}

function creaseAlignOffset(triggerEl) {
  if (!triggerEl || typeof window === 'undefined') return 0;
  const rect = triggerEl.getBoundingClientRect();
  if (!rect.width) return 0;
  const centre = rect.left + rect.width / 2;
  const seam = window.innerWidth / 2;
  const delta = centre - seam;
  if (Math.abs(delta) > CREASE_PROXIMITY_PX) return 0;
  return (delta < 0 ? -1 : 1) * CREASE_ALIGN_OFFSET_PX;
}

function Content({
  tone,
  size,
  className,
  style,
  sideOffset = 4,
  collisionPadding,
  alignOffset,
  triggerRef,
  children,
  ...props
}) {
  const posture = usePostureBand();
  const hidesBelowCrease = posture === 'tall';
  const hasVerticalCrease = posture === 'even';
  const resolvedPadding =
    collisionPadding ?? {
      top: EDGE_PADDING_PX,
      right: EDGE_PADDING_PX,
      left: EDGE_PADDING_PX,
      bottom: hidesBelowCrease
        ? Math.round((typeof window === 'undefined' ? 0 : window.innerHeight) * 0.5) + EDGE_PADDING_PX
        : EDGE_PADDING_PX,
    };
  const resolvedAlignOffset =
    alignOffset ?? (hasVerticalCrease ? creaseAlignOffset(triggerRef?.current) : 0);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={resolvedPadding}
        alignOffset={resolvedAlignOffset}
        data-posture-collision-bottom={resolvedPadding.bottom}
        data-posture-align-offset={resolvedAlignOffset}
        className={cn(tooltipContentVariants({ tone, size }), className)}
        style={{
          width: 'max-content',
          maxWidth: 'min(20rem, var(--radix-tooltip-content-available-width, 90vw))',
          ...style,
        }}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className={TOOLTIP_ARROW_CLASS} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function Tooltip({
  content,
  children,
  tone,
  size,
  delayDuration = 300,
  side = 'top',
  align = 'center',
  open,
  onOpenChange,
  disabled = false,
  className,
  ...props
}) {
  const triggerRef = useRef(null);
  const captureTrigger = useCallback((event) => {
    triggerRef.current = event.currentTarget;
  }, []);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (next) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;
    const close = () => handleOpenChange(false);
    window.addEventListener('posturechange', close);
    return () => window.removeEventListener('posturechange', close);
  }, [isOpen, handleOpenChange]);

  if (disabled || content == null || content === '') {
    return children;
  }
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
        <TooltipPrimitive.Trigger
          asChild
          ref={triggerRef}
          onPointerEnter={captureTrigger}
          onFocus={captureTrigger}
        >
          {children}
        </TooltipPrimitive.Trigger>
        <Content
          tone={tone}
          size={size}
          side={side}
          align={align}
          triggerRef={triggerRef}
          className={cn('ds-smallcaps normal-case', className)}
          {...props}
        >
          {scChildren(content, 'tooltip')}
        </Content>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

Tooltip.Provider = TooltipPrimitive.Provider;
Tooltip.Root = TooltipPrimitive.Root;
Tooltip.Trigger = TooltipPrimitive.Trigger;
Tooltip.Content = Content;

export { Tooltip };
