require('./yuml2dot-utils.js')();

/*
Unofficial syntax, based on the activity diagram syntax specified in yuml.me

Start	         (start)
End	             (end)
Activity         (Find Products)
Flow	         (start)->(Find Products)
Multiple Assoc.  (start)->(Find Products)->(end)
Complex case     (Simulator running)[Pause]->(Simulator paused|do/wait)[Unpause]->(Simulator running)
Comment          // Comments
*/

module.exports = function(specLines, options)
{
    function parseYumlExpr(specLine)
    {
        var exprs = [];
        var parts = this.splitYumlExpr(specLine, "(");

        for (var i=0; i<parts.length; i++)
        {
            var part = parts[i].trim();
            if (part.length == 0)
                continue;

            if (part.match(/^\(.*\)$/)) // state
            {
                part = part.substr(1, part.length-2);
                var ret = extractBgAndNote(part, true);
                exprs.push([ret.isNote ? "note" : "record", ret.part, ret.bg, ret.fontcolor]);
            }
            else if (part.match(/->$/))  // arrow
            {
                part = part.substr(0, part.length-2).trim();
                exprs.push(["edge", "none", "vee", part, "solid"]);
            }
            else if (part == '-')  // connector for notes
            {
                exprs.push(["edge", "none", "none", "", "solid"]);
            }
            else
                throw("Invalid expression");
        }

        return exprs;
    }

    function composeDotExpr(specLines, options)
    {
        var uids = {};
        var len = 0;
        var dot = "    ranksep = " + 0.5 + "\r\n";
        dot += "    rankdir = " + options.dir + "\r\n";

        for (var i=0; i<specLines.length; i++)
        {
            var elem = parseYumlExpr(specLines[i]);

            for (var k=0; k<elem.length; k++)
            {
                var type = elem[k][0];

                if (type == "note" || type == "record")
                {
                    var label = elem[k][1];
                    if (uids.hasOwnProperty(recordName(label)))
                        continue;

                    var uid = 'A' + (len++).toString();
                    uids[recordName(label)] = uid;

                    if (type=="record" && (label=="start" || label=="end"))
                    {
                        var node = {
                            shape: label=="start" ? "circle" : "doublecircle",
                            height: 0.3,
                            width: 0.3,
                            margin: "0,0",
                            label: ""
                        }
                    }
                    else
                    {
                        label = formatLabel(label, 20, true);
                        if (type == "record")
                            label = "{" + label + "}";

                        var node = {
                            shape: type,
                            height: 0.5,
                            fontsize: 10,
                            margin: "0.20,0.05",
                            label: label,
                            style: "rounded"
                        }

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

            for (var k=1; k<(elem.length-1); k++)
            {
                if (elem[k][0] == "edge" && elem[k-1][0] != "edge" && elem[k+1][0] != "edge")
                {
                    var style = (elem[k-1][0] == 'note' || elem[k+1][0] == 'note') ? "dashed" : elem[k][4];

                    var edge = {
                        shape: "edge",
                        dir: "both",
                        style: style,
                        arrowtail: elem[k][1],
                        arrowhead: elem[k][2],
                        labeldistance: 2,
                        fontsize: 10
                    }

                    if (elem[k][3].length > 0)
                        edge.label = elem[k][3];

                    dot += '    ' + uids[recordName(elem[k-1][1])] + " -> " + uids[recordName(elem[k+1][1])] + ' ' + serializeDot(edge) + "\r\n";
                }
            }
        }

        dot += '}\r\n';
        return dot;
    }

    return composeDotExpr(specLines, options);
}