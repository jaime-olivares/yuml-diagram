require('../utils/yuml2dot-utils.js')();

/*
Syntax as specified in yuml.me

Start	           (start)
End	               (end)
Activity           (Find Products)
Flow	           (start)->(Find Products)
Multiple Assoc.    (start)->(Find Products)->(end)
Decisions          (start)-><d1>
Decisions w/Label  (start)-><d1>logged in->(Show Dashboard), <d1>not logged in->(Show Login Page)
Parallel	       (Action1)->|a|,(Action 2)->|a|
Note               (Action1)-(note: A note message here)
Object Node        [Object]
Comment            // Comments
*/

module.exports = function(specLines, options)
{
    function parseYumlExpr(specLine)
    {
        var exprs = [];
        var parts = this.splitYumlExpr(specLine, "[(<|");


        // yUML syntax allows any character in decision labels.
        // The following variable serves as flag to avoid parsing 
        // brackets characters inside labels.
        var isDecisionLabel = false;
        var decisionLabelBuffer = "";

        for (var i=0; i<parts.length; i++)
        {
            var part = parts[i].trim();
            if (part.length == 0)
                continue;

            if (part.match(/->$/))  // arrow
            {
                isDecisionLabel = false;
                decisionLabelBuffer = "";
      
                part = decisionLabelBuffer + part.substr(0, part.length-2).trim();
                exprs.push(["edge", "none", "vee", part, "solid"]);
            }
            else if (isDecisionLabel)
            {
                // decision label parts
                decisionLabelBuffer += part;
            }
            else if (part.match(/^\(.*\)$/)) // activity
            {
                part = part.substr(1, part.length-2);
                var ret = extractBgAndNote(part, true);
                exprs.push([ret.isNote ? "note" : "record", ret.part, 'rounded', ret.bg, ret.fontcolor]);
            }
            else if (part.match(/^<.*>$/)) // decision
            {
                part = part.substr(1, part.length-2);
                exprs.push(["diamond", part]);
            }
            else if (/^\[.*\]$/.test(part)) // object node
            {
                exprs.push(["record", part.substr(1, part.length - 2).trim()]);
            }
            else if (part.match(/^\|.*\|$/)) // bar
            {
                part = part.substr(1, part.length-2);
                exprs.push(["mrecord", part]);
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
        var elements = [];
        var headports = { LR: "w", RL: "e", TB: "n" };

        for (var i=0; i<specLines.length; i++)
        {
            var elem = parseYumlExpr(specLines[i]);

            for (var k=0; k<elem.length; k++)
            {
                if (elem[k][0] == "note" || elem[k][0] == "record")
                {
                    var label = elem[k][1];
                    if (uids.hasOwnProperty(recordName(label)))
                        continue;

                    var uid = 'A' + (len++).toString();
                    uids[recordName(label)] = uid;

                    if (elem[k][0]=="record" && (label=="start" || label=="end"))
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
                        var node = {
                            shape: elem[k][0],
                            height: 0.5,
                            fontsize: 10,
                            margin: "0.20,0.05",
                            label: escape_label(label),
                            style: elem[k][2]
                        }

                        if (elem[k][3]) {
                            node.style += ",filled";
                            node.fillcolor = elem[k][3];
                        }

                        if (elem[k][4])
                            node.fontcolor = elem[k][4];                        
                    }

                    elements.push([uid, node]);
                }
                else if (elem[k][0] == "diamond")
                {
                    var label = elem[k][1];
                    if (uids.hasOwnProperty(recordName(label)))
                        continue;

                    var uid = 'A' + (len++).toString();
                    uids[recordName(label)] = uid;

                    var node = {
                        shape: "diamond",
                        height: 0.5,
                        width: 0.5,
                        margin: "0,0",
                        label: ""
                    }

                    elements.push([uid, node]);
                }
                else if (elem[k][0] == "mrecord")
                {
                    var label = elem[k][1];
                    if (uids.hasOwnProperty(recordName(label)))
                        continue;

                    var uid = 'A' + (len++).toString();
                    uids[recordName(label)] = uid;

                    var node = {
                        shape: "record",
                        height: options.dir == "TB" ? 0.05 : 0.5,
                        width:  options.dir == "TB" ? 0.5 : 0.05,
                        margin: "0,0",
                        style: "filled",
                        label: "",
                        fontsize: 1,
                        penwidth: 4
                    }

                    elements.push([uid, node]);
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
                        labeldistance: 1,
                        fontsize: 10
                    }

                    if (elem[k][3].length > 0)
                        edge.label = elem[k][3];

                    var uid1 = uids[recordName(elem[k-1][1])];
                    var uid2 = uids[recordName(elem[k+1][1])];

                    if (elem[k+1][0] == "mrecord")
                    {
                        var facet = addBarFacet(elements, uid2);
                        uid2 += ":" + facet + ":" + headports[options.dir];
                    }

                    elements.push([uid1, uid2, edge]);
                }
            }
        }

        var dot = "    ranksep = " + 0.5 + "\r\n";
        dot += "    rankdir = " + options.dir + "\r\n";        
        dot += serializeDotElements(elements);
        dot += '}\r\n';
        return dot;
    }

    function addBarFacet(elements, name)
    {
        for (var i=0; i<elements.length; i++)
        {
            if (elements[i].length == 2 && elements[i][0] == name)
            {
                var node = elements[i][1];
                var facetNum = 1;

                if (node.label.length > 0)
                {                
                    facetNum = node.label.split("|").length + 1;
                    node.label += "|<f" + facetNum + ">";
                }
                else
                    node.label = "<f1>";

                return "f" + facetNum;
            }
        }

        return null;
    }

    return composeDotExpr(specLines, options);
}
