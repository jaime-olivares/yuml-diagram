require('./yuml2dot-utils.js')();

/*
Syntax as specified in yuml.me

Class           [Customer]
Directional     [Customer]->[Order]
Bidirectional   [Customer]<->[Order]
Aggregation     [Customer]+-[Order] or [Customer]<>-[Order]
Composition     [Customer]++-[Order]
Inheritance     [Customer]^[Cool Customer], [Customer]^[Uncool Customer]
Dependencies    [Customer]uses-.->[PaymentStrategy]
Cardinality     [Customer]<1-1..2>[Address]
Labels          [Person]customer-billingAddress[Address]
Notes           [Person]-[Address],[Address]-[note: Value Object]
Full Class      [Customer|Forename;Surname;Email|Save()]
Color splash    [Customer{bg:orange}]<>1->*[Order{bg:green}]
Comment         // Comments
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

            if (part.match(/^\[.*\]$/)) // class box
            {
                part = part.substr(1, part.length-2);
                var ret = extractBgAndNote(part, true);
                exprs.push([ret.isNote ? "note" : "record", ret.part, ret.bg, ret.fontcolor]);
            }
            else if (part=="^")  // inheritance
            {
                exprs.push(["edge", "empty", "", "none", "", "solid"]);
            }
            else if (part.indexOf("-") >= 0)  // association
            {
                var style;
                var tokens;

                if (part.indexOf("-.-") >= 0)
                {
                    style = "dashed";
                    tokens = part.split("-.-");
                }
                else
                {
                    style = "solid";
                    tokens = part.split("-");
                }

                if (tokens.length != 2)
                    throw("Invalid expression");

                var left = tokens[0];
                var right = tokens[1];
                var lstyle, ltext, rstyle, rtext;

                var processLeft = function(left)
                {
                    if (left.startsWith("<>"))
                        return [ "odiamond", left.substring(2)];
                    else if (left.startsWith("++"))
                        return [ "diamond", left.substring(2)];
                    else if (left.startsWith("+"))
                        return [ "odiamond", left.substring(1)];
                    else if (left.startsWith("<") || left.endsWith(">"))
                        return [ "vee", left.substring(1)];
                    else if (left.startsWith("^"))
                        return [ "empty", left.substring(1)];
                    else
                        return [ "none", left ];
                }
                tokens = processLeft(left);
                lstyle = tokens[0];
                ltext = tokens[1];

                var processRight = function(right)
                {
                    var len = right.length;

                    if (right.endsWith("<>"))
                        return [ "odiamond", right.substring(0, len-2)];
                    else if (right.endsWith("++"))
                        return [ "diamond", right.substring(0, len-2)];
                    else if (right.endsWith("+"))
                        return [ "odiamond", right.substring(0, len-1)];
                    else if (right.endsWith(">"))
                        return [ "vee", right.substring(0, len-1)];
                    else if (right.endsWith("^"))
                        return [ "empty", right.substring(0, len-1)];
                    else
                        return processLeft(right);
                }
                tokens = processRight(right);
                rstyle = tokens[0];
                rtext = tokens[1];

                exprs.push(['edge', lstyle, ltext, rstyle, rtext, style]);
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
        var dot = "    ranksep = " + 0.7 + "\r\n";
        dot += "    rankdir = " + options.dir + "\r\n";

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

                    label = formatLabel(label, 20, true);
                    if (elem[k][0] == "record")
                    {
                        if (options.dir == "TB")
                            label = "{" + label + "}";
                    }

                    var node = {
                        shape: elem[k][0],
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

            if (elem.length == 3 && elem[1][0] == 'edge')
            {
                var hasNote = (elem[0][0] == 'note' || elem[2][0] == 'note');
                var style = hasNote ? "dashed" : elem[1][5];

                var edge = {
                    shape: "edge",
                    dir: "both",
                    style: style,
                    arrowtail: elem[1][1],
                    taillabel: elem[1][2],
                    arrowhead: elem[1][3],
                    headlabel: elem[1][4],
                    labeldistance: 2,
                    fontsize: 10
                }

                if (hasNote)
                    dot += '    { rank=same; ' + uids[recordName(elem[0][1])] + " -> " + uids[recordName(elem[2][1])] + ' ' + serializeDot(edge) + ";}\r\n";
                else
                    dot += '    ' + uids[recordName(elem[0][1])] + " -> " + uids[recordName(elem[2][1])] + ' ' + serializeDot(edge) + "\r\n";
            }
            else if (elem.length == 4 && [elem[0][0], elem[1][0], elem[2][0], elem[3][0]].join() == "record,edge,record,record")  // intermediate association class
            {
                var style = elem[1][5];
                
                var junction = {
                    shape: "point",
                    style: "invis",
                    label: "",
                    height: 0.01,
                    width: 0.01
                }
                var uid = uids[recordName(elem[0][1])] + "J" + uids[recordName(elem[2][1])];
                dot += '    ' + uid + ' ' + serializeDot(junction) + "\r\n";

                var edge1 = {
                    shape: "edge",
                    dir: "both",
                    style: style,
                    arrowtail: elem[1][1],
                    taillabel: elem[1][2],
                    arrowhead: "none",
                    labeldistance: 2,
                    fontsize: 10
                }
                var edge2 = {
                    shape: "edge",
                    dir: "both",
                    style: style,
                    arrowtail: "none",
                    arrowhead: elem[1][3],
                    headlabel: elem[1][4],
                    labeldistance: 2,
                    fontsize: 10
                }
                var edge3 = {
                    shape: "edge",
                    dir: "both",
                    style: "dashed",
                    arrowtail: "none",
                    arrowhead: "vee",
                    labeldistance: 2
                }
                dot += '    ' + uids[recordName(elem[0][1])] + " -> " + uid + ' ' + serializeDot(edge1) + "\r\n";
                dot += '    ' + uid + " -> " + uids[recordName(elem[2][1])] + ' ' + serializeDot(edge2) + "\r\n";
                dot += '    { rank=same; ' + uids[recordName(elem[3][1])] + " -> " + uid + ' ' + serializeDot(edge3) + ";}\r\n"; 
            }
        }

        dot += '}\r\n';
        return dot;
    }

    return composeDotExpr(specLines, options);
}