import ContrastCalculator from './ContrastCalculator';

export const metadata = {
  title: 'Contrast Ratio Checker | Free Accessibility Tools',
  description: 'Check foreground and background color contrast ratios, verify WCAG 2.2 compliance, and instantly generate passing color palettes.',
};

export default function ContrastCheckerPage() {
  return (
    <main className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-gray-900 py-6 overflow-x-hidden">
      {/* Client-side interactive component */}
      <div className="flex-1">
        <ContrastCalculator />
      </div>
    </main>
  );
}