require('../utils/yuml2dot-utils.js')();
const renderer = require('./sequence-renderer.js');

/*
Unofficial syntax, based on a proposal specified in the Scruffy project, plus local additions

Object     [Patron]
Message    [Patron]order food>[Waiter]
Response   [Waiter]serve wine.>[Patron]
Note       [Actor]-[note: a note message]
Comment    // Comments

Asynchronous message            [Patron]order food>>[Waiter]
Open activation box at source   [Source](message>[Dest]
Open activation box at dest     [Source]message>([Dest]
Close activation at dest        [Source]message>)[Dest]
Close activation at source      [Source])message>[Dest]
Cancel activation box           [Source])X
*/

module.exports = function(specLines, options)
{
    var actors  = [];
    var signals = [];

    function parseYumlExpr(specLine)
    {
        var exprs = [];
        var parts = this.splitYumlExpr(specLine, "[");

        for (var i=0; i<parts.length; i++)
        {
            var part = parts[i].trim();
            if (part.length == 0)
                continue;

            if (part.match(/^\[.*\]$/)) // object
            {
                part = part.substr(1, part.length-2);
                var ret = extractBgAndNote(part, true);
                exprs.push([ret.isNote ? "note" : "object", ret.part, ret.bg, ret.fontcolor]);
            }
            else if  (part == "-")
            {
                exprs.push(["signal", "", "", "dashed", ""]);  // note connector
            }
            else if (part.indexOf(">") >= 0)  // message
            {
                var style = (part.indexOf(".>") >= 0) ? "dashed" : "solid";
                style = (part.indexOf(">>") >= 0) ? "async" : style;

                var prefix = "";
                if (part.startsWith("(") || part.startsWith(")"))
                {
                    prefix = part.substr(0, 1);
                    part = part.substr(1);
                }

                var message = "";
                var pos = part.match(/[\.|>]{0,1}>[\(|\)]{0,1}$/);
                if (pos == null)
                {
                    throw("Invalid expression");
                }
                else if (pos.index > 0)
                {
                    message = part.substr(0, pos.index);
                    part = part.substr(pos.index);
                }

                var suffix = "";
                if (part.endsWith("(") || part.endsWith(")"))
                {
                    suffix = part.charAt(part.length - 1);
                    part = part.substr(0, part.length - 1);
                }

                exprs.push(["signal", prefix, message, style, suffix]);
            }
            else
                throw("Invalid expression");
        }

        return exprs;
    }

    function composeSVG(specLines, options)
    {
        var uids = {};
        var index = 0;
        
        for (var i=0; i<specLines.length; i++)
        {
            var elem = parseYumlExpr(specLines[i]);

            for (var k=0; k<elem.length; k++)
            {
                var type = elem[k][0];

                if (type == "object" )
                {
                    var label = elem[k][1];
                    var rn = recordName(label);
                    if (uids.hasOwnProperty(rn))
                        continue;

                    label = formatLabel(label, 20, true);
                    var actor = { type: elem[k][0], name: rn, label: label, index: actors.length };
                    uids[rn] = actor;

                    actors.push(actor);
                }
            }

            if (elem.length == 3 && elem[0][0] == 'object' && elem[1][0] == 'signal' && elem[2][0] == 'object')
            {
                var message = elem[1][2];
                var style = elem[1][3];
                var actorA = uids[recordName(elem[0][1])];
                var actorB = uids[recordName(elem[2][1])];
                var signal = null;

                switch (style)
                {
                    case "dashed":
                        signal = { type: "signal", actorA: actorA, actorB: actorB, linetype: "dashed", arrowtype: "arrow-filled", message: message }
                        break;
                    case "solid":
                        signal = { type: "signal", actorA: actorA, actorB: actorB, linetype: "solid", arrowtype: "arrow-filled", message: message }
                        break;
                    case "async":
                        signal = { type: "signal", actorA: actorA, actorB: actorB, linetype: "solid", arrowtype: "arrow-open", message: message }
                        break;
                }

                if (signal != null)
                    signals.push(signal);
            }
            else if (elem.length == 3 && elem[0][0] == 'object' && elem[1][0] == 'signal' && elem[2][0] == 'note')
            {
                var actorA = uids[recordName(elem[0][1])];
                var label = elem[2][1];
                label = formatLabel(label, 20, true);
                var note = { type: "note", message: label, actor: actorA };

                if (elem[2][2])  // background color
                    note.bgcolor = elem[2][2];
                if (elem[2][3])  // font color
                    note.fontcolor = elem[2][3];

                signals.push(note);
            }            
        }

        var r = new renderer(actors, signals, uids, options.dark);
        var svg = r.svg_.serialize();

        return svg;
    }

    return composeSVG(specLines, options);
}
