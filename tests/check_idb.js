require('fake-indexeddb/auto');
console.log("Global indexedDB:", typeof indexedDB !== 'undefined' ? typeof indexedDB : 'undefined');
if (typeof indexedDB !== 'undefined') console.log("Global indexedDB.open:", typeof indexedDB.open);

const pkg = require('fake-indexeddb');
console.log("Pkg type:", typeof pkg);
console.log("Pkg keys:", Object.keys(pkg));
if (pkg.indexedDB) console.log("Pkg.indexedDB.open:", typeof pkg.indexedDB.open);
