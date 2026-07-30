import {
  useId,
  type FieldsetHTMLAttributes,
  type ReactNode,
} from 'react'
import { joinClassNames } from '../ui/class-names.ts'

interface FieldGroupProps
  extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'children'> {
  children: ReactNode
  description?: string
  legend: string
}

export function FieldGroup({
  children,
  className,
  description,
  legend,
  ...props
}: FieldGroupProps) {
  const generatedId = useId()
  const descriptionId = `${generatedId}-description`

  return (
    <fieldset
      aria-describedby={description === undefined ? undefined : descriptionId}
      className={joinClassNames('field-group', className)}
      {...props}
    >
      <legend>{legend}</legend>
      {description === undefined ? null : (
        <p className="field-group__description" id={descriptionId}>
          {description}
        </p>
      )}
      <div className="field-group__content">{children}</div>
    </fieldset>
  )
}
