import { useUiClass } from './ui-theme.ts'
import { useId, type SelectHTMLAttributes } from 'react'
import { FieldMessage } from './FieldMessage.tsx'
import { joinClassNames } from './class-names.ts'
import { getFieldDescriptionIds } from './field-description.ts'

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  containerClassName?: string
  description?: string
  error?: string
  id?: string
  label: string
}

export function Select({
  children,
  className,
  containerClassName,
  description,
  error,
  id,
  label,
  ...props
}: SelectProps) {
  const ui = useUiClass()
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const labelId = `${fieldId}-label`
  const descriptionId = `${fieldId}-description`
  const errorId = `${fieldId}-error`

  return (
    <label
      className={joinClassNames(ui('ui-field'), containerClassName)}
      htmlFor={fieldId}
    >
      <span className={ui("ui-field__label")} id={labelId}>
        {label}
      </span>
      <span className={ui("ui-select-wrap")}>
        <select
          aria-describedby={getFieldDescriptionIds({
            description,
            descriptionId,
            error,
            errorId,
          })}
          aria-invalid={error === undefined ? undefined : true}
          aria-labelledby={labelId}
          className={joinClassNames(ui('ui-select'), className)}
          id={fieldId}
          {...props}
        >
          {children}
        </select>
        <span aria-hidden="true" className={ui("ui-select__chevron")} />
      </span>
      <FieldMessage
        description={description}
        descriptionId={descriptionId}
        error={error}
        errorId={errorId}
      />
    </label>
  )
}
