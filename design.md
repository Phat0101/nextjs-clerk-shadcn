# Clear.ai UI Design System Guide

## Overview
Create a modern, professional, and accessible interface following clear.ai's design philosophy. This system emphasizes clarity, consistency, and user-centric design with a focus on data-heavy applications and business workflows.

## Design Foundation

### Component Architecture
- **Base**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom configuration
- **Theming**: CSS custom properties supporting light/dark modes
- **Pattern**: Component-driven architecture with consistent API

### Design Tokens
```css
:root {
  --radius: 0.5rem;
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --secondary: 240 4.8% 95.9%;
  --muted: 240 4.8% 95.9%;
  --accent: 240 4.8% 95.9%;
  --destructive: 0 72.22% 50.59%;
  --border: 240 5.9% 90%;
}
```

## Typography System

### Font Family
- **Primary**: 'Geist' - Modern sans-serif with excellent readability
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Features**: Tabular numbers, stylistic sets for enhanced legibility
- **Fallback**: system-ui, sans-serif

### Font Scale
- **xs**: 13px (small labels, metadata)
- **xxs**: 12px (micro text, table headers)
- **sm**: 14px (body text, form labels)
- **base**: 16px (primary body text)
- **lg**: 18px (section headings)
- **xl**: 20px (page headings)
- **2xxl**: 28px (hero text)

### Line Height
- **110**: 1.1 (tight, for large headings)
- **120**: 1.2 (condensed, for compact layouts)
- **Default**: 1.5 (comfortable reading)

## Color Palette

### Brand Colors
- **Bright Green**: #a9ff9b (highlights, success states, CTAs)
- **Yellow Accent**: #dcff79 (secondary highlights, warnings)
- **Light Accent**: #FEFF02 (special emphasis, notifications)

### Gray Scale
```css
gray-50: #fafafa    /* Backgrounds */
gray-100: #f4f4f5   /* Subtle backgrounds */
gray-150: #EEEFF1   /* Custom light gray */
gray-200: #e4e4e7   /* Borders, dividers */
gray-300: #d4d4d8   /* Form borders */
gray-400: #a1a1aa   /* Placeholder text */
gray-500: #71717a   /* Secondary text */
gray-600: #52525b   /* Primary text (light mode) */
gray-800: #27272a   /* Headers, emphasis */
gray-900: #18181b   /* High contrast text */
```

### Semantic Colors
- **Success**: #16A34A (confirmations, completed states)
- **Warning**: #F59E0B (alerts, pending states)
- **Error**: #DC2626 (errors, destructive actions)
- **Info**: #0072F5 (focus states, links)

## Layout Patterns

### Grid System
- **Container**: Max-width 1400px, centered with 2rem padding
- **Sidebar**: Fixed 280px width (264px common variant)
- **Content**: Flexible with proper overflow handling

### Spacing Scale
- **Micro**: 4px, 8px (component internal spacing)
- **Small**: 12px, 16px (between related elements)
- **Medium**: 24px, 32px (section spacing)
- **Large**: 48px, 64px (major sections)

### Layout Patterns
```css
.layout-full-height {
  height: calc(100vh - 48px); /* Account for header */
}

.layout-sidebar {
  width: 280px;
  border-right: 1px solid theme(colors.gray.200);
}

.layout-content {
  flex: 1;
  overflow: auto;
}
```

## Component Styling

### Buttons
```css
/* Base button styles */
.btn-base {
  @apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors;
  @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
  @apply disabled:pointer-events-none disabled:opacity-50;
}

/* Variants */
.btn-primary { @apply bg-primary text-primary-foreground hover:bg-primary/90; }
.btn-secondary { @apply bg-secondary text-secondary-foreground hover:bg-secondary/80; }
.btn-outline { @apply border border-input bg-background hover:bg-accent hover:text-accent-foreground; }
.btn-ghost { @apply hover:bg-accent hover:text-accent-foreground; }
.btn-destructive { @apply bg-destructive text-destructive-foreground hover:bg-destructive/90; }
```

### Form Elements
```css
.form-input {
  @apply border-none rounded-lg shadow-sm py-2 px-3 text-sm ring-1 ring-inset ring-gray-300;
  @apply focus:ring-2 focus:ring-indigo-600 focus:border-transparent;
  @apply placeholder:text-gray-400;
}

.form-label {
  @apply block text-sm font-medium leading-6 text-gray-900;
}
```

