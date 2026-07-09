const fs = require('fs');
const path = require('path');

// Fix page.tsx
const pageTsxPath = path.join(__dirname, 'app', 'page.tsx');
let pageContent = fs.readFileSync(pageTsxPath, 'utf8');

// The issue was: <a href="#intro">...</Link>
// We should replace all <a href="#..."> with <Link href="#...">
pageContent = pageContent.replace(/<a href="#([^"]*)"/g, '<Link href="#$1"');
// Ensure any remaining </a> matching a <Link> is fixed, but since the opening tag is now Link, it's fine.
// Wait, we had `<a href="#" className="navbar-brand">` which is also broken because of the `href="#"`.
pageContent = pageContent.replace(/<a href="#"/g, '<Link href="#"');

fs.writeFileSync(pageTsxPath, pageContent);
console.log("Fixed page.tsx tags");

// Fix styles.css
const cssPath = path.join(__dirname, 'app', 'styles', 'styles.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');
cssContent = cssContent.replace(/url\(['"]?media\//g, "url('/media/");
cssContent = cssContent.replace(/url\(['"]?images\//g, "url('/images/");
cssContent = cssContent.replace(/url\(['"]?\.\.\/images\//g, "url('/images/");
fs.writeFileSync(cssPath, cssContent);
console.log("Fixed styles.css paths");

const loginCssPath = path.join(__dirname, 'app', 'styles', 'login.css');
if (fs.existsSync(loginCssPath)) {
  let loginCssContent = fs.readFileSync(loginCssPath, 'utf8');
  loginCssContent = loginCssContent.replace(/url\(['"]?media\//g, "url('/media/");
  loginCssContent = loginCssContent.replace(/url\(['"]?images\//g, "url('/images/");
  loginCssContent = loginCssContent.replace(/url\(['"]?\.\.\/images\//g, "url('/images/");
  fs.writeFileSync(loginCssPath, loginCssContent);
}

const dashboardCssPath = path.join(__dirname, 'app', 'styles', 'dashboard.css');
if (fs.existsSync(dashboardCssPath)) {
  let dashboardCssContent = fs.readFileSync(dashboardCssPath, 'utf8');
  dashboardCssContent = dashboardCssContent.replace(/url\(['"]?media\//g, "url('/media/");
  dashboardCssContent = dashboardCssContent.replace(/url\(['"]?images\//g, "url('/images/");
  dashboardCssContent = dashboardCssContent.replace(/url\(['"]?\.\.\/images\//g, "url('/images/");
  fs.writeFileSync(dashboardCssPath, dashboardCssContent);
}
