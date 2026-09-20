import fs from 'fs';
import path from 'path';

function findFiles(dir, exts) {
  let res = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) res = res.concat(findFiles(p, exts));
    else if (exts.includes(path.extname(f.name))) res.push(p);
  }
  return res;
}

const files = findFiles('frontend/src', ['.jsx', '.js']);
const issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lucideMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
  const importedIcons = new Set();
  if (lucideMatch) {
    lucideMatch[1].split(',').map(s => s.trim()).filter(Boolean).forEach(i => {
      const parts = i.split(/\s+as\s+/);
      importedIcons.add(parts[parts.length - 1].trim());
    });
  }

  const jsxRegex = /<([A-Z][A-Za-z0-9]+)[\s\/>]/g;
  let m;
  const usedComponents = new Set();
  while ((m = jsxRegex.exec(content)) !== null) {
    usedComponents.add(m[1]);
  }

  const ignore = new Set([
    'React', 'Fragment', 'Card', 'Button', 'Input', 'LoadingSpinner', 'EmptyState',
    'ErrorBoundary', 'ExtractionReviewModal', 'Link', 'NavLink', 'Navigate', 'Routes',
    'Route', 'BrowserRouter', 'Outlet', 'App', 'Layout', 'Navbar', 'Footer', 'Sidebar',
    'Modal', 'Select', 'Checkbox', 'Badge', 'Alert', 'Helmet', 'GoogleLogin',
    'ResponsiveContainer', 'LineChart', 'Line', 'BarChart', 'Bar', 'PieChart', 'Pie',
    'Cell', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend', 'AreaChart', 'Area',
    'CategoryBadge', 'DaysRemainingBadge', 'WarrantyStatusBar', 'ReturnStatusBar',
    'DocumentUploadModal', 'DocumentViewerModal', 'EditProductModal', 'ExpenseFormModal',
    'ReportIssueModal', 'ClaimWarrantyModal', 'ProductList', 'ProductCard', 'TimelineEventCard',
    'StatCard', 'ServiceRequestModal', 'MetricCard', 'ProgressBar', 'Dropdown', 'Badge',
    'StatusBadge', 'OwnershipTimeline', 'EmailIntelligenceTab', 'OAuthConnectModal'
  ]);
  
  for (const comp of usedComponents) {
    if (ignore.has(comp)) continue;
    const iconUsageRegex = new RegExp('<' + comp + '[^>]*className=["\'][^"\']*(?:w-\\d|h-\\d)');
    if (iconUsageRegex.test(content)) {
      if (!importedIcons.has(comp) && !content.includes('const ' + comp) && !content.includes('function ' + comp) && !content.includes('import ' + comp)) {
        issues.push({ file, missingIcon: comp });
      }
    }
  }
}

console.log('Missing icons detected:', issues);
