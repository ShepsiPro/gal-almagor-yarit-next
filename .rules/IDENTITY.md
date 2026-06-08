# PROJECT IDENTITY: Gal Almagor yarit

## BUSINESS CONTEXT
- **Name:** Gal Almagor yarit
- **Type:** landing
- **Description:** No description provided.
- **Status:** Initialized

## CORE DIRECTIVES
1. **READ FIRST:** You MUST read `system_design.md` before writing ANY code
2. **Business Context:** All content must align with the business described in system_design.md
3. **No Hallucinations:** Use only assets, colors, and data provided - NO generic placeholders
4. **Ask, Don't Assume:** If business context is unclear, STOP and ask for clarification

## STRICT RULES
### Content Rules
- ✅ Use actual business name, services, and values from system_design.md
- ✅ Use provided logo and brand colors from /assets
- ❌ NO "Lorem Ipsum" or generic placeholder text
- ❌ NO "Company Name", "Our Services", or vague descriptions
- ❌ NO stock photos unless explicitly provided in /assets
- ❌ NO hardcoded colors (read from system_design.md or use Tailwind defaults)

### Code Rules
- ✅ Follow structure defined in .rules/STRUCTURE.md exactly
- ✅ Use TypeScript only (no .js files)
- ✅ Use semantic, accessible HTML
- ❌ NO files outside allowed directories
- ❌ NO npm packages without approval
- ❌ NO changing folder structure
- ❌ NO inline styles

### Process Rules
- ✅ Verify `npm run build` passes before reporting "done"
- ✅ Test mobile responsiveness (375px width minimum)
- ✅ Check all images load correctly
- ❌ NO partial implementations
- ❌ NO "TODO" comments in production code

## FORBIDDEN ACTIONS
The following actions will result in immediate rejection:
1. Creating files outside allowed structure
2. Using generic/placeholder content
3. Ignoring business context from system_design.md
4. Adding dependencies without approval
5. Changing tech stack defined in STRUCTURE.md
6. Leaving broken builds or errors

## VALIDATION REQUIREMENTS
Before claiming task completion:
- [ ] Read system_design.md and confirmed understanding
- [ ] All file paths follow STRUCTURE.md rules
- [ ] All content is business-specific (no placeholders)
- [ ] `npm run build` succeeds with zero errors
- [ ] Mobile responsive and accessible
- [ ] All images in /assets and optimized
- [ ] No TODO/FIXME comments remain
