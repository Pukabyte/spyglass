import Error from './Error'

const ALIASED_WIDGETS = {
  pialert: 'netalertx',
  hoarder: 'karakeep',
}

export default function Container({ error = false, children, service, widget }) {
  if (error) {
    return <Error service={service} widget={widget} error={error} />
  }

  const childrenArray = Array.isArray(children) ? children : [children]

  let visibleChildren = childrenArray
  let fields = widget?.fields

  if (typeof fields === 'string') {
    try {
      fields = JSON.parse(widget.fields)
    } catch {
      fields = null
    }
  }

  const type = widget?.type || widget?.appName

  if (fields && type) {
    // Filter children based on fields configuration
    visibleChildren = childrenArray?.filter((child) =>
      fields.some((field) => {
        let fullField = field
        if (!field.includes('.')) {
          fullField = `${type}.${field}`
        }
        let matches = fullField === (child?.props?.field || child?.props?.label)

        // Check if the field is an 'alias'
        if (matches) {
          return true
        } else if (ALIASED_WIDGETS[type]) {
          matches =
            fullField.replace(type, ALIASED_WIDGETS[type]) ===
            (child?.props?.field || child?.props?.label)
          return matches
        }

        return false
      })
    )
  }

  return (
    <div className="relative flex flex-row w-full service-container gap-1.5">
      {visibleChildren}
    </div>
  )
}

