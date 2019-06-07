var yuml_diagram = require("yuml-diagram");

var yumlText = 
    `// {type:sequence}
    [:Computer]async test>>[:Server]
    [:Computer]sync test>[:Server]`;

var yuml = new yuml_diagram();
var svg = yuml.processYumlDocument(yumlText, false);