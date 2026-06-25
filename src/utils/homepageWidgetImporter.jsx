// Utility to import widgets from Homepage and apply custom styling
// This allows you to use Homepage widget functionality with different styling

/**
 * Import a widget component from Homepage-style structure
 * and wrap it with custom styling
 * 
 * @param {string} widgetPath - Path to the widget component (e.g., './plex/component')
 * @param {Object} styleOverrides - Style overrides to apply
 * @returns {Promise<React.Component>} - The styled widget component
 */
export async function importHomepageWidget(widgetPath, styleOverrides = {}) {
  try {
    // Dynamically import the widget component
    const widgetModule = await import(`../components/widgets/${widgetPath}.jsx`);
    const WidgetComponent = widgetModule.default;
    
    // Return a wrapped component with custom styling
    return function StyledWidget(props) {
      return (
        <div className={styleOverrides.containerClassName || ''}>
          <WidgetComponent {...props} styleOverrides={styleOverrides} />
        </div>
      );
    };
  } catch (error) {
    console.error(`Error importing Homepage widget from ${widgetPath}:`, error);
    throw error;
  }
}

/**
 * Create a styled variant of a widget
 * 
 * @param {React.Component} WidgetComponent - The base widget component
 * @param {Object} styleConfig - Style configuration
 * @returns {React.Component} - The styled widget component
 */
export function createStyledWidget(WidgetComponent, styleConfig = {}) {
  return function StyledWidget(props) {
    const {
      containerClassName = '',
      baseWidgetClassName = '',
      containerStyle = {},
      blockStyle = {},
    } = styleConfig;
    
    return (
      <div className={containerClassName} style={containerStyle}>
        <WidgetComponent
          {...props}
          styleOverrides={{
            baseWidget: baseWidgetClassName,
            container: containerStyle,
            block: blockStyle,
          }}
        />
      </div>
    );
  };
}

/**
 * Import widget from Homepage and apply predefined style variant
 * 
 * @param {string} widgetName - Name of the widget (e.g., 'plex')
 * @param {string} variant - Style variant ('default', 'compact', 'minimal', 'card')
 * @returns {Promise<React.Component>} - The styled widget component
 */
export async function importHomepageWidgetWithVariant(widgetName, variant = 'default') {
  const styleVariants = {
    default: {
      containerClassName: '',
    },
    compact: {
      containerClassName: 'compact-widget',
      baseWidgetClassName: 'text-sm',
    },
    minimal: {
      containerClassName: 'minimal-widget',
      baseWidgetClassName: 'border-none shadow-none',
    },
    card: {
      containerClassName: 'card-widget bg-slate-800/80 rounded-xl p-4 shadow-lg',
      baseWidgetClassName: 'bg-transparent',
    },
  };
  
  const styleConfig = styleVariants[variant] || styleVariants.default;
  
  try {
    const widgetModule = await import(`../components/widgets/${widgetName}/component.jsx`);
    const WidgetComponent = widgetModule.default;
    
    return createStyledWidget(WidgetComponent, styleConfig);
  } catch (error) {
    console.error(`Error importing widget ${widgetName} with variant ${variant}:`, error);
    throw error;
  }
}

