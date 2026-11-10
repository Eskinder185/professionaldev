import{r as c,j as t}from"./index-B9V0Z-X2.js";import{P as x}from"./PageHeader-CmQR4vso.js";import{l as d,s as m}from"./storage-Br9xJp8f.js";const j=`# Project Name

## Overview
Short summary of the project.

## Demo
Link or screenshots.

## Install


## Run


## Tests


## License
MIT
`,g=`## Expected Behavior

## Current Behavior

## Steps to Reproduce
1. 
2. 
3. 
`,b=`## Summary

## Changes
- 
- 

## Checklist
- [ ] Tests added/updated
- [ ] Docs updated
`;function v(){const[s,a]=c.useState(()=>d("pd:career:audit:last",{project:"",repoUrl:"",tags:[],demo:"",hasReadme:!1,hasInstall:!1,hasScreens:!1,hasLicense:!1,hasScripts:!1,hasCI:!1,lastCommit:""})),[l,h]=c.useState(()=>d("pd:career:audit:history",[])),p=c.useRef(null),n=c.useMemo(()=>{let e=0;return e+=s.hasReadme?20:0,e+=s.hasInstall&&s.hasScripts?20:s.hasInstall||s.hasScripts?10:0,e+=s.hasScreens?15:0,e+=s.hasLicense?10:0,e+=s.hasCI?15:0,e+=s.demo?10:0,e+=s.lastCommit?10:0,Math.min(100,e)},[s]),o=c.useMemo(()=>{const e=[];return s.hasReadme||e.push("Add a clear README."),s.hasInstall||e.push("Document install steps."),s.hasScripts||e.push("Add build/test scripts."),s.hasScreens||e.push("Include screenshots or GIFs."),s.hasLicense||e.push("Add a LICENSE file."),s.hasCI||e.push("Set up GitHub Actions CI."),s.demo||e.push("Link a live demo if possible."),s.lastCommit||e.push("Update last commit date."),e},[s]),u=()=>{m("pd:career:audit:last",s);const i=[{...s,date:new Date().toISOString(),score:n},...l].slice(0,5);h(i),m("pd:career:audit:history",i)},r=(e,i)=>{navigator.clipboard?.writeText(e),alert(`${i} copied to clipboard`)};return t.jsx("div",{className:"relative",children:t.jsxs("div",{className:"relative z-10 mx-auto max-w-6xl space-y-0 px-4 py-10",children:[t.jsx(x,{eyebrow:"Career Tools",title:"Portfolio & GitHub audit",sub:"Checklist-based score with quick templates."}),t.jsxs("section",{className:"border-t border-border/70 pt-8 sm:pt-10",children:[t.jsxs("div",{className:"grid gap-3 md:grid-cols-2",children:[t.jsx("input",{"aria-label":"Project name",className:"input",placeholder:"Project name",value:s.project,onChange:e=>a({...s,project:e.target.value})}),t.jsx("input",{"aria-label":"Repo URL",className:"input",placeholder:"Repository URL",value:s.repoUrl,onChange:e=>a({...s,repoUrl:e.target.value})}),t.jsx("input",{"aria-label":"Tags",className:"input",placeholder:"tags (comma)",value:s.tags.join(", "),onChange:e=>a({...s,tags:e.target.value.split(",").map(i=>i.trim()).filter(Boolean)})}),t.jsx("input",{"aria-label":"Demo link",className:"input",placeholder:"Demo link (optional)",value:s.demo,onChange:e=>a({...s,demo:e.target.value})})]}),t.jsxs("div",{className:"mt-4 grid gap-2 text-sm md:grid-cols-3",children:[t.jsxs("label",{className:"flex items-center gap-2 text-ink-muted",children:[t.jsx("input",{type:"checkbox",checked:s.hasReadme,onChange:e=>a({...s,hasReadme:e.target.checked})})," README has overview"]}),t.jsxs("label",{className:"flex items-center gap-2 text-ink-muted",children:[t.jsx("input",{type:"checkbox",checked:s.hasInstall,onChange:e=>a({...s,hasInstall:e.target.checked})})," Install/Run steps"]}),t.jsxs("label",{className:"flex items-center gap-2 text-ink-muted",children:[t.jsx("input",{type:"checkbox",checked:s.hasScreens,onChange:e=>a({...s,hasScreens:e.target.checked})})," Screenshots/GIFs"]}),t.jsxs("label",{className:"flex items-center gap-2 text-ink-muted",children:[t.jsx("input",{type:"checkbox",checked:s.hasLicense,onChange:e=>a({...s,hasLicense:e.target.checked})})," License present"]}),t.jsxs("label",{className:"flex items-center gap-2 text-ink-muted",children:[t.jsx("input",{type:"checkbox",checked:s.hasScripts,onChange:e=>a({...s,hasScripts:e.target.checked})})," Scripts: build/test"]}),t.jsxs("label",{className:"flex items-center gap-2 text-ink-muted",children:[t.jsx("input",{type:"checkbox",checked:s.hasCI,onChange:e=>a({...s,hasCI:e.target.checked})})," CI present"]})]}),t.jsxs("div",{className:"mt-4 grid gap-3 md:grid-cols-2 md:items-center",children:[t.jsx("input",{"aria-label":"Last commit",className:"input",placeholder:"Last commit date (YYYY-MM-DD)",value:s.lastCommit,onChange:e=>a({...s,lastCommit:e.target.value})}),t.jsxs("div",{className:"flex items-center gap-2 text-ink dark:text-white",children:[t.jsx("span",{className:"font-medium",children:"Score:"})," ",t.jsxs("span",{children:[n,"/100"]})]})]}),t.jsx("div",{className:"mt-4",children:t.jsx("button",{type:"button",className:"btn btn-primary min-h-10 px-4",onClick:u,children:"Save audit"})})]}),t.jsxs("section",{className:"border-t border-border/70 pt-8 sm:pt-10",children:[t.jsxs("div",{ref:p,children:[t.jsx("h2",{className:"mb-3 font-medium text-ink dark:text-white",children:"Missing items"}),o.length===0?t.jsx("p",{className:"text-sm text-ink-muted",children:"Looks great."}):t.jsx("ul",{className:"list-disc pl-5 text-sm text-ink-muted",children:o.map((e,i)=>t.jsx("li",{children:e},i))})]}),t.jsxs("div",{className:"mt-4 flex flex-wrap gap-2",children:[t.jsx("button",{type:"button",className:"btn surface-muted min-h-10 px-4",onClick:()=>r(j,"README template"),children:"Copy README template"}),t.jsx("button",{type:"button",className:"btn surface-muted min-h-10 px-4",onClick:()=>r(g,"Issue template"),children:"Copy Issue template"}),t.jsx("button",{type:"button",className:"btn surface-muted min-h-10 px-4",onClick:()=>r(b,"PR template"),children:"Copy PR template"})]})]}),l.length>0&&t.jsxs("section",{className:"border-t border-border/70 pt-8 sm:pt-10 pb-2",children:[t.jsx("h2",{className:"mb-4 font-medium text-ink dark:text-white",children:"Recent audits"}),t.jsx("div",{className:"grid gap-6 text-sm md:grid-cols-3",children:l.map((e,i)=>t.jsxs("div",{children:[t.jsx("div",{className:"truncate font-medium text-ink dark:text-white",title:e.project,children:e.project||"Project"}),t.jsx("div",{className:"text-ink-muted",children:new Date(e.date).toLocaleString()}),t.jsxs("div",{className:"text-ink-muted",children:["Score: ",t.jsx("span",{className:"font-medium text-ink dark:text-white",children:e.score})]})]},i))})]})]})})}export{v as default};
