const fs = require('fs');

function replaceFile(path, search, replace) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(path, content, 'utf8');
}

replaceFile('src/pages/Inventory.tsx', /bg-slate-900 border-white\/10 z-10/g, 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 z-10');

// Input cleanup
const inputRegex = /className="flex h-10 w-full rounded-md bg-slate-800\/50 border border-white\/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-(indigo|emerald)-500"/g;
['Contracts', 'Collections', 'NewContract'].forEach(f => {
  let p = `src/pages/${f}.tsx`;
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(inputRegex, 'className="flex h-10 w-full rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-$1-500"');
  fs.writeFileSync(p, c, 'utf8');
});

// AiInsights cleanup
replaceFile('src/pages/AiInsights.tsx', /text-slate-200/g, 'text-slate-900 dark:text-slate-200');

// Login link check
// And Login card text check
console.log('done');
