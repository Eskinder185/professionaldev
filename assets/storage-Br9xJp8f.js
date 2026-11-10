const r=(e,t)=>{try{const a=localStorage.getItem(e);return a?JSON.parse(a):t}catch{return t}},s=(e,t)=>{localStorage.setItem(e,JSON.stringify(t))};export{r as l,s};
