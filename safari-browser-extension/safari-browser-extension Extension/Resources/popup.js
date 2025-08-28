const api = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
console.log("Hello World!", api);
