import { View, Text, TextInput, Pressable, type TextInputProps } from 'react-native'
import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  error?: string
  children?: ReactNode
}

export function FormField({ label, error, children }: FormFieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-foreground mb-1">{label}</Text>
      {children}
      {error && <Text className="text-sm text-destructive mt-1">{error}</Text>}
    </View>
  )
}

interface FormInputProps extends TextInputProps {
  label: string
  error?: string
}

export function FormInput({ label, error, ...props }: FormInputProps) {
  return (
    <FormField label={label} error={error}>
      <TextInput
        className={`border rounded-lg px-3 py-2.5 text-foreground bg-card ${error ? 'border-destructive' : 'border-border'}`}
        placeholderTextColor="#94a3b8"
        {...props}
      />
    </FormField>
  )
}

interface PickerButtonProps {
  label: string
  value: string
  placeholder?: string
  onPress: () => void
  error?: string
}

export function PickerButton({ label, value, placeholder, onPress, error }: PickerButtonProps) {
  return (
    <FormField label={label} error={error}>
      <Pressable
        onPress={onPress}
        className={`border rounded-lg px-3 py-2.5 flex-row items-center justify-between ${error ? 'border-destructive' : 'border-border'} bg-card`}
      >
        <Text className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || placeholder || 'Select...'}
        </Text>
        <Text className="text-muted-foreground">{'>'}</Text>
      </Pressable>
    </FormField>
  )
}
