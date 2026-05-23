const fs = require('fs');
const { execSync } = require('child_process');
const files = execSync('find src/pages src/components -name "*.tsx"').toString().trim().split('\n');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace dialog backgrounds
  content = content.replace(/bg-slate-900 border-white\/10 text-white/g, "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white");
  
  // Replace card overrides
  content = content.replace(/bg-slate-900 border-white\/5/g, "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5");
  
  // Replace Login background overrides
  content = content.replace(/bg-slate-950 font-sans/g, "bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100");
  
  // Login divider text
  content = content.replace(/bg-slate-900 px-2/g, "bg-slate-50 dark:bg-slate-900 px-2");
  
  // Replace Input overrides
  content = content.replace(/className="bg-slate-800\/50 border-white\/10 text-white focus:ring-indigo-500"/g, 'className="text-slate-900 dark:text-white focus:ring-indigo-500"');
  content = content.replace(/className="bg-slate-800\/50 border-white\/10 text-white pr-10 focus:ring-indigo-500"/g, 'className="text-slate-900 dark:text-white pr-10 focus:ring-indigo-500"');
  content = content.replace(/className="bg-slate-800\/50 border-white\/10 text-white"/g, 'className="text-slate-900 dark:text-white"');
  content = content.replace(/className="bg-slate-800\/50 border-white\/10"/g, 'className=""');
  content = content.replace(/bg-slate-800\/50 border-white\/10 text-white/g, 'text-slate-900 dark:text-white');
  content = content.replace(/bg-slate-800\/50 border-white\/10/g, "");
  
  // Replace CustomerDetail backgrounds
  content = content.replace(/bg-slate-800 p-3/g, "bg-slate-100 dark:bg-slate-800 p-3");
  
  // Replace MasterData tag backgrounds
  content = content.replace(/bg-slate-800 text-slate-300/g, "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300");
  
  // AiInsights
  content = content.replace(/bg-slate-800 rounded-2xl/g, "bg-slate-100 dark:bg-slate-800 rounded-2xl");
  content = content.replace(/bg-slate-950\/50 border-t border-white\/5/g, "bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-white/5");
  content = content.replace(/bg-slate-900 border-white\/10 pr-4 pl-12/g, "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 pr-4 pl-12");

  fs.writeFileSync(file, content, 'utf8');
}

console.log("Done");
