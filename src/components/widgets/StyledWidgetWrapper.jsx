// Wrapper component to apply custom styling to Homepage-style widgets
import BaseWidget from './BaseWidget'
import Container from './Container'
import Block from './Block'

/**
 * StyledWidgetWrapper - Wraps Homepage widgets with custom styling
 * 
 * This component allows you to use Homepage widget functionality
 * while applying different styling than the default Homepage style.
 */
export default function StyledWidgetWrapper({ 
  widget, 
  onDelete, 
  onRefresh, 
  children,
  styleOverrides = {},
  variant = 'default'
}) {
  const {
    containerClassName = '',
    baseWidgetClassName = '',
    containerStyle = {},
    blockClassName = '',
  } = styleOverrides;

  // Apply variant-based styling
  const variantStyles = {
    default: {
      container: '',
      baseWidget: '',
    },
    compact: {
      container: 'compact-widget',
      baseWidget: 'text-sm',
    },
    minimal: {
      container: 'minimal-widget border-none shadow-none',
      baseWidget: 'bg-transparent',
    },
    card: {
      container: 'card-widget bg-slate-800/80 rounded-xl p-4 shadow-lg',
      baseWidget: 'bg-transparent',
    },
  };

  const variantStyle = variantStyles[variant] || variantStyles.default;
  const finalContainerClassName = `${variantStyle.container} ${containerClassName}`.trim();
  const finalBaseWidgetClassName = `${variantStyle.baseWidget} ${baseWidgetClassName}`.trim();

  return (
    <div className={finalContainerClassName} style={containerStyle}>
      <BaseWidget
        widget={widget}
        onDelete={onDelete}
        onRefresh={onRefresh}
        className={finalBaseWidgetClassName}
      >
        {children}
      </BaseWidget>
    </div>
  );
}

