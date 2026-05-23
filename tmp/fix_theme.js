const fs = require('fs');
const glob = require('glob'); // Note: we might not use glob if it's not installed, let's just use child_process or simple recursion

const { execSync } = require('child_process');
const files = execSync('find src/pages -name "*.tsx"').toString().trim().split('\n');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace dialog backgrounds
  content = content.replace(/bg-slate-900 border-white\/10 text-white/g, "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white");
  
  // Replace card overrides
  content = content.replace(/bg-slate-900 border-white\/5/g, "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5");
  
  // Replace Login background overrides
  content = content.replace(/bg-slate-950 font-sans/g, "bg-slate-50 dark:bg-slate-950 font-sans dark:text-slate-100");
  
  // Login card
  content = content.replace(/bg-slate-900 border-white\/5/g, "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5");
  
  // Login divider text
  content = content.replace(/bg-slate-900 px-2/g, "bg-white dark:bg-slate-900 px-2");
  
  // Replace Input overrides
  content = content.replace(/bg-slate-800\/50 border-white\/10 text-white focus:ring-indigo-500/g, "text-slate-900 dark:text-white focus:ring-indigo-500");
  content = content.replace(/bg-slate-800\/50 border-white\/10 text-white pr-10 focus:ring-indigo-500/g, "text-slate-900 dark:text-white pr-10 focus:ring-indigo-500");
  content = content.replace(/className="bg-slate-800\/50 border-white\/10"/g, "");
  content = content.replace(/bg-slate-800\/50 border-white\/10/g, "");
  
  // Replace CustomerDetail backgrounds
  content = content.replace(/bg-slate-800 p-3/g, "bg-slate-100 dark:bg-slate-800 p-3");
  
  // Replace MasterData tag backgrounds
  content = content.replace(/bg-slate-800 text-slate-300/g, "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300");
  
  // Collections inputs
  content = content.replace(/className=" flex h-10/g, 'className="flex h-10'); // cleanup
  content = content.replace(/ className="" /g, " ");

  // AiInsights
  content = content.replace(/bg-slate-800 rounded-2xl/g, "bg-slate-100 dark:bg-slate-800 rounded-2xl");
  content = content.replace(/bg-slate-950\/50 border-t border-white\/5/g, "bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-white/5");
  content = content.replace(/bg-slate-900 border-white\/10 pr-4 pl-12/g, "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 pr-4 pl-12");

  fs.writeFileSync(file, content, 'utf8');
}

// Dialog.tsx fix
const dFile = 'src/components/ui/dialog.tsx';
let dContent = fs.readFileSync(dFile, 'utf8');
dContent = dContent.replace(/bg-slate-900 text-slate-100/g, "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100");
dContent = dContent.replace(/bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50/g, "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100");
fs.writeFileSync(dFile, dContent, 'utf8');

console.log("Done");
