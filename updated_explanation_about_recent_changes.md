# Wally Colour Contrast Checker - Project Explanation

## Project Overview
The **Wally Colour Contrast Checker** is a frontend Next.js application designed to help developers and designers ensure their color palettes meet the official Web Content Accessibility Guidelines (WCAG 2.1 & 2.2). It operates entirely on the client side, meaning no data is transmitted to servers, ensuring privacy and speed.

At its core, it dynamically calculates the contrast ratio between a chosen foreground (text) color and a background color, and verifies if the combination passes strict AA (4.5:1 ratio) and AAA (7.0:1 ratio) compliance checks.

## Key Enhancements & Changes Made

Throughout the development process, several significant structural, algorithmic, and user-experience (UI/UX) changes were made to match the required specifications and solve critical edge-case bugs. 

### 1. Algorithm: Diverse Accessible Alternatives
- **What was changed:** We completely rewrote the color generation logic that powers the "Accessible Alternatives" suggestions. 
- **Why it was changed:** The previous algorithm would frequently suggest four virtually identical colors (like four shades of black). The new logic intelligently samples across the entire hue spectrum (e.g., finding a red, a blue, a green, and a neutral) before falling back to lightness variations. This guarantees the user is always presented with exactly 4 *visually distinct* color options.

### 2. Interactive Filtering and Ratio Sliders
- **What was changed:** We added an `AA / AAA` toggle switch and interactive "Target Ratio" sliders to the top of the Accessible Alternatives panel. 
- **Why it was changed:** Users needed a way to strictly enforce high-contrast thresholds. If AAA is selected, the application now programmatically prevents the generation of any color that fails the 7.0 minimum. The ratio sliders allow the user to ask the engine to sort the passing colors and prioritize the ones that are mathematically closest to their specific desired contrast ratio.

### 3. Graceful Fallbacks (Empty States)
- **What was changed:** Implemented a dashed "No compliant colors" box.
- **Why it was changed:** Because of physics, it is mathematically impossible to find an AAA-compliant (7.0 ratio) foreground color if the user chooses a highly saturated mid-tone background (like pure red `#FF0000`). Instead of the UI breaking or showing a blank space, the system now catches this limitation and gracefully informs the user that no combinations exist.

### 4. Layout & Scrolling
- **What was changed:** Removed hard-coded `h-screen`, `overflow-hidden`, and `h-full` constraints from the page wrappers.
- **Why it was changed:** On shorter screens or mobile devices, the app was cutting off the bottom panel. Unlocking the layout allowed natural browser scrolling so all tools remain accessible regardless of viewport height.

### 5. UI/UX Polish
Several smaller UI tweaks were made to make the app feel incredibly premium and easy to use:
- **Highlighted Inputs:** The labels for the primary inputs were upgraded to an extrabold dark weight for supreme readability. 
- **Pencil Icon Badge:** The native color picker interaction was improved by appending a floating pencil badge directly onto the color swatches. This instantly tells the user that the swatch itself is an interactive element.
- **Preview Box Accents:** The preview boxes in the suggestions panel now include a beautifully matched horizontal underscore beneath the `Aa` text, solving a prior issue where the "Adjust Both" box had inverted colors. 
- **Clipboard Feedback:** The hex-code copy button was upgraded to display a floating `Copied!` tooltip and a temporary green checkmark to provide the user with unambiguous visual feedback.

## Important Technical Details
- **Framework:** React / Next.js (Client Components).
- **Color Engine:** The app heavily utilizes the `colord` library to rapidly compute HSL to Hex conversions and relative luminance / contrast ratios without expensive DOM repaints.
- **State Flow:** The React architecture is highly reactive. Changing a top-level state (like the `filter` or `fg`/`bg` color) cascades through `useMemo` hooks, automatically updating the suggestion boxes without needing manual refresh buttons.
