import { useId, type InputHTMLAttributes } from 'react'
import { joinClassNames } from './class-names.ts'

interface ToggleProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'id' | 'role' | 'type'
  > {
  description?: string
  id?: string
  label: string
}

export function Toggle({
  className,
  description,
  id,
  label,
  ...props
}: ToggleProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const labelId = `${fieldId}-label`
  const descriptionId = `${fieldId}-description`

  return (
    <label className={joinClassNames('ui-toggle', className)} htmlFor={fieldId}>
      <span className="ui-toggle__copy">
        <span className="ui-toggle__label" id={labelId}>
          {label}
        </span>
        {description === undefined ? null : (
          <span className="ui-toggle__description" id={descriptionId}>
            {description}
          </span>
        )}
      </span>
      <input
        aria-describedby={description === undefined ? undefined : descriptionId}
        aria-labelledby={labelId}
        className="ui-toggle__input"
        id={fieldId}
        role="switch"
        type="checkbox"
        {...props}
      />
      <span aria-hidden="true" className="ui-toggle__track">
        <span className="ui-toggle__thumb" />
      </span>
    </label>
  )
}
