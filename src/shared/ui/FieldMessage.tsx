import { useUiClass } from './ui-theme.ts'
interface FieldMessageProps {
  error?: string
  errorId: string
  description?: string
  descriptionId: string
}

export function FieldMessage({
  description,
  descriptionId,
  error,
  errorId,
}: FieldMessageProps) {
  const ui = useUiClass()
  return (
    <>
      {description === undefined ? null : (
        <span className={ui("ui-field__description")} id={descriptionId}>
          {description}
        </span>
      )}
      {error === undefined ? null : (
        <span className={ui("ui-field__error")} id={errorId}>
          {error}
        </span>
      )}
    </>
  )
}