### Cards & Containers
```css
.card {
  @apply rounded-lg border bg-card text-card-foreground shadow-sm;
}

.card-shadow-elevation {
  box-shadow: 0px 0px 0px 1px rgba(0,0,0,.08), 0px 4px 8px 0px rgba(0,0,0,.08), 0px 8px 16px 0px rgba(0,0,0,.08);
}
```

## Interactive States

### Focus States
- **Ring**: 2px solid ring color with 2px offset
- **Color**: Primary blue (#0072F5) or theme-appropriate
- **Timing**: Immediate on focus, 200ms fade out

### Hover States
- **Buttons**: Background color shift (10% opacity change)
- **Links**: Underline with color transition
- **Cards**: Subtle elevation increase or background lightening

### Loading States
- **Progress**: Custom animations with easing
- **Skeleton**: Subtle pulse with gray-200 background
- **Spinners**: Consistent sizing and color

## Animation Guidelines

### Timing
- **Fast**: 150ms (micro-interactions)
- **Standard**: 200ms (most transitions)
- **Medium**: 300ms (complex state changes)
- **Slow**: 500ms+ (page transitions, complex animations)

### Easing
- **Default**: cubic-bezier(0.16, 1, 0.3, 1) (ease-out-expo)
- **Bounce**: For confirmation actions
- **Linear**: For progress indicators

### Common Animations
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(-2px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

## Navigation Patterns

### Sidebar Navigation
- **Width**: 280px fixed
- **Background**: Gray-50 or white
- **Active States**: Gray-100 background with medium font weight
- **Hierarchy**: Primary items with expandable sub-items
- **Icons**: 16px with consistent stroke width

### Breadcrumbs
- **Separator**: ChevronRight icon
- **Current Page**: Medium weight, no link styling
- **Links**: Hover states with color transition

## Data Display

### Tables
- **Headers**: 10px font size, 600 weight, gray-800 color
- **Borders**: 1px solid gray-200
- **Striping**: Subtle gray-50 alternating rows
- **Sticky**: Headers and first column support

### Status Indicators
- **Colors**: Semantic color mapping
- **Badges**: Rounded-full with appropriate padding
- **Icons**: 12-16px with consistent styling

## Landing Page Patterns

### Hero Sections
- **Typography**: Large serif headlines (5xl-7xl) with tight line-height
- **Colors**: Brand green highlights with custom decorative elements
- **Layout**: Split content/image with responsive stacking

### Brand Elements
- **Decorative Shapes**: CSS-generated corner elements using ::before/::after
- **Animations**: Subtle scroll-triggered effects


## Responsive Breakpoints

```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1400px /* Extra large */
```

## Accessibility Guidelines

### Contrast Ratios
- **Text on Background**: Minimum 4.5:1
- **Large Text**: Minimum 3:1
- **Interactive Elements**: Clear focus indicators

### Keyboard Navigation
- **Tab Order**: Logical, visible focus indicators
- **Shortcuts**: Common patterns (Esc for modals, Enter for submit)
- **ARIA**: Proper labeling and role attributes

## Implementation Notes

### CSS Organization
1. Base styles (reset, typography)
2. Component styles (buttons, forms, cards)
3. Utility classes (spacing, colors)
4. Custom animations and transitions

### Class Naming
- Use Tailwind utilities primarily
- Custom classes prefixed with 'css-' for specificity
- Component-scoped styles for complex components

### Performance
- Minimal custom CSS, leverage Tailwind
- Optimize animations for 60fps
- Use transform and opacity for smooth animations
- Implement proper loading states for data-heavy interfaces

## Design Principles

1. **Clarity First**: Information hierarchy should be immediately apparent
2. **Consistent Patterns**: Reuse established patterns across the application
3. **Accessible by Default**: Design for all users from the start
4. **Performance Conscious**: Optimize for speed and efficiency
5. **Data-Dense Friendly**: Handle complex information elegantly
6. **Professional Aesthetic**: Maintain business-appropriate styling
7. **Scalable System**: Components should work at any scale

Use this system to create interfaces that feel familiar yet distinctive, professional yet approachable, and efficient yet delightful.