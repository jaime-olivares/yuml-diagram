require('./yuml2dot-utils.js')();

/*
Unofficial syntax, based on the activity diagram syntax specified in yuml.me

Node           [node1]
Association    [node1]-[node2]
Labeled assoc  [node1]label-[node2]
Note           [node1]-[note: a note here]
Comment        // Comments
*/

module.exports = function(specLines, options)
{
    function parseYumlExpr(specLine)
    {
        var exprs = [];
        var parts = this.splitYumlExpr(specLine, "[");

        for (var i=0; i<parts.length; i++)
        {
            var part = parts[i].trim();
            if (part.length == 0)
                continue;

            if (part.match(/^\[.*\]$/)) // node
            {
                part = part.substr(1, part.length-2);
                var ret = extractBgAndNote(part, true);
                exprs.push([ret.isNote ? "note" : "box3d", ret.part, ret.bg, ret.fontcolor]);
            }
            else if (part.match(/-$/))  // line w/ or wo/ label
            {
                part = part.substr(0, part.length-1).trim();
                exprs.push(["edge", "none", "none", part, "solid"]);
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

                if (type == "note" || type == "box3d")
                {
                    var label = elem[k][1];
                    if (uids.hasOwnProperty(recordName(label)))
                        continue;

                    var uid = 'A' + (len++).toString();
                    uids[recordName(label)] = uid;

                    label = formatLabel(label, 20, true);

                    var node = {
                        shape: type,
                        height: 0.5,
                        fontsize: 10,
                        margin: "0.20,0.05",
                        label: label
                    }

                    if (elem[k][2]) {
                        node.style = "filled";
                        node.fillcolor = elem[k][2];
                    }

                    if (elem[k][3])
                        node.fontcolor = elem[k][3];                         

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