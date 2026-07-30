interface FieldDescriptionIdsOptions {
  description?: string
  descriptionId: string
  error?: string
  errorId: string
}

export function getFieldDescriptionIds({
  description,
  descriptionId,
  error,
  errorId,
}: FieldDescriptionIdsOptions) {
  const ids = [
    description === undefined ? null : descriptionId,
    error === undefined ? null : errorId,
  ].filter((id): id is string => id !== null)

  return ids.length === 0 ? undefined : ids.join(' ')
}
