import { Button } from './Button.jsx';

export function SegmentedControl({
  items,
  onSelect,
  label,
  compact = false,
  testId,
  className = '',
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={`ds-chip-well ds-touch-lane items-center px-[var(--chip-well-pad)] rounded-[9px] ${
        compact
          ? 'grid w-full grid-cols-5 gap-y-1 @[560px]/mapsurface:grid-cols-9'
          : 'flex flex-wrap'
      } ${className}`}
    >
      {items.map((item) => (
        <Button
          key={item.id}
          variant="chip"
          size="chip"
          pressed={item.pressed}
          disabled={item.disabled}
          title={item.title}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
