# 365-Day Journaling App Design Guidelines

## Design Approach Documentation
**Selected Approach**: Reference-based with Material Design influences  
**Key References**: Notion (block-based editing), Linear (smooth animations), Apple Notes (clean typography)  
**Design Principles**: Minimalist glassmorphism, content-first hierarchy, smooth micro-interactions

## Core Design Elements

### A. Color Palette
**Primary Colors:**
- Light Mode: 255 0% 98% (near-white base), 210 20% 94% (soft gray backgrounds)
- Dark Mode: 220 13% 18% (charcoal base), 215 25% 27% (elevated surfaces)
- Glass Effects: rgba(255, 255, 255, 0.1) overlays with backdrop-blur-md

**Accent Colors:**
- Primary Action: 210 100% 56% (modern blue)
- Success States: 142 76% 36% (muted green)
- Text: 220 9% 46% (light), 210 6% 93% (dark)

### B. Typography
**Font Family**: Inter via Google Fonts CDN
- Headers: font-semibold, text-lg to text-2xl
- Body Text: font-normal, text-sm to text-base
- Journal Content: font-light, text-sm, leading-relaxed for readability
- UI Labels: font-medium, text-xs for controls

### C. Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-4, p-6
- Grid gaps: gap-2, gap-4
- Margins: m-2, m-4, m-6
- Control heights: h-8, h-12

### D. Component Library

**Journal Blocks:**
- Glassmorphism cards with rounded-xl borders
- Subtle shadow-lg with backdrop-blur-md
- Dynamic sizing based on zoom level (min-h-24 to min-h-48)
- Smooth hover states with subtle scale transforms
- Date headers with text-xs opacity-70

**Zoom Controls:**
- Sleek horizontal scrollbars with custom styling
- Range inputs with glassmorphism track backgrounds
- Number input with glass border styling
- Real-time preview labels showing current values
- Smooth transition-all duration-300 for value changes

**Navigation & Layout:**
- Fixed header with glass backdrop-blur-lg
- Floating control panel with rounded-2xl glass container
- Responsive grid system (grid-cols-1 to grid-cols-7)
- Smooth scroll-smooth behavior

**Interactive Elements:**
- Buttons with glass styling and subtle hover:scale-105
- Focus states with ring-2 ring-blue-400/50
- Loading states with subtle pulse animations

### E. Animations
**Minimal Animation Strategy:**
- Zoom transitions: transform duration-500 ease-out
- Block hover: subtle scale-[1.02] transform
- Control interactions: opacity and scale micro-animations only
- Scroll position changes: smooth native scrolling
- No distracting or excessive motion

## Glassmorphism Implementation
- Consistent backdrop-blur-md across elevated surfaces
- Semi-transparent white overlays (bg-white/10 to bg-white/20)
- Subtle borders with border-white/20
- Soft shadows: shadow-lg with reduced opacity
- Rounded corners: rounded-xl for cards, rounded-2xl for main containers

## Responsive Behavior
- Mobile: Single column grid, simplified controls
- Tablet: 3-4 column grid, expanded control panel
- Desktop: Up to 7 columns, full feature set
- Adaptive text sizing using responsive font utilities

This design creates a serene, focused journaling environment that feels both modern and timeless, with the glassmorphism aesthetic providing visual depth without distraction.