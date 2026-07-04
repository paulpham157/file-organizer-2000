import { PropsWithChildren } from 'react'

// Fix for Select component
declare module '@radix-ui/react-select' {
  export type SelectProps = PropsWithChildren
  export type SelectTriggerProps = PropsWithChildren
  export type SelectValueProps = PropsWithChildren
  export type SelectContentProps = PropsWithChildren
  export type SelectItemProps = PropsWithChildren
  export type SelectLabelProps = PropsWithChildren
  export type SelectGroupProps = PropsWithChildren
}

// Fix for Dialog component
declare module '@radix-ui/react-dialog' {
  export type DialogProps = PropsWithChildren
  export type DialogTriggerProps = PropsWithChildren
  export type DialogContentProps = PropsWithChildren
  export type DialogTitleProps = PropsWithChildren
  export type DialogDescriptionProps = PropsWithChildren
}

// Fix for Tabs component
declare module '@radix-ui/react-tabs' {
  export type TabsProps = PropsWithChildren
  export type TabsListProps = PropsWithChildren
  export type TabsTriggerProps = PropsWithChildren
  export type TabsContentProps = PropsWithChildren
}

// Fix for Label component
declare module '@radix-ui/react-label' {
  export type LabelProps = PropsWithChildren
}

// Fix for Switch component 
declare module '@radix-ui/react-switch' {
  export type SwitchProps = PropsWithChildren
}

// Fix for Separator component
declare module '@radix-ui/react-separator' {
  export type SeparatorProps = PropsWithChildren
}
