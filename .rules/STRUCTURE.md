# STRUCTURE RULES: Landing Page (Next.js)

## ALLOWED FILE STRUCTURE
```
/
├── app/
│   ├── page.tsx              ← REQUIRED: Main landing page
│   ├── layout.tsx            ← REQUIRED: Root layout
│   ├── globals.css           ← REQUIRED: Global styles
│   └── favicon.ico
├── components/               ← Reusable UI components
│   ├── Hero.tsx
│   ├── Features.tsx
│   ├── Footer.tsx
│   └── Navbar.tsx
├── public/
│   └── assets/              ← REQUIRED: All media files
│       └── logo.[ext]
├── system_design.md         ← REQUIRED: Business logic
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .rules/                  ← DO NOT MODIFY
```

## MANDATORY TECH STACK
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript ONLY
- **Styling:** TailwindCSS + Framer Motion
- **Optimization:** next/image, next/font

## NAMING CONVENTIONS
- **Components:** PascalCase (e.g., `HeroSection.tsx`)
- **Folders:** kebab-case (e.g., `hero-section/`)
- **Files:** camelCase for utils (e.g., `scrollUtils.ts`)

## CODE STANDARDS
1. **All components must be:** TypeScript, Server Components by default
2. **Images must use:** next/image with proper width/height
3. **Fonts must use:** next/font for optimization
4. **Animations:** Framer Motion only (no CSS animations)
5. **SEO:** Every page must have metadata export

## SECTIONS REQUIRED (Landing Page)
1. **Hero:** Above the fold, clear CTA
2. **Features/Services:** 3-6 key offerings
3. **About/Story:** Business background
4. **Contact/CTA:** WhatsApp button or contact form
5. **Footer:** Links, social, copyright

## FORBIDDEN
- ❌ No Pages Router (use App Router only)
- ❌ No JavaScript files (TypeScript only)
- ❌ No inline styles (use className + Tailwind)
- ❌ No img tags (use next/image)
- ❌ No external CSS CDNs
- ❌ No files outside this structure
- ❌ No hardcoded text (read from system_design.md)

## VALIDATION CHECKLIST
Before saying "done", verify:
- [ ] `npm run build` succeeds with no errors
- [ ] All images optimized and in /public/assets
- [ ] Mobile responsive (test at 375px width)
- [ ] All text matches business context from system_design.md
- [ ] SEO metadata present on all pages
- [ ] WhatsApp CTA works (if required)


## PROJECT SETUP MODE
- Framework (Reminder): nextjs
- Structure Mode: N/A (Landing-specific setup)
