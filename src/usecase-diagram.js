require('./yuml2dot-utils.js')();

/*
Syntax as specified in yuml.me

Use Case	        (Login)
Actor	            [Customer]
<<Extend>>	        (Login)<(Forgot Password)
<<Include>>	        (Register)>(Confirm Email)
Actor Inheritance	[Admin]^[User]
Notes	            [Admin]^[User],[Admin]-(note: Most privileged user)
*/

module.exports = function(specLines, options)
{
    function parseYumlExpr(specLine)
    {
        var exprs = [];
        var parts = this.splitYumlExpr(specLine, "[(");

        for (var i=0; i<parts.length; i++)
        {
            var part = parts[i].trim();
            if (part.length == 0)
                continue;

            if (part.match(/^\(.*\)$/))  // use-case
            {
                part = part.substr(1, part.length-2);
                var ret = extractBgAndNote(part, true);
                exprs.push([ret.isNote ? "note" : "record", ret.part, ret.bg, ret.fontcolor]);
            }
            else if (part.match(/^\[.*\]$/))   // actor
            {
                part = part.substr(1, part.length-2);

                exprs.push(["actor", part]);
            }
            else switch (part)
            {
                case "<":
                    exprs.push(["edge", "vee", "<<extend>>", "none", "dashed"]);
                    break;
                case ">":
                    exprs.push(["edge", "none", "<<include>>", "vee", "dashed"]);
                    break;
                case "-":
                    exprs.push(["edge", "none", "", "none", "solid"]);
                    break;
                case "^":
                    exprs.push(["edge", "none", "", "empty", "solid"]);
                    break;
                default:
                    throw("Invalid expression");
            }
        }

        return exprs;
    }

    function composeDotExpr(specLines, options)
    {
        var uids = {};
        var len = 0;
        var dot = "    ranksep = " + 0.7 + "\r\n";
        dot += "    rankdir = " + options.dir + "\r\n";

        for (var i=0; i<specLines.length; i++)
        {
            var elem = parseYumlExpr(specLines[i]);

            for (var k=0; k<elem.length; k++)
            {
                var type = elem[k][0];

                if (type == "note" || type == "record" || type == "actor")
                {
                    var label = elem[k][1];
                    if (uids.hasOwnProperty(recordName(label)))
                        continue;

                    var uid = 'A' + (len++).toString();
                    uids[recordName(label)] = uid;

                    label = formatLabel(label, 20, false);

                    var node = {
                        fontsize: 10
                    };

                    if (type == "actor") {
                        node.margin = "0.05,0.05";
                        node.shape = "none";
                        node.label = "{img:actor} " + label;
                        node.height = 1;
                    }
                    else {
                        node.margin = "0.20,0.05";
                        node.shape = type == "record" ? "ellipse" : "note";
                        node.label = label;
                        node.height = 0.5;

                        if (elem[k][2]) {
                            node.style = "filled";
                            node.fillcolor = elem[k][2];
                        }

                        if (elem[k][3])
                            node.fontcolor = elem[k][3];                     
                    }

                    dot += '    ' + uid + ' ' + serializeDot(node) + "\r\n";
                }
            }

            if (elem.length == 3 && elem[1][0] == 'edge')
            {
                var style = (elem[0][0] == 'note' || elem[2][0] == 'note') ? "dashed" : elem[1][4];

                var edge = {
                    shape: "edge",
                    dir: "both",
                    style: style,
                    arrowtail: elem[1][1],
                    arrowhead: elem[1][3],
                    labeldistance: 2,
                    fontsize: 10
                }
                if (elem[1][2].length > 0)
                    edge.label = elem[1][2];

                dot += '    ' + uids[recordName(elem[0][1])] + " -> " + uids[recordName(elem[2][1])] + ' ' + serializeDot(edge) + "\r\n";
            }
        }

        dot += '}\r\n';
        return dot;
    }

    return composeDotExpr(specLines, options);
}
