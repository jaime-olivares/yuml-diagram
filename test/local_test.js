
const yuml_diagram = require('../index.js');
const fs = require('fs');

var yumlText = 
    `// {type:sequence}
    [:Computer]async test>>[:Server]
    [:Computer]sync test>[:Server]`;

var yuml = new yuml_diagram();
var svg = yuml.processYumlDocument(yumlText, false);

fs.writeFileSync("./test.yuml.svg", svg);
