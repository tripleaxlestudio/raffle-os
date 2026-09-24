import { components, type GroupBase, type MenuProps } from 'react-select'
import { useUiTheme } from './ui-theme.ts'

/** Tokens on the existing menu DOM node; no new host, wrapper or menu styling.
 * Pending's page-owned dark menu stays unchanged until Slice 4.
 */
export function ThemedSelectMenu<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
  props: MenuProps<Option, IsMulti, Group>,
) {
  const theme = useUiTheme()
  return <components.Menu {...props} innerProps={{
    ...props.innerProps,
    ...{ 'data-ui-theme': theme === 'kocokan' ? theme : undefined },
  }} />
}
