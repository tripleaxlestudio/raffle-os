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
  return (
    <>
      {description === undefined ? null : (
        <span className="ui-field__description" id={descriptionId}>
          {description}
        </span>
      )}
      {error === undefined ? null : (
        <span className="ui-field__error" id={errorId}>
          {error}
        </span>
      )}
    </>
  )
}
