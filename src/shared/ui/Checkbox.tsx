import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { joinClassNames } from './class-names.ts'

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  description?: string
  id?: string
  label: ReactNode
}

export function Checkbox({
  className,
  description,
  id,
  label,
  ...props
}: CheckboxProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const labelId = `${fieldId}-label`
  const descriptionId = `${fieldId}-description`

  return (
    <label className={joinClassNames('ui-check', className)} htmlFor={fieldId}>
      <input
        aria-describedby={description === undefined ? undefined : descriptionId}
        aria-labelledby={labelId}
        className="ui-check__input"
        id={fieldId}
        type="checkbox"
        {...props}
      />
      <span aria-hidden="true" className="ui-check__control" />
      <span className="ui-check__copy">
        <span className="ui-check__label" id={labelId}>
          {label}
        </span>
        {description === undefined ? null : (
          <span className="ui-check__description" id={descriptionId}>
            {description}
          </span>
        )}
      </span>
    </label>
  )
}
