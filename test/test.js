
const yuml_diagram = require('../index.js');
const fs = require('fs');

var yuml = new yuml_diagram();
var yumlText = fs.readFileSync("./test.yuml", {encoding:"utf8"});
var svg = yuml.processYumlDocument(yumlText, false);
fs.writeFileSync("./test.yuml.svg", svg);
