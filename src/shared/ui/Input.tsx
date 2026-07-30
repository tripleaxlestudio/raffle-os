import { useId, type InputHTMLAttributes } from 'react'
import { FieldMessage } from './FieldMessage.tsx'
import { joinClassNames } from './class-names.ts'
import { getFieldDescriptionIds } from './field-description.ts'

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  containerClassName?: string
  description?: string
  error?: string
  id?: string
  label: string
}

export function Input({
  className,
  containerClassName,
  description,
  error,
  id,
  label,
  ...props
}: InputProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const labelId = `${fieldId}-label`
  const descriptionId = `${fieldId}-description`
  const errorId = `${fieldId}-error`

  return (
    <label
      className={joinClassNames('ui-field', containerClassName)}
      htmlFor={fieldId}
    >
      <span className="ui-field__label" id={labelId}>
        {label}
      </span>
      <input
        aria-describedby={getFieldDescriptionIds({
          description,
          descriptionId,
          error,
          errorId,
        })}
        aria-invalid={error === undefined ? undefined : true}
        aria-labelledby={labelId}
        className={joinClassNames('ui-input', className)}
        id={fieldId}
        {...props}
      />
      <FieldMessage
        description={description}
        descriptionId={descriptionId}
        error={error}
        errorId={errorId}
      />
    </label>
  )
}
